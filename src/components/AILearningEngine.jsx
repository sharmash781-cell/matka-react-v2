import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useChart, isRedPair, calculateCN, calculateCloseCond, calculateTotal, calculateDiffTotal } from '../context/ChartContext';
import { Brain, Cpu, Sparkles, Zap, CheckCircle2, Palette, Trash2, ArrowDown, Smartphone, Monitor, MinusCircle, Search, ChevronUp, ChevronDown } from 'lucide-react';

const COL_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Col 8'];
const OVERSCAN = 10;

const COLOR_OPTIONS = [
  { id: 'blue', color: '#3b82f6', label: 'Blue (Totals)' },
  { id: 'yellow', color: '#eab308', label: 'Yellow (Conditions)' },
  { id: 'red', color: '#ef4444', label: 'Red (Pairs)' },
  { id: 'cyan', color: '#06b6d4', label: 'Cyan (Steps)' },
  { id: 'green', color: '#10b981', label: 'Green (Harmonics)' }
];

export const AILearningEngine = () => {
  const { charts, activeChartName, setActiveChartName, learnedModels, activeModelName, setActiveModelName, trainAIModel, setActiveTab, saveCustomAIPattern, customAIPatterns, deleteCustomAIPattern } = useChart();

  const [selectedChart, setSelectedChart] = useState(activeChartName || Object.keys(charts)[0]);
  const [epochs, setEpochs] = useState(50);
  const [learningRate, setLearningRate] = useState(0.05);
  const [isTraining, setIsTraining] = useState(false);

  // Mobile Header Collapse & Fullscreen Modes
  const [showTopControls, setShowTopControls] = useState(true);

  // NON-DESTRUCTIVE AI MARKING CANVAS OVERLAY STATE
  const [isAIMarkingMode, setIsAIMarkingMode] = useState(true);
  const [selectedColor, setSelectedColor] = useState('#3b82f6');
  const [markingTool, setMarkingTool] = useState('highlight'); // 'highlight' | 'line' | 'eraser'
  const [firstSelectedCell, setFirstSelectedCell] = useState(null);
  const [aiMarkings, setAiMarkings] = useState(() => {
    const saved = localStorage.getItem(`matkaCustomAIMarkings_${selectedChart}`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
  });

  // FULL CHART PATTERN QUERY ENGINE STATE
  const [queryDay1, setQueryDay1] = useState(1); // 0=Mon, 1=Tue, 2=Wed...
  const [queryDigit1, setQueryDigit1] = useState('open'); // 'open' | 'close'
  const [queryRelation, setQueryRelation] = useState('same_digit'); // 'same_digit' | 'same_delta' | 'same_total'
  const [queryDay2, setQueryDay2] = useState(5); // 5=Sat
  const [queryDigit2, setQueryDigit2] = useState('open'); // 'open' | 'close'
  const [queryRowOffset, setQueryRowOffset] = useState(0); // 0 = same row, 1 = next row, etc.

  const [trainingExplanation, setTrainingExplanation] = useState('');
  const [trainingSuccessMsg, setTrainingSuccessMsg] = useState('');

  // Virtualization Scroll State
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef(null);
  const [isCompactMobile, setIsCompactMobile] = useState(true);

  const activeChartObj = charts[selectedChart] || null;
  const grid = activeChartObj ? activeChartObj.data : [];
  const colsInput = activeChartObj ? activeChartObj.cols : 7;
  const rowHeight = isCompactMobile ? 62 : 98;

  useEffect(() => {
    if (selectedChart) {
      const savedMarkings = localStorage.getItem(`matkaCustomAIMarkings_${selectedChart}`);
      if (savedMarkings) {
        try { setAiMarkings(JSON.parse(savedMarkings)); } catch (e) { setAiMarkings([]); }
      } else {
        setAiMarkings([]);
      }
    }
  }, [selectedChart]);

  useEffect(() => {
    if (selectedChart) {
      localStorage.setItem(`matkaCustomAIMarkings_${selectedChart}`, JSON.stringify(aiMarkings));
    }
  }, [aiMarkings, selectedChart]);

  // Auto-fill Pattern Query from Marked Cells
  useEffect(() => {
    const marked = aiMarkings.filter(m => m.type === 'highlight');
    if (marked.length >= 2) {
      setQueryDay1(marked[0].c);
      setQueryDay2(marked[1].c);
      setQueryRowOffset(marked[1].r - marked[0].r);
    }
  }, [aiMarkings]);

  const handleCellClickInMarkingMode = (rIdx, cIdx) => {
    if (!isAIMarkingMode) return;

    if (markingTool === 'eraser') {
      setAiMarkings(aiMarkings.filter(m => !(m.r === rIdx && m.c === cIdx)));
      return;
    }

    if (markingTool === 'highlight') {
      const existingIdx = aiMarkings.findIndex(m => m.r === rIdx && m.c === cIdx && m.type === 'highlight');
      if (existingIdx >= 0) {
        setAiMarkings(aiMarkings.filter((_, idx) => idx !== existingIdx));
      } else {
        const newMarking = { id: `m_${Date.now()}`, r: rIdx, c: cIdx, color: selectedColor, type: 'highlight' };
        setAiMarkings([...aiMarkings, newMarking]);
      }
    } else if (markingTool === 'line') {
      if (!firstSelectedCell) {
        setFirstSelectedCell({ r: rIdx, c: cIdx });
      } else {
        if (firstSelectedCell.r !== rIdx || firstSelectedCell.c !== cIdx) {
          const newLine = {
            id: `line_${Date.now()}`,
            r: firstSelectedCell.r,
            c: firstSelectedCell.c,
            type: 'line',
            color: selectedColor,
            connectedTo: { r: rIdx, c: cIdx }
          };
          setAiMarkings([...aiMarkings, newLine]);
        }
        setFirstSelectedCell(null);
      }
    }
  };

  const removeSingleMarking = (id) => {
    setAiMarkings(aiMarkings.filter(m => m.id !== id));
  };

  const handleClearMarkings = () => {
    setAiMarkings([]);
    setFirstSelectedCell(null);
  };

  // FAST FULL-CHART PATTERN QUERY FINDER ENGINE
  const patternQueryResults = useMemo(() => {
    if (!grid || grid.length < 1) return null;

    const matches = [];
    const day1Name = COL_HEADERS[queryDay1] || `Col ${queryDay1 + 1}`;
    const day2Name = COL_HEADERS[queryDay2] || `Col ${queryDay2 + 1}`;

    for (let r = 0; r < grid.length; r++) {
      const targetR = r + queryRowOffset;
      if (targetR >= 0 && targetR < grid.length) {
        const val1 = grid[r][queryDay1]?.val;
        const val2 = grid[targetR][queryDay2]?.val;

        if (val1 && /^\d{2}$/.test(val1) && val2 && /^\d{2}$/.test(val2)) {
          const d1Val = queryDigit1 === 'open' ? parseInt(val1[0]) : parseInt(val1[1]);
          const d2Val = queryDigit2 === 'open' ? parseInt(val2[0]) : parseInt(val2[1]);

          let isMatch = false;
          if (queryRelation === 'same_digit') {
            isMatch = (d1Val === d2Val);
          } else if (queryRelation === 'same_total') {
            isMatch = (calculateTotal(val1) === calculateTotal(val2));
          } else if (queryRelation === 'same_delta') {
            isMatch = ((d2Val - d1Val + 10) % 10 === 0);
          }

          if (isMatch) {
            matches.push({
              row1: r + 1,
              row2: targetR + 1,
              val1,
              val2,
              d1Val,
              d2Val
            });
          }
        }
      }
    }

    return {
      day1Name,
      day2Name,
      queryDigit1,
      queryDigit2,
      queryRelation,
      queryRowOffset,
      totalMatches: matches.length,
      matchesList: matches
    };
  }, [grid, queryDay1, queryDigit1, queryRelation, queryDay2, queryDigit2, queryRowOffset]);

  const handleTrainAIWithMarking = (e) => {
    e.preventDefault();
    if (aiMarkings.length === 0 && (!patternQueryResults || patternQueryResults.totalMatches === 0)) return;

    let explanation = trainingExplanation.trim();
    if (!explanation && patternQueryResults) {
      explanation = `Pattern Query (${patternQueryResults.day1Name} ${patternQueryResults.queryDigit1.toUpperCase()} == ${patternQueryResults.day2Name} ${patternQueryResults.queryDigit2.toUpperCase()}): Found ${patternQueryResults.totalMatches} historical occurrences across full chart`;
    } else if (!explanation) {
      explanation = `Trained visual pattern with ${aiMarkings.length} cell markings`;
    }

    const pattern = saveCustomAIPattern({
      name: `Pattern Query (${selectedChart})`,
      chartName: selectedChart,
      explanation,
      markings: aiMarkings,
      queryResults: patternQueryResults
    });

    trainAIModel(selectedChart, epochs, learningRate);

    setTrainingSuccessMsg(`AI Engine learned & trained pattern: "${pattern.explanation}"!`);
    setTrainingExplanation('');
    setTimeout(() => setTrainingSuccessMsg(''), 4000);
  };

  const lastFilledRowIndex = useMemo(() => {
    for (let r = grid.length - 1; r >= 0; r--) {
      if (grid[r] && grid[r].some(cell => cell.val && cell.val !== '')) {
        return r;
      }
    }
    return Math.max(0, grid.length - 1);
  }, [grid]);

  const scrollToLastFilledRow = () => {
    if (containerRef.current) {
      const targetScroll = Math.max(0, lastFilledRowIndex * rowHeight - 60);
      containerRef.current.scrollTo({
        top: targetScroll,
        behavior: 'smooth'
      });
    }
  };

  const totalRows = grid.length;
  const visibleHeight = 800;

  const handleScroll = (e) => {
    setScrollTop(e.target.scrollTop);
  };

  const { startRow, endRow, topPadding, bottomPadding } = useMemo(() => {
    if (totalRows <= 40) {
      return { startRow: 0, endRow: totalRows, topPadding: 0, bottomPadding: 0 };
    }
    const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN);
    const endIndex = Math.min(totalRows, Math.ceil((scrollTop + visibleHeight) / rowHeight) + OVERSCAN);
    const topPad = startIndex * rowHeight;
    const bottomPad = (totalRows - endIndex) * rowHeight;
    return { startRow: startIndex, endRow: endIndex, topPadding: topPad, bottomPadding: bottomPad };
  }, [scrollTop, totalRows, rowHeight]);

  const visibleRows = useMemo(() => {
    return grid.slice(startRow, endRow);
  }, [grid, startRow, endRow]);

  const markingsMap = useMemo(() => {
    const map = {};
    aiMarkings.forEach(m => {
      const key = `${m.r}_${m.c}`;
      if (!map[key]) map[key] = [];
      map[key].push(m);
    });
    return map;
  }, [aiMarkings]);

  const chartKeys = Object.keys(charts);

  return (
    <div className="space-y-3">
      {/* Top Header Toggle Bar */}
      <div className="flex justify-between items-center bg-slate-900/90 border border-slate-800 px-3 py-2 rounded-2xl">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-purple-400" />
          <select
            value={selectedChart}
            onChange={(e) => {
              setSelectedChart(e.target.value);
              setActiveChartName(e.target.value);
            }}
            className="bg-slate-950 text-white text-xs font-extrabold rounded-lg px-2 py-1 outline-none border border-slate-700 cursor-pointer"
          >
            {chartKeys.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTopControls(!showTopControls)}
            className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 px-2.5 py-1 rounded-xl text-[11px] font-bold transition"
          >
            {showTopControls ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            <span>{showTopControls ? 'Hide Controls' : 'Show Controls'}</span>
          </button>

          <button
            onClick={scrollToLastFilledRow}
            className="flex items-center gap-1 bg-emerald-950 border border-emerald-500/50 text-emerald-300 px-2.5 py-1 rounded-xl text-[11px] font-bold"
          >
            <ArrowDown className="w-3.5 h-3.5 text-emerald-400" /> #{lastFilledRowIndex + 1}
          </button>
        </div>
      </div>

      {/* COLLAPSIBLE AI PATTERN QUERY BUILDER PANEL */}
      {showTopControls && (
        <div className="glass-panel p-3.5 md:p-5 rounded-3xl space-y-3 shadow-xl border border-purple-500/40 animate-fadeIn">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <Search className="w-4 h-4 text-pink-400" />
            <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white">AI Full-Chart Pattern Query Builder</h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-0.5">1. First Day</label>
              <select
                value={queryDay1}
                onChange={(e) => setQueryDay1(parseInt(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg p-1.5 font-bold outline-none text-xs"
              >
                {COL_HEADERS.slice(0, colsInput).map((day, idx) => (
                  <option key={day} value={idx}>{day}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-0.5">2. First Digit</label>
              <select
                value={queryDigit1}
                onChange={(e) => setQueryDigit1(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg p-1.5 font-bold outline-none text-xs"
              >
                <option value="open">Open Digit</option>
                <option value="close">Close Digit</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-0.5">3. Relationship</label>
              <select
                value={queryRelation}
                onChange={(e) => setQueryRelation(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg p-1.5 font-bold outline-none text-xs text-emerald-400"
              >
                <option value="same_digit">== Same Digit</option>
                <option value="same_total">Sum == Same Total</option>
                <option value="same_delta">Δ == Same Delta</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-0.5">4. Second Day</label>
              <select
                value={queryDay2}
                onChange={(e) => setQueryDay2(parseInt(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg p-1.5 font-bold outline-none text-xs"
              >
                {COL_HEADERS.slice(0, colsInput).map((day, idx) => (
                  <option key={day} value={idx}>{day}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-0.5">5. Second Digit</label>
              <select
                value={queryDigit2}
                onChange={(e) => setQueryDigit2(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg p-1.5 font-bold outline-none text-xs"
              >
                <option value="open">Open Digit</option>
                <option value="close">Close Digit</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-0.5">6. Row Distance</label>
              <select
                value={queryRowOffset}
                onChange={(e) => setQueryRowOffset(parseInt(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg p-1.5 font-bold outline-none text-xs"
              >
                <option value={0}>Same Week (Row 0)</option>
                <option value={1}>Next Week (Row +1)</option>
                <option value={2}>2 Weeks Down (Row +2)</option>
                <option value={-1}>Prev Week (Row -1)</option>
              </select>
            </div>
          </div>

          {/* QUERY SEARCH RESULTS BANNER */}
          {patternQueryResults && (
            <div className="bg-slate-950 border border-pink-500/50 p-2.5 rounded-xl space-y-2">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1.5">
                <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                  <Sparkles className="w-3.5 h-3.5 text-pink-400 animate-pulse" />
                  <span>
                    Query Result: <strong className="text-pink-300">{patternQueryResults.day1Name} {patternQueryResults.queryDigit1.toUpperCase()}</strong> == <strong className="text-pink-300">{patternQueryResults.day2Name} {patternQueryResults.queryDigit2.toUpperCase()}</strong>
                  </span>
                </div>

                <div className="bg-pink-950 border border-pink-500/60 px-3 py-1 rounded-full text-[11px] font-mono font-extrabold text-pink-300">
                  Found {patternQueryResults.totalMatches} Historical Matches Across Entire Chart!
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MARKER TOOLBAR */}
      <div className="bg-purple-950/70 border border-purple-500/50 p-2.5 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-black uppercase text-purple-300 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-pink-400" /> Color:
          </span>
          <div className="flex items-center gap-1">
            {COLOR_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => { setSelectedColor(opt.color); if (markingTool === 'eraser') setMarkingTool('highlight'); }}
                style={{ backgroundColor: opt.color }}
                className={`w-5 h-5 rounded-full border-2 transition ${
                  selectedColor === opt.color && markingTool !== 'eraser' ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-80'
                }`}
                title={opt.label}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { setMarkingTool('highlight'); setFirstSelectedCell(null); }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
              markingTool === 'highlight' ? 'bg-purple-600 text-white' : 'bg-slate-900 text-slate-400'
            }`}
          >
            Highlight
          </button>

          <button
            onClick={() => { setMarkingTool('line'); setFirstSelectedCell(null); }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
              markingTool === 'line' ? 'bg-purple-600 text-white' : 'bg-slate-900 text-slate-400'
            }`}
          >
            Line
          </button>

          <button
            onClick={() => { setMarkingTool('eraser'); setFirstSelectedCell(null); }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold ${
              markingTool === 'eraser' ? 'bg-amber-600 text-white' : 'bg-slate-900 text-amber-300'
            }`}
          >
            <MinusCircle className="w-3 h-3 text-amber-300" /> Eraser (-)
          </button>

          <button
            onClick={handleClearMarkings}
            className="flex items-center gap-1 bg-red-950 text-red-300 text-[11px] font-bold px-2.5 py-1 rounded-lg"
          >
            <Trash2 className="w-3 h-3" /> Clear ({aiMarkings.length})
          </button>
        </div>
      </div>

      {/* INTERACTIVE FULL-WIDTH MOBILE FIT WHITE CARD TABLE */}
      <div className="glass-panel p-1 sm:p-3 rounded-2xl sm:rounded-3xl shadow-2xl space-y-2">
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="overflow-y-auto overflow-x-auto h-[calc(100vh-210px)] min-h-[500px] border-2 border-slate-950 rounded-xl bg-slate-950"
        >
          <div className="w-full min-w-full">
            <table className="w-full table-fixed white-chart-table">
              <thead className="sticky top-0 z-20 shadow-md">
                <tr>
                  <th className="w-7 sm:w-10 text-center border border-slate-950 bg-slate-200 p-0.5">
                    <button
                      onClick={scrollToLastFilledRow}
                      title={`Jump to last filled row (#${lastFilledRowIndex + 1})`}
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

                        const cellMarkings = markingsMap[`${rIdx}_${cIdx}`] || [];
                        const highlightMarking = cellMarkings.find(m => m.type === 'highlight');
                        const isFirstSelected = firstSelectedCell?.r === rIdx && firstSelectedCell?.c === cIdx;

                        return (
                          <td
                            key={cIdx}
                            onClick={() => handleCellClickInMarkingMode(rIdx, cIdx)}
                            style={{
                              backgroundColor: highlightMarking ? `${highlightMarking.color}35` : 'white',
                              borderColor: highlightMarking ? highlightMarking.color : '#020617',
                              borderWidth: highlightMarking ? '3px' : '1px'
                            }}
                            className={`relative px-0.5 py-0.5 text-center align-top cursor-pointer hover:opacity-90 ${
                              isFirstSelected ? 'ring-2 ring-purple-500 animate-pulse' : ''
                            }`}
                          >
                            <div className="flex justify-between items-center w-full px-0.5 leading-none pt-0.5">
                              <span className="text-emerald-600 font-extrabold text-[9px] sm:text-xs font-mono">
                                {total !== null ? total : ''}
                              </span>
                              <span className="text-red-600 font-extrabold text-[9px] sm:text-xs font-mono">
                                {diffTotal !== null ? diffTotal : ''}
                              </span>
                            </div>

                            <div className="-mt-1 mb-1 flex items-center justify-center">
                              <span
                                className={`w-full text-center text-lg xs:text-xl sm:text-3xl md:text-4xl font-black font-mono tracking-tighter sm:tracking-wider leading-none select-none ${
                                  red ? 'red-pair-text' : 'normal-jodi-text'
                                }`}
                              >
                                {val}
                              </span>
                            </div>

                            <div className="absolute bottom-0.5 left-0 right-0 text-center text-slate-950 font-black text-[9px] sm:text-xs font-mono tracking-tighter leading-none">
                              {cn !== null && closeCond !== null ? `${cn}-${closeCond}` : ''}
                            </div>
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

        {/* AI TRAINING INPUT & EXPLANATION FORM */}
        <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl space-y-2">
          {trainingSuccessMsg && (
            <div className="bg-emerald-950 border border-emerald-500 p-2 rounded-xl flex items-center justify-between text-xs font-bold text-emerald-300">
              <span>{trainingSuccessMsg}</span>
              <button onClick={() => setActiveTab('predictor')} className="bg-pink-600 px-2 py-1 rounded text-[10px] text-white">Predict</button>
            </div>
          )}

          <form onSubmit={handleTrainAIWithMarking} className="flex gap-2">
            <input
              type="text"
              value={trainingExplanation}
              onChange={(e) => setTrainingExplanation(e.target.value)}
              placeholder="Explain pattern to train AI (e.g. Tuesday Open == Saturday Open)"
              className="flex-1 bg-slate-950 border border-slate-700 text-white placeholder-slate-500 rounded-lg p-2 text-xs font-mono outline-none"
            />
            <button
              type="submit"
              disabled={aiMarkings.length === 0 && (!patternQueryResults || patternQueryResults.totalMatches === 0)}
              className="bg-gradient-to-r from-pink-600 to-purple-600 text-white font-extrabold text-xs px-3 py-2 rounded-lg shadow-md shrink-0"
            >
              Train AI
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
