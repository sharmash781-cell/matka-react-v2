import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useChart, isRedPair, calculateCN, calculateCloseCond, calculateTotal, calculateDiffTotal } from '../context/ChartContext';
import { findSequenceMatches, MATCH_COLORS, parseSequenceInput } from '../ai/sequenceEngine';
import { Brain, Sparkles, Search, ChevronUp, ChevronDown, ArrowDown, Filter, Layers, Settings2, Eye, EyeOff, MapPin, Play, X, RefreshCw, BarChart2 } from 'lucide-react';

const COL_HEADERS = ['Mo', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Col 8'];
const DAY_NAMES_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const OVERSCAN = 20;

// Helper to calculate digit relation up/down/same/opposite
const matchDigitRelation = (d1, d2, relType, step) => {
  if (d1 === undefined || d2 === undefined || isNaN(d1) || isNaN(d2)) return false;
  if (relType === 'SAME') return d1 === d2;
  if (relType === 'OPPOSITE') return d2 === (d1 + 5) % 10;
  if (relType === 'UP') return d2 === (d1 + step) % 10;
  if (relType === 'DOWN') return d2 === (d1 - step + 10) % 10;
  return false;
};

// Compute jodi total
const getJodiTotal = (val) => {
  if (!val || !/^\d{2}$/.test(val)) return null;
  return (parseInt(val[0]) + parseInt(val[1])) % 10;
};

export const AILearningEngine = () => {
  const { charts = {}, activeChartName, setActiveChartName, setActiveTab, saveChart } = useChart();

  const [selectedChart, setSelectedChart] = useState(activeChartName || Object.keys(charts)[0] || 'SRIDEVI');

  // FORWARD SEQUENCE SEARCH INPUT
  const [sequenceInput, setSequenceInput] = useState('5, 8, 0');
  const [activeMatchFilter, setActiveMatchFilter] = useState('all');

  // CONTROLS & TABLE UI OPTIONS
  const [showControls, setShowControls] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [isCompact, setIsCompact] = useState(true);
  const [showLocationList, setShowLocationList] = useState(true);

  // ── AUTONOMOUS CROSS-DAY PATTERN SCANNER STATE ─────────────────────────────
  const [scanFromDay, setScanFromDay] = useState(0); // 0 = Mon
  const [scanToDay, setScanToDay] = useState(1);   // 1 = Tue
  const [rel1Type, setRel1Type] = useState('open_to_open');
  const [rel1Action, setRel1Action] = useState('UP'); // UP, DOWN, SAME, OPPOSITE
  const [rel1Step, setRel1Step] = useState(1);
  
  const [rel2Type, setRel2Type] = useState('close_to_close');
  const [rel2Action, setRel2Action] = useState('DOWN');
  const [rel2Step, setRel2Step] = useState(1);

  // Scanned results & active removable rules
  const [scanResults, setScanResults] = useState(null);
  const [activeRules, setActiveRules] = useState([]);

  // Virtualization Scroll State
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef(null);

  const activeChartObj = charts[selectedChart] || null;
  const grid = activeChartObj ? activeChartObj.data : [];
  const colsInput = activeChartObj ? activeChartObj.cols : 7;

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

  useEffect(() => {
    if (activeChartName && charts[activeChartName]) {
      setSelectedChart(activeChartName);
    }
  }, [activeChartName, charts]);

  // RUN UNIVERSAL SEQUENCE SCANNING ENGINE
  const sequenceResults = useMemo(() => {
    return findSequenceMatches(grid, sequenceInput);
  }, [grid, sequenceInput]);

  const visibleMatches = useMemo(() => {
    if (!sequenceResults || !sequenceResults.matches) return [];
    if (activeMatchFilter === 'all') return sequenceResults.matches;
    if (activeMatchFilter === 'short_range') return sequenceResults.matches.filter(m => m.isShortRangeGap);
    return sequenceResults.matches.filter(m => m.id === activeMatchFilter);
  }, [sequenceResults, activeMatchFilter]);

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

  // ── AUTONOMOUS PATTERN & OUTCOME SCANNER ALGORITHM ─────────────────────────
  const runAutonomousPatternScan = useCallback(() => {
    if (!grid || grid.length === 0) return;

    const occurrences = [];
    const fromCol = scanFromDay;
    const toCol = scanToDay;

    // Scan all rows for the relation between fromCol and toCol
    for (let r = 0; r < grid.length; r++) {
      const val1 = grid[r]?.[fromCol]?.val || '';
      // If toCol is on same row or next row if scanning across weeks
      const r2 = fromCol <= toCol ? r : r + 1;
      if (r2 >= grid.length) continue;

      const val2 = grid[r2]?.[toCol]?.val || '';
      if (!val1 || !val2 || !/^\d{2}$/.test(val1) || !/^\d{2}$/.test(val2)) continue;

      const o1 = parseInt(val1[0]), c1 = parseInt(val1[1]);
      const o2 = parseInt(val2[0]), c2 = parseInt(val2[1]);

      // Check Rel 1
      let d1_rel1, d2_rel1;
      if (rel1Type === 'open_to_open') { d1_rel1 = o1; d2_rel1 = o2; }
      else if (rel1Type === 'open_to_close') { d1_rel1 = o1; d2_rel1 = c2; }
      else if (rel1Type === 'close_to_open') { d1_rel1 = c1; d2_rel1 = o2; }
      else if (rel1Type === 'close_to_close') { d1_rel1 = c1; d2_rel1 = c2; }

      const passRel1 = matchDigitRelation(d1_rel1, d2_rel1, rel1Action, rel1Step);

      // Check Rel 2 (if specified)
      let passRel2 = true;
      if (rel2Type !== 'none') {
        let d1_rel2, d2_rel2;
        if (rel2Type === 'open_to_open') { d1_rel2 = o1; d2_rel2 = o2; }
        else if (rel2Type === 'open_to_close') { d1_rel2 = o1; d2_rel2 = c2; }
        else if (rel2Type === 'close_to_open') { d1_rel2 = c1; d2_rel2 = o2; }
        else if (rel2Type === 'close_to_close') { d1_rel2 = c1; d2_rel2 = c2; }

        passRel2 = matchDigitRelation(d1_rel2, d2_rel2, rel2Action, rel2Step);
      }

      if (passRel1 && passRel2) {
        occurrences.push({
          row1: r,
          col1: fromCol,
          val1,
          row2: r2,
          col2: toCol,
          val2,
        });
      }
    }

    // DISCOVER COMMON FOLLOW-UP OUTCOMES & TOTALS
    const outcomeCounts = {}; // key: "weekOffset_col_total" -> count
    occurrences.forEach(occ => {
      // Check 1 to 4 weeks after the occurrence
      for (let w = 1; w <= 4; w++) {
        const targetR = occ.row2 + w;
        if (targetR < grid.length) {
          for (let c = 0; c < colsInput; c++) {
            const cellVal = grid[targetR]?.[c]?.val;
            const tot = getJodiTotal(cellVal);
            if (tot !== null) {
              const key = `${w}_${c}_${tot}`;
              if (!outcomeCounts[key]) outcomeCounts[key] = { week: w, col: c, total: tot, count: 0, rows: [] };
              outcomeCounts[key].count++;
              outcomeCounts[key].rows.push(targetR + 1);
            }
          }
        }
      }
    });

    // Filter top common outcomes appearing in multiple occurrences
    const commonOutcomes = Object.values(outcomeCounts)
      .filter(item => item.count >= Math.min(2, occurrences.length))
      .sort((a, b) => b.count - a.count);

    const rel1Label = `${rel1Type.replace(/_/g, ' ')} ${rel1Step} ${rel1Action.toLowerCase()}`;
    const rel2Label = rel2Type !== 'none' ? ` & ${rel2Type.replace(/_/g, ' ')} ${rel2Step} ${rel2Action.toLowerCase()}` : '';
    const patternTitle = `${COL_HEADERS[fromCol]}→${COL_HEADERS[toCol]} ${rel1Label}${rel2Label}`;

    const newRule = {
      id: Date.now().toString(),
      label: patternTitle,
      count: occurrences.length,
      occurrences,
      commonOutcomes: commonOutcomes.slice(0, 5)
    };

    setScanResults(newRule);
    setActiveRules(prev => [...prev.filter(r => r.label !== patternTitle), newRule]);
  }, [grid, scanFromDay, scanToDay, rel1Type, rel1Action, rel1Step, rel2Type, rel2Action, rel2Step, colsInput]);

  const removeRule = (ruleId) => {
    setActiveRules(prev => prev.filter(r => r.id !== ruleId));
    if (scanResults && scanResults.id === ruleId) {
      setScanResults(null);
    }
  };

  const clearAllRules = () => {
    setActiveRules([]);
    setScanResults(null);
  };
  // ───────────────────────────────────────────────────────────────────────────

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

  const handleScroll = (e) => {
    setScrollTop(e.target.scrollTop);
  };

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
      
      {/* CENTERED DESKTOP VIEW WITH SIDE MARGINS */}
      <div className="max-w-3xl mx-auto px-1 sm:px-3 space-y-2 pt-2">
        
        {/* 1. TOP HEADER PANEL WITH CONTROLS */}
        <div className="bg-slate-950 text-slate-100 border border-slate-800 rounded-2xl p-3 shadow-xl space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            
            {/* Active Chart Selection */}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Brain className="w-5 h-5 text-purple-400 animate-pulse" />
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
                AI Pattern &amp; Outcome Discovery Engine | {grid.length} Rows × {colsInput} Cols
              </div>
            </div>

            {/* Top Action Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setShowStats(v => !v)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-black shadow transition-all active:scale-95 border ${
                  showStats ? 'bg-emerald-950 border-emerald-500 text-emerald-300' : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}
              >
                {showStats ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-500" />}
                <span>Stats: {showStats ? 'ON' : 'OFF'}</span>
              </button>

              <button
                onClick={() => scrollToRowIndex(lastFilledRowIndex)}
                className="flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1.5 rounded-xl text-xs font-black shadow transition-all active:scale-95"
              >
                <ArrowDown className="w-3.5 h-3.5" /> Go to Bottom
              </button>

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
                <span>Display Options:</span>
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

        {/* 2. AUTONOMOUS CROSS-DAY PATTERN & FOLLOW-UP OUTCOME SCANNER */}
        <div className="bg-slate-950 border-2 border-purple-500/80 text-white rounded-2xl p-3.5 shadow-2xl space-y-3">
          
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <div className="bg-gradient-to-tr from-purple-600 to-pink-600 p-1.5 rounded-xl text-white">
                <BarChart2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-purple-300">
                  Autonomous Cross-Day Pattern &amp; Outcome Scanner
                </h3>
                <p className="text-[10px] text-slate-400">
                  Select day relations &amp; up/down steps (1 to 5) to scan occurrences and discover follow-up totals
                </p>
              </div>
            </div>

            <button
              onClick={runAutonomousPatternScan}
              className="flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-3 py-1.5 rounded-xl text-xs font-black shadow-lg hover:shadow-purple-500/30 transition-all active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>SCAN CHART</span>
            </button>
          </div>

          {/* CONTROLS GRID: DAYS, RELATIONS & STEPS (1 TO 5 UP/DOWN) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
            
            {/* FROM DAY -> TO DAY SELECTORS */}
            <div className="bg-slate-900 border border-slate-800 p-2 rounded-xl space-y-1.5">
              <div className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">1. Select Days</div>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-[9px] text-slate-400 block">From Day:</label>
                  <select
                    value={scanFromDay}
                    onChange={(e) => setScanFromDay(parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 text-cyan-300 font-bold p-1 rounded-lg text-xs"
                  >
                    {DAY_NAMES_FULL.map((d, i) => (
                      <option key={i} value={i}>{d} ({COL_HEADERS[i]})</option>
                    ))}
                  </select>
                </div>
                <span className="text-purple-400 font-black text-sm mt-3">→</span>
                <div className="flex-1">
                  <label className="text-[9px] text-slate-400 block">To Day:</label>
                  <select
                    value={scanToDay}
                    onChange={(e) => setScanToDay(parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 text-cyan-300 font-bold p-1 rounded-lg text-xs"
                  >
                    {DAY_NAMES_FULL.map((d, i) => (
                      <option key={i} value={i}>{d} ({COL_HEADERS[i]})</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* RELATION 1 SELECTOR */}
            <div className="bg-slate-900 border border-slate-800 p-2 rounded-xl space-y-1.5">
              <div className="text-[10px] text-pink-400 font-bold uppercase tracking-wider">2. Relation 1 (e.g. Open to Open 1 Up)</div>
              <div className="flex items-center gap-1.5">
                <select
                  value={rel1Type}
                  onChange={(e) => setRel1Type(e.target.value)}
                  className="bg-slate-950 border border-slate-700 text-pink-300 font-bold p-1 rounded-lg text-xs flex-1"
                >
                  <option value="open_to_open">Open → Open</option>
                  <option value="open_to_close">Open → Close</option>
                  <option value="close_to_open">Close → Open</option>
                  <option value="close_to_close">Close → Close</option>
                </select>

                <select
                  value={rel1Action}
                  onChange={(e) => setRel1Action(e.target.value)}
                  className="bg-slate-950 border border-slate-700 text-amber-300 font-bold p-1 rounded-lg text-xs"
                >
                  <option value="UP">Up</option>
                  <option value="DOWN">Down</option>
                  <option value="SAME">Same</option>
                  <option value="OPPOSITE">Cut / Opp</option>
                </select>

                {(rel1Action === 'UP' || rel1Action === 'DOWN') && (
                  <select
                    value={rel1Step}
                    onChange={(e) => setRel1Step(parseInt(e.target.value))}
                    className="bg-slate-950 border border-slate-700 text-emerald-300 font-bold p-1 rounded-lg text-xs"
                  >
                    {[1, 2, 3, 4, 5].map(n => (
                      <option key={n} value={n}>{n} Step</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* RELATION 2 SELECTOR (COMPOUND CONDITION) */}
            <div className="bg-slate-900 border border-slate-800 p-2 rounded-xl space-y-1.5 sm:col-span-2">
              <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">3. Relation 2 (Optional Compound Condition)</div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <select
                  value={rel2Type}
                  onChange={(e) => setRel2Type(e.target.value)}
                  className="bg-slate-950 border border-slate-700 text-emerald-300 font-bold p-1 rounded-lg text-xs flex-1"
                >
                  <option value="none">None (Single Clause)</option>
                  <option value="close_to_close">Close → Close</option>
                  <option value="open_to_open">Open → Open</option>
                  <option value="open_to_close">Open → Close</option>
                  <option value="close_to_open">Close → Open</option>
                </select>

                {rel2Type !== 'none' && (
                  <>
                    <select
                      value={rel2Action}
                      onChange={(e) => setRel2Action(e.target.value)}
                      className="bg-slate-950 border border-slate-700 text-amber-300 font-bold p-1 rounded-lg text-xs"
                    >
                      <option value="DOWN">Down</option>
                      <option value="UP">Up</option>
                      <option value="SAME">Same</option>
                      <option value="OPPOSITE">Cut / Opp</option>
                    </select>

                    {(rel2Action === 'UP' || rel2Action === 'DOWN') && (
                      <select
                        value={rel2Step}
                        onChange={(e) => setRel2Step(parseInt(e.target.value))}
                        className="bg-slate-950 border border-slate-700 text-cyan-300 font-bold p-1 rounded-lg text-xs"
                      >
                        {[1, 2, 3, 4, 5].map(n => (
                          <option key={n} value={n}>{n} Step</option>
                        ))}
                      </select>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ACTIVE RULE BADGES (WITH REMOVABLE X BUTTONS LIKE PHOTO) */}
          {activeRules.length > 0 && (
            <div className="flex items-center justify-between flex-wrap bg-slate-900 border border-slate-800 rounded-xl p-2 gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  ACTIVE RULES ({activeRules.length}):
                </span>
                {activeRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center gap-1.5 bg-purple-950/80 border border-purple-500/70 text-purple-200 text-xs font-black font-mono px-2.5 py-1 rounded-lg shadow-sm"
                  >
                    <span className="w-2 h-2 rounded-full bg-purple-400 inline-block" />
                    <span>{rule.label}</span>
                    <span className="text-[10px] text-purple-400 font-normal">({rule.count}x)</span>
                    <button
                      onClick={() => removeRule(rule.id)}
                      className="ml-1 text-purple-400 hover:text-white hover:bg-purple-900 rounded-full p-0.5 transition"
                      title="Remove Rule"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={clearAllRules}
                className="text-[10px] font-bold text-red-400 hover:text-red-300 bg-red-950/60 border border-red-800/80 px-2 py-0.5 rounded-md transition"
              >
                Clear All Rules
              </button>
            </div>
          )}

          {/* SCAN RESULTS & DISCOVERED FOLLOW-UP OUTCOMES */}
          {scanResults && (
            <div className="bg-slate-900 border border-purple-500/50 p-3 rounded-xl space-y-2 animate-fadeIn font-mono">
              <div className="flex items-center justify-between flex-wrap text-xs text-white">
                <span className="font-bold text-purple-300">
                  🎯 Found <strong className="text-emerald-400 text-sm">{scanResults.count} Occurrences</strong> of &quot;{scanResults.label}&quot;
                </span>
                <span className="text-[10px] text-slate-400">
                  Historical Matches Across Chart
                </span>
              </div>

              {/* List of matched rows */}
              <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                <span className="text-[9px] text-slate-400 uppercase font-bold shrink-0">Rows:</span>
                {scanResults.occurrences.map((occ, idx) => (
                  <button
                    key={idx}
                    onClick={() => scrollToRowIndex(occ.row1)}
                    className="bg-slate-950 border border-slate-700 hover:border-purple-400 text-purple-300 text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 transition"
                  >
                    #{occ.row1 + 1} ({occ.val1}) → #{occ.row2 + 1} ({occ.val2})
                  </button>
                ))}
              </div>

              {/* Discovered Follow-Up Totals */}
              {scanResults.commonOutcomes.length > 0 && (
                <div className="border-t border-slate-800 pt-2 space-y-1">
                  <div className="text-[10px] text-amber-300 font-bold uppercase tracking-wider">
                    🔮 Discovered Common Follow-Up Totals (What happened AFTER?):
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {scanResults.commonOutcomes.map((out, idx) => (
                      <div
                        key={idx}
                        className="bg-slate-950 border border-slate-800 p-1.5 rounded-lg flex items-center justify-between text-[11px]"
                      >
                        <span className="text-slate-300">
                          {out.week}W After ({COL_HEADERS[out.col]}): <strong className="text-amber-400 text-xs">{out.total} Total</strong>
                        </span>
                        <span className="bg-amber-950 border border-amber-500/60 text-amber-300 text-[9px] px-1.5 py-0.2 rounded font-black">
                          {out.count} / {scanResults.count} times ({Math.round((out.count / scanResults.count) * 100)}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* 3. FORWARD SEQUENCE SEARCH INPUT FIELD & SLNO MATCH LIST */}
        <div className="bg-slate-950 border-2 border-cyan-500/80 text-white rounded-2xl p-3.5 shadow-2xl space-y-3">
          
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <Search className="w-5 h-5 text-cyan-400" />
              <div>
                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">Visual Sequence Search Engine</h3>
                <p className="text-[10px] text-slate-400">Search any 3-step sequence (e.g. "7, 8, 1" or "5, 3, 2") across entire chart</p>
              </div>
            </div>

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
                  <MapPin className="w-4 h-4 text-cyan-400" /> Match SLNO Locations &amp; Gaps (Click to jump):
                </span>
                
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

        {/* MATKA GRID */}
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
