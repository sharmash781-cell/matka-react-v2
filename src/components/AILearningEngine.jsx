import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useChart, isRedPair, calculateCN, calculateCloseCond, calculateTotal, calculateDiffTotal } from '../context/ChartContext';
import { findSequenceMatches, MATCH_COLORS, parseSequenceInput } from '../ai/sequenceEngine';
import { Brain, Sparkles, Search, ChevronUp, ChevronDown, ArrowDown, Filter, Layers, Settings2, Eye, EyeOff, MapPin } from 'lucide-react';

const COL_HEADERS = ['Mo', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Col 8'];
const OVERSCAN = 20;

export const AILearningEngine = () => {
  const { charts = {}, activeChartName, setActiveChartName, setActiveTab, saveChart } = useChart();

  const [selectedChart, setSelectedChart] = useState(activeChartName || Object.keys(charts)[0] || 'SRIDEVI');

  // FORWARD SEQUENCE SEARCH INPUT
  const [sequenceInput, setSequenceInput] = useState('5, 8, 0');
  const [activeMatchFilter, setActiveMatchFilter] = useState('all');

  // CONTROLS & TABLE UI OPTIONS (MATCHING CHART EDITOR)
  const [showControls, setShowControls] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [isCompact, setIsCompact] = useState(true);
  const [showLocationList, setShowLocationList] = useState(true);

  // Virtualization Scroll State
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef(null);

  const activeChartObj = charts[selectedChart] || null;
  const grid = activeChartObj ? activeChartObj.data : [];
  const colsInput = activeChartObj ? activeChartObj.cols : 7;
  
  // Optimized row height allowing 12-14 rows on mobile screen
  const rowHeight = isCompact ? (showStats ? 44 : 34) : (showStats ? 60 : 45);

  const handleAICellChange = (rIdx, cIdx, value) => {
    if (!activeChartObj) return;
    let newGrid = grid.map((row, r) =>
      row.map((cell, c) => (r === rIdx && c === cIdx) ? { val: value } : cell)
    );

    const valUpper = value.toUpperCase();
    if (value.length >= 2 || value === '*' || valUpper === 'X') {
      let nextR = rIdx, nextC = cIdx + 1;
      if (nextC >= colsInput) {
        nextC = 0;
        nextR++;
      }

      // AUTO APPEND NEW ROW IF AT THE VERY END OF THE CHART
      if (nextR >= newGrid.length) {
        const emptyRow = Array.from({ length: colsInput }, () => ({ val: '' }));
        newGrid = [...newGrid, emptyRow];
      }

      if (saveChart) {
        saveChart(selectedChart, newGrid.length, colsInput, newGrid);
      }

      setTimeout(() => {
        const nextInput = document.getElementById(`ai-cell-${nextR}-${nextC}`);
        if (nextInput) {
          nextInput.focus();
          if (nextInput.select) nextInput.select();
        }
      }, 15);
    } else {
      if (saveChart) {
        saveChart(selectedChart, newGrid.length, colsInput, newGrid);
      }
    }
  };

  // Sync selected chart if context changes
  useEffect(() => {
    if (activeChartName && charts[activeChartName]) {
      setSelectedChart(activeChartName);
    }
  }, [activeChartName, charts]);

  // RUN UNIVERSAL SEQUENCE SCANNING ENGINE (FAST & MEMOIZED)
  const sequenceResults = useMemo(() => {
    return findSequenceMatches(grid, sequenceInput);
  }, [grid, sequenceInput]);

  // Filtered matches based on user selection in legend
  const visibleMatches = useMemo(() => {
    if (!sequenceResults || !sequenceResults.matches) return [];
    if (activeMatchFilter === 'all') return sequenceResults.matches;
    if (activeMatchFilter === 'short_range') return sequenceResults.matches.filter(m => m.isShortRangeGap);
    return sequenceResults.matches.filter(m => m.id === activeMatchFilter);
  }, [sequenceResults, activeMatchFilter]);

  // Map cells to match metadata for instant O(1) rendering lookup
  const cellMatchMap = useMemo(() => {
    const map = {};
    visibleMatches.forEach((match) => {
      match.cells.forEach((cell, stepIdx) => {
        const key = `${cell.r}_${cell.c}`;
        if (!map[key]) map[key] = [];
        map[key].push({
          matchId: match.id,
          matchNumber: match.matchNumber,
          color: match.color,
          digit: cell.digit,
          digitType: cell.digitType,
          stepIdx: stepIdx + 1,
          totalSteps: match.cells.length,
          direction: match.direction
        });
      });
    });
    return map;
  }, [visibleMatches]);

  // Map empty target cells to partial setup predictions for instant O(1) rendering lookup
  const emptyCellMap = useMemo(() => {
    const map = {};
    if (!sequenceResults || !sequenceResults.partialSetups) return map;
    sequenceResults.partialSetups.forEach((setup) => {
      const { emptyCell, cells, direction } = setup;
      const key = `${emptyCell.r}_${emptyCell.c}`;
      if (!map[key]) map[key] = [];
      map[key].push({
        setupId: setup.id,
        predictedDigit: emptyCell.predictedDigit,
        cutDigit: emptyCell.cutDigit,
        predictedDigitType: emptyCell.predictedDigitType,
        direction,
        cells
      });
    });
    return map;
  }, [sequenceResults]);

  const lastFilledRowIndex = useMemo(() => {
    for (let r = grid.length - 1; r >= 0; r--) {
      if (grid[r] && grid[r].some(cell => cell.val && cell.val !== '')) {
        return r;
      }
    }
    return Math.max(0, grid.length - 1);
  }, [grid]);

  const scrollToRowIndex = (rIdx) => {
    if (containerRef.current) {
      const targetScroll = Math.max(0, rIdx * rowHeight - 60);
      containerRef.current.scrollTo({
        top: targetScroll,
        behavior: 'smooth'
      });
    }
  };

  const totalRows = grid.length;
  const visibleHeight = typeof window !== 'undefined' ? window.innerHeight : 900;

  const handleScroll = (e) => {
    setScrollTop(e.target.scrollTop);
  };

  // Chunked virtualization: Render all rows directly for totalRows <= 250.
  // For totalRows > 250, update in 25-row chunks to eliminate per-pixel reflow jitter.
  const { startRow, endRow, topPadding, bottomPadding } = useMemo(() => {
    if (totalRows <= 250) {
      return { startRow: 0, endRow: totalRows, topPadding: 0, bottomPadding: 0 };
    }
    const chunkSize = 25;
    const currentChunk = Math.floor(scrollTop / (chunkSize * rowHeight));
    const startIndex = Math.max(0, (currentChunk - 1) * chunkSize);
    const endIndex = Math.min(totalRows, (currentChunk + 3) * chunkSize);
    const topPad = startIndex * rowHeight;
    const bottomPad = (totalRows - endIndex) * rowHeight;
    return { startRow: startIndex, endRow: endIndex, topPadding: topPad, bottomPadding: bottomPad };
  }, [scrollTop, totalRows, rowHeight]);

  const visibleRows = useMemo(() => {
    return grid.slice(startRow, endRow);
  }, [grid, startRow, endRow]);

  const chartKeys = Object.keys(charts);

  return (
    <div className="min-h-screen bg-[#f7e3c4] text-slate-950 font-poppins selection:bg-pink-500 selection:text-white pb-20">
      
      {/* CENTERED DESKTOP VIEW WITH SIDE MARGINS (MATCHING CHART EDITOR) */}
      <div className="max-w-3xl mx-auto px-1 sm:px-3 space-y-2 pt-2">
        
        {/* 1. TOP HEADER PANEL WITH CONTROLS (MATCHING CHART EDITOR UI) */}
        <div className="bg-slate-950 text-slate-100 border border-slate-800 rounded-2xl p-3 shadow-xl space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            
            {/* Active Chart Selection */}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Brain className="w-5 h-5 text-purple-400" />
                <select
                  value={selectedChart}
                  onChange={(e) => {
                    setSelectedChart(e.target.value);
                    setActiveChartName(e.target.value);
                  }}
                  className="bg-slate-900 text-amber-400 text-base sm:text-xl font-black uppercase tracking-wide rounded-xl px-2.5 py-1 outline-none border border-slate-700 cursor-pointer"
                >
                  {chartKeys.length === 0 ? (
                    <option value="NO CHARTS">NO CHARTS SAVED</option>
                  ) : (
                    chartKeys.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))
                  )}
                </select>
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                AI Pattern Engine | {grid.length} Rows × {colsInput} Cols | Row #{lastFilledRowIndex + 1}
              </div>
            </div>

            {/* Top Action Buttons (Stats ON/OFF, Compact ON/OFF, Controls Toggle) */}
            <div className="flex items-center gap-1.5 flex-wrap">
              
              {/* STATS ON / OFF BUTTON */}
              <button
                onClick={() => setShowStats(v => !v)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-black shadow transition-all active:scale-95 border ${
                  showStats ? 'bg-emerald-950 border-emerald-500 text-emerald-300' : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}
                title="Toggle Stats Display (Sum/CN/Cond)"
              >
                {showStats ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-500" />}
                <span>Stats: {showStats ? 'ON' : 'OFF'}</span>
              </button>

              {/* GO TO BOTTOM BUTTON */}
              <button
                onClick={() => scrollToRowIndex(lastFilledRowIndex)}
                className="flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1.5 rounded-xl text-xs font-black shadow transition-all active:scale-95"
              >
                <ArrowDown className="w-3.5 h-3.5" /> Go to Bottom
              </button>

              {/* CONTROLS TOGGLE BUTTON */}
              <button
                onClick={() => setShowControls(v => !v)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-black shadow transition-all active:scale-95 border ${
                  showControls ? 'bg-rose-600 border-rose-500 text-white' : 'bg-slate-900 border-slate-700 text-amber-300'
                }`}
              >
                <Settings2 className="w-3.5 h-3.5" />
                {showControls ? 'Close Controls' : 'Edit Controls'}
              </button>
            </div>
          </div>

          {/* EXPANDABLE CONTROLS PANEL */}
          {showControls && (
            <div className="pt-2 border-t border-slate-800 space-y-2 animate-fadeIn">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span>Display & Highlighting Options:</span>
                <button onClick={() => setShowControls(false)} className="text-slate-400 hover:text-white">Close ✕</button>
              </div>
              <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
                <button
                  onClick={() => setShowStats(v => !v)}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-amber-300 font-bold"
                >
                  Stats (Sum / CN / Cond): {showStats ? 'ENABLED' : 'DISABLED'}
                </button>
                <button
                  onClick={() => setIsCompact(v => !v)}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-cyan-300 font-bold"
                >
                  Row Density: {isCompact ? 'COMPACT (15+ Rows)' : 'STANDARD'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 2. FORWARD SEQUENCE SEARCH INPUT FIELD & SLNO MATCH LIST */}
        <div className="bg-slate-950 border-2 border-cyan-500/80 text-white rounded-2xl p-3.5 shadow-2xl space-y-3">
          
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <Search className="w-5 h-5 text-cyan-400" />
              <div>
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">Visual Sequence Search Engine</h3>
                <p className="text-[10px] text-slate-400">Search any 3-step sequence (e.g. "7, 8, 1" or "5, 3, 2") across entire chart</p>
              </div>
            </div>

            {/* TOTAL MATCH COUNTER BADGE */}
            <div className="flex items-center gap-2">
              <span className={`px-3.5 py-1 rounded-full text-xs font-mono font-black border shadow-md transition-all ${
                sequenceResults.totalMatches > 0
                  ? 'bg-cyan-950 border-cyan-400 text-cyan-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}>
                Found {sequenceResults.totalMatches} Matches
              </span>
            </div>
          </div>

          {/* INPUT FIELD & QUICK PRESETS */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="flex-1 relative">
              <input
                type="text"
                value={sequenceInput}
                onChange={(e) => {
                  setSequenceInput(e.target.value);
                  setActiveMatchFilter('all');
                }}
                placeholder="ENTER DIGIT SEQUENCE (e.g. 7, 8, 1)"
                className="w-full bg-slate-900 border-2 border-cyan-400 text-cyan-300 font-mono font-black text-sm sm:text-base rounded-xl px-3.5 py-2.5 outline-none shadow-inner tracking-widest uppercase placeholder-slate-600 focus:ring-2 focus:ring-cyan-400"
              />
              {sequenceInput && (
                <button
                  onClick={() => setSequenceInput('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold bg-slate-950 border border-slate-800 px-2 py-0.5 rounded-lg"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Quick Sequence Presets */}
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Presets:</span>
              {['5, 8, 0', '7, 8, 1', '5, 3, 2', '1, 2, 3'].map((preset) => (
                <button
                  key={preset}
                  onClick={() => {
                    setSequenceInput(preset);
                    setActiveMatchFilter('all');
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-black border transition ${
                    sequenceInput === preset
                      ? 'bg-cyan-600 border-cyan-400 text-white shadow-md'
                      : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* EXACT MATCH SLNO & DAY LOCATION LIST */}
          {sequenceResults.matches.length > 0 && (
            <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-xl space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2 text-xs font-bold text-slate-300">
                <span className="flex items-center gap-1.5 text-cyan-300">
                  <MapPin className="w-4 h-4 text-cyan-400" /> Match SLNO Locations & Gaps (Click to jump):
                </span>
                
                {/* Short-Range Gap Filter Toggle */}
                <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-0.5 rounded-lg">
                  <button
                    onClick={() => setActiveMatchFilter('all')}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-black ${
                      activeMatchFilter === 'all' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All ({sequenceResults.totalMatches})
                  </button>
                  <button
                    onClick={() => setActiveMatchFilter('short_range')}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-black flex items-center gap-0.5 ${
                      activeMatchFilter === 'short_range' ? 'bg-emerald-600 text-white' : 'text-emerald-400 hover:text-emerald-300'
                    }`}
                  >
                    ⚡ 5-12 Row Gaps ({sequenceResults.shortRangeMatchesCount})
                  </button>
                </div>

                <button
                  onClick={() => setShowLocationList(v => !v)}
                  className="text-[10px] text-slate-400 hover:text-white"
                >
                  {showLocationList ? 'Hide List ▲' : 'Show List ▼'}
                </button>
              </div>

              {showLocationList && (
                <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1 font-mono text-[11px]">
                  {sequenceResults.matches.map((m) => {
                    const firstCell = m.cells[0];
                    const lastCell = m.cells[m.cells.length - 1];
                    return (
                      <div
                        key={m.id}
                        onClick={() => {
                          setActiveMatchFilter(m.id);
                          scrollToRowIndex(firstCell.r);
                        }}
                        style={{ borderLeftColor: m.color }}
                        className="bg-slate-950 border-l-4 border-y border-r border-slate-800 p-2 rounded-r-xl flex items-center justify-between gap-2 hover:bg-slate-800 cursor-pointer transition"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="px-2 py-0.5 rounded text-[10px] font-black text-slate-950 uppercase"
                            style={{ backgroundColor: m.color }}
                          >
                            Match #{m.matchNumber}
                          </span>
                          <span className="text-white font-bold">
                            SLNO Row #{firstCell.r + 1} → Row #{lastCell.r + 1}
                          </span>
                          <span className="text-slate-400 text-[10px]">
                            ({m.direction})
                          </span>

                          {/* Gap Indicator Badge */}
                          {m.rowGap !== null && (
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-black ${
                              m.isShortRangeGap ? 'bg-emerald-950 border border-emerald-500 text-emerald-300' : 'bg-slate-900 text-slate-400'
                            }`}>
                              {m.isShortRangeGap ? `⚡ Gap: ${m.rowGap} Rows` : `Gap: ${m.rowGap} Rows`}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-amber-300 font-bold text-[10px]">
                            {m.cells.map((c, idx) => (
                              <span key={idx} className="mr-1">
                                {COL_HEADERS[c.c]} {c.digitType.toUpperCase()} ({c.digit}) {idx < m.cells.length - 1 ? '→' : ''}
                              </span>
                            ))}
                          </div>

                          {/* Outcome badge */}
                          {m.subsequentOutcome && (
                            <span className="bg-purple-950 border border-purple-500/60 text-purple-300 text-[9px] font-black px-1.5 py-0.5 rounded-md">
                              Next: {m.subsequentOutcome.nextVal} (O:{m.subsequentOutcome.nextOpen}/C:{m.subsequentOutcome.nextClose})
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. SUBSEQUENT OUTCOME PREDICTION & Analytics DASHBOARD */}
        {sequenceResults.totalMatches > 0 && sequenceResults.predictions && (
          <div className="bg-slate-950 border-2 border-emerald-500/80 text-white rounded-2xl p-3.5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-emerald-400">
                    Subsequent Outcome Predictor & Follow-Up Analytics
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Historical outcome frequency calculated from past sequence follow-ups
                  </p>
                </div>
              </div>

              {sequenceResults.shortRangeMatchesCount > 0 && (
                <span className="bg-emerald-950 border border-emerald-500 text-emerald-300 text-[10px] font-mono font-black px-2.5 py-1 rounded-full">
                  ⚡ 5-12 Row Gap Window Active ({sequenceResults.shortRangeMatchesCount} Matches)
                </span>
              )}
            </div>

            {/* PREDICTION SUMMARY CARDS */}
            <div className="grid grid-cols-1 xs:grid-cols-3 gap-2.5 text-center font-mono">
              
              {/* PREDICTED NEXT OPEN */}
              <div className="bg-slate-900 border border-amber-500/40 rounded-xl p-2.5 space-y-1">
                <span className="text-[10px] text-amber-400 font-bold uppercase block">Predicted Next Open</span>
                <div className="text-xl sm:text-2xl font-black text-amber-300">
                  {sequenceResults.predictions.bestOpen}
                  <span className="text-xs font-normal text-amber-500/80 ml-1">
                    (Cut: {sequenceResults.predictions.cutOpen})
                  </span>
                </div>
                <div className="text-[9px] text-slate-400">
                  {sequenceResults.predictions.topOpen.slice(0, 2).map(o => `Digit ${o.val}: ${o.percentage}%`).join(' | ') || 'No outcome data'}
                </div>
              </div>

              {/* PREDICTED NEXT CLOSE */}
              <div className="bg-slate-900 border border-purple-500/40 rounded-xl p-2.5 space-y-1">
                <span className="text-[10px] text-purple-400 font-bold uppercase block">Predicted Next Close</span>
                <div className="text-xl sm:text-2xl font-black text-purple-300">
                  {sequenceResults.predictions.bestClose}
                </div>
                <div className="text-[9px] text-slate-400">
                  {sequenceResults.predictions.topClose.slice(0, 2).map(c => `Digit ${c.val}: ${c.percentage}%`).join(' | ') || 'No outcome data'}
                </div>
              </div>

              {/* TOP PREDICTED NEXT JODI */}
              <div className="bg-slate-900 border border-emerald-500/40 rounded-xl p-2.5 space-y-1">
                <span className="text-[10px] text-emerald-400 font-bold uppercase block">Top Historical Next Jodi</span>
                <div className="text-xl sm:text-2xl font-black text-emerald-300">
                  {sequenceResults.predictions.topJodis.length > 0 ? sequenceResults.predictions.topJodis[0].val : '--'}
                </div>
                <div className="text-[9px] text-slate-400">
                  {sequenceResults.predictions.topJodis.slice(0, 2).map(j => `Jodi ${j.val} (${j.count}x)`).join(', ') || 'No outcome data'}
                </div>
              </div>
            </div>

            {/* ACTIVE 2-DIGIT PATTERN SETUPS POINTING TO EMPTY CELLS */}
            {sequenceResults.partialSetups && sequenceResults.partialSetups.length > 0 && (
              <div className="bg-slate-900 border border-pink-500/50 rounded-xl p-2.5 space-y-2 mt-2">
                <div className="flex items-center justify-between text-xs font-black text-pink-400 border-b border-pink-900/50 pb-1">
                  <span className="flex items-center gap-1.5">
                    🔮 Active 2-Digit Setups Pointing to Empty Cells ({sequenceResults.partialSetups.length} Setups)
                  </span>
                  <span className="text-[10px] text-pink-300 font-mono">Auto-Predicting Next Outcome</span>
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 font-mono text-[11px]">
                  {sequenceResults.partialSetups.map((p) => {
                    const { emptyCell, cells, direction, id } = p;
                    return (
                      <div
                        key={id}
                        onClick={() => scrollToRowIndex(emptyCell.r)}
                        className="bg-slate-950 border border-pink-900/60 p-2 rounded-lg flex items-center justify-between gap-2 hover:bg-slate-800 cursor-pointer transition"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="bg-pink-600 text-white font-black text-[9px] px-1.5 py-0.5 rounded uppercase">
                            Setup #{p.setupNumber}
                          </span>
                          <span className="text-white font-bold">
                            Row #{emptyCell.r + 1} {COL_HEADERS[emptyCell.c]}
                          </span>
                          <span className="text-pink-300 font-semibold text-[10px]">
                            ({cells.map(c => c.digit).join(' ➔ ')} ➔ [EMPTY])
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-pink-400 font-bold text-[10px]">
                            Need {emptyCell.predictedDigitType.toUpperCase()}:
                          </span>
                          <span className="bg-pink-950 border border-pink-500 text-pink-200 text-xs font-black px-2 py-0.5 rounded">
                            {emptyCell.predictedDigit} <span className="text-[9px] text-pink-400 font-normal">(Cut: {emptyCell.cutDigit})</span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. CHART EDITOR STYLE TABLE UI INTERFACE */}
        <div className="bg-slate-950 p-1 sm:p-2 rounded-2xl shadow-2xl space-y-2 border border-slate-800">
          <div
            ref={containerRef}
            onScroll={handleScroll}
            className="overflow-y-auto overflow-x-auto max-h-[calc(100vh-220px)] border border-slate-800 rounded-xl bg-white"
          >
            <div className="w-full min-w-full">
              <table className="w-full table-fixed white-chart-table">
                <thead className="sticky top-0 z-20 shadow-md bg-slate-200">
                  <tr>
                    <th className="w-7 sm:w-10 text-center border border-slate-950 bg-slate-200 p-0.5">
                      <button
                        onClick={() => scrollToRowIndex(lastFilledRowIndex)}
                        title={`Jump to row #${lastFilledRowIndex + 1}`}
                        className="w-full py-0.5 text-slate-950 font-black flex items-center justify-center text-[10px] sm:text-xs"
                      >
                        #
                      </button>
                    </th>
                    {Array.from({ length: colsInput }).map((_, c) => (
                      <th key={c} className="text-center border border-slate-950 text-slate-950 font-black text-xs sm:text-base py-0.5 sm:py-1">
                        {COL_HEADERS[c] || `C${c + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {topPadding > 0 && (
                    <tr>
                      <td colSpan={colsInput + 1} style={{ height: `${topPadding}px`, padding: 0, border: 'none' }} />
                    </tr>
                  )}

                  {visibleRows.map((row, relativeRIdx) => {
                    const rIdx = startRow + relativeRIdx;
                    return (
                      <tr key={rIdx} style={{ height: `${rowHeight}px` }}>
                        <td className="text-center font-black text-slate-950 text-[10px] sm:text-base bg-slate-100 border border-slate-950 align-middle px-0.5">
                          {rIdx + 1}
                        </td>

                        {row.map((cell, cIdx) => {
                          const val = cell.val || '';
                          const total = calculateTotal(val);
                          const diffTotal = calculateDiffTotal(val);
                          const cn = calculateCN(val);
                          const closeCond = calculateCloseCond(val);
                          const red = isRedPair(val);

                          // Look up visual sequence matches and empty cell predictions
                          const cellMatches = cellMatchMap[`${rIdx}_${cIdx}`] || [];
                          const primaryMatch = cellMatches[0] || null;

                          const emptyCellPredictions = emptyCellMap[`${rIdx}_${cIdx}`] || [];
                          const primaryEmptyPred = emptyCellPredictions[0] || null;

                          return (
                            <td
                              key={cIdx}
                              style={{
                                backgroundColor: primaryMatch ? `${primaryMatch.color}35` : (primaryEmptyPred ? '#fce7f3' : 'white'),
                                borderColor: primaryMatch ? primaryMatch.color : (primaryEmptyPred ? '#ec4899' : '#020617'),
                                borderWidth: primaryMatch || primaryEmptyPred ? '3.5px' : '1px',
                                boxShadow: primaryMatch ? `0 0 12px ${primaryMatch.color}90 inset` : (primaryEmptyPred ? '0 0 12px #ec489980 inset' : 'none')
                              }}
                              className={`relative px-0.5 py-0.5 text-center align-middle ${
                                primaryMatch ? 'z-10 bg-amber-50/50' : (primaryEmptyPred ? 'z-10 bg-pink-100/60' : '')
                              }`}
                            >
                              {/* Top stats badges (when Stats ON) */}
                              {showStats && (
                                <div className="flex justify-between items-center w-full px-0.5 leading-none pt-0.5 pointer-events-none">
                                  <span className="text-emerald-600 font-extrabold text-[9px] sm:text-xs font-mono">
                                    {total !== null ? total : ''}
                                  </span>
                                  <span className="text-red-600 font-extrabold text-[9px] sm:text-xs font-mono">
                                    {diffTotal !== null ? diffTotal : ''}
                                  </span>
                                </div>
                              )}

                              {/* Center Jodi Input (Perfectly Centered in Middle of Cell) */}
                              <div className="flex items-center justify-center my-auto relative z-10 w-full h-full">
                                <input
                                  id={`ai-cell-${rIdx}-${cIdx}`}
                                  type="text"
                                  value={val}
                                  onChange={(e) => handleAICellChange(rIdx, cIdx, e.target.value)}
                                  onFocus={(e) => e.target.select()}
                                  maxLength={2}
                                  placeholder=""
                                  className={`w-full text-center text-lg xs:text-xl sm:text-2xl md:text-3xl font-black font-mono tracking-tighter sm:tracking-wider leading-none bg-transparent border-none outline-none focus:ring-1 focus:ring-cyan-400 focus:bg-amber-100/80 rounded ${
                                    primaryMatch
                                      ? (red ? 'red-pair-text font-black drop-shadow-md' : 'text-slate-950 font-black drop-shadow-md')
                                      : (red ? 'red-pair-text' : 'text-slate-950 font-black')
                                  }`}
                                />
                              </div>

                              {/* EMPTY CELL PREDICTION OVERLAY BADGE */}
                              {primaryEmptyPred && !val && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none bg-pink-100/90 rounded border-2 border-pink-500 shadow-md p-0.5">
                                  <span className="text-[7px] sm:text-[9px] font-mono font-black text-pink-700 tracking-tighter uppercase leading-none">
                                    🔮 {primaryEmptyPred.predictedDigitType.toUpperCase()} NEEDED
                                  </span>
                                  <span className="text-sm sm:text-2xl font-black font-mono text-pink-950 leading-none mt-0.5">
                                    {primaryEmptyPred.predictedDigit} <span className="text-[9px] text-pink-700 font-bold">({primaryEmptyPred.cutDigit})</span>
                                  </span>
                                </div>
                              )}

                              {/* SIDE MATCH BADGE (Positioned at Top-Left / Side Margin so it NEVER covers the center number) */}
                              {cellMatches.length > 0 && (
                                <div className="absolute top-0.5 left-0.5 flex flex-col items-start gap-0.5 z-20 pointer-events-none">
                                  {cellMatches.map((m, idx) => (
                                    <span
                                      key={idx}
                                      style={{ backgroundColor: m.color, color: '#020617' }}
                                      className="text-[7px] font-black font-mono px-1 py-0.2 rounded-full shadow-sm leading-none border border-black/90 uppercase tracking-tighter"
                                      title={`Match #${m.matchNumber}: Step ${m.stepIdx} of ${m.totalSteps}`}
                                    >
                                      #{m.matchNumber}:S{m.stepIdx}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {/* Bottom CN & Cond (when Stats ON) */}
                              {showStats && (
                                <div className="absolute bottom-0.5 left-0 right-0 text-center text-slate-950 font-black text-[9px] sm:text-xs font-mono tracking-tighter leading-none pointer-events-none">
                                  {cn !== null && closeCond !== null ? `${cn}-${closeCond}` : ''}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}

                  {bottomPadding > 0 && (
                    <tr>
                      <td colSpan={colsInput + 1} style={{ height: `${bottomPadding}px`, padding: 0, border: 'none' }} />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* SUMMARY STATUS FOOTER */}
          <div className="bg-slate-900 border border-slate-800 p-2 rounded-xl flex items-center justify-between flex-wrap gap-2 text-xs text-slate-300">
            <div className="flex items-center gap-2 font-mono">
              <Layers className="w-4 h-4 text-purple-400" />
              <span>Target Sequence: <strong className="text-cyan-300 font-black tracking-widest">{sequenceResults.targetSeqStr || 'NONE'}</strong></span>
            </div>
            <div className="text-[11px] font-bold">
              {sequenceResults.totalMatches === 0 ? (
                <span className="text-amber-400">No matching sequence found.</span>
              ) : (
                <span className="text-emerald-400 font-black">All {sequenceResults.totalMatches} matches visually highlighted across grid!</span>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
