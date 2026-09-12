import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useChart, isRedPair, calculateCN, calculateCloseCond, calculateTotal, calculateDiffTotal } from '../context/ChartContext';
import { Brain, Cpu, Sparkles, Zap, CheckCircle2, Sliders, Activity, Database, Palette, Trash2, ArrowDown, Smartphone, Monitor, MinusCircle, Search, Layers } from 'lucide-react';

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
  const [trainProgress, setTrainProgress] = useState(0);
  const [currentLoss, setCurrentLoss] = useState(0.12);
  const [lastTrainedModel, setLastTrainedModel] = useState(null);

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
  const rowHeight = isCompactMobile ? 68 : 105;

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

  const handleStartTraining = (e) => {
    e.preventDefault();
    setIsTraining(true);
    setTrainProgress(0);
    let ep = 0;

    const interval = setInterval(() => {
      ep += 5;
      setTrainProgress(Math.min(100, (ep / epochs) * 100));
      setCurrentLoss(parseFloat((0.15 / (1 + ep * 0.02)).toFixed(4)));

      if (ep >= epochs) {
        clearInterval(interval);
        setIsTraining(false);
        const model = trainAIModel(selectedChart, epochs, learningRate);
        setLastTrainedModel(model);
      }
    }, 80);
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
  const visibleHeight = 550;

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
  const activeModel = learnedModels[activeModelName] || Object.values(learnedModels)[0];

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="glass-panel p-6 md:p-8 rounded-3xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-purple-500/20 border border-purple-500/30 rounded-2xl">
            <Brain className="w-8 h-8 text-purple-400 animate-pulse" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white">AI Full-Chart Pattern Query & Discovery Engine</h2>
            <p className="text-xs text-slate-400">Ask Any Pattern Condition (e.g. Tuesday Open == Saturday Open) — AI Scans Entire Chart & Finds All Historical Matches!</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-900/90 px-4 py-2 rounded-2xl border border-slate-800">
          <Cpu className="w-4 h-4 text-purple-400" />
          <span className="text-xs font-mono font-bold text-slate-300">Active Model: <strong className="text-purple-300">{activeModelName}</strong></span>
        </div>
      </div>

      {/* AI FULL-CHART PATTERN QUERY BUILDER PANEL */}
      <div className="glass-panel p-6 rounded-3xl space-y-4 shadow-2xl border border-purple-500/40">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Search className="w-5 h-5 text-pink-400" />
          <h3 className="text-sm font-extrabold uppercase tracking-wider text-white">AI Pattern Query Builder (Full Chart Search)</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">1. First Day</label>
            <select
              value={queryDay1}
              onChange={(e) => setQueryDay1(parseInt(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-2.5 font-bold outline-none"
            >
              {COL_HEADERS.slice(0, colsInput).map((day, idx) => (
                <option key={day} value={idx}>{day}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">2. First Digit</label>
            <select
              value={queryDigit1}
              onChange={(e) => setQueryDigit1(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-2.5 font-bold outline-none"
            >
              <option value="open">Open Digit</option>
              <option value="close">Close Digit</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">3. Relationship</label>
            <select
              value={queryRelation}
              onChange={(e) => setQueryRelation(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-2.5 font-bold outline-none text-emerald-400"
            >
              <option value="same_digit">== Same Digit</option>
              <option value="same_total">Sum == Same Total</option>
              <option value="same_delta">Δ == Same Delta</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">4. Second Day</label>
            <select
              value={queryDay2}
              onChange={(e) => setQueryDay2(parseInt(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-2.5 font-bold outline-none"
            >
              {COL_HEADERS.slice(0, colsInput).map((day, idx) => (
                <option key={day} value={idx}>{day}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">5. Second Digit</label>
            <select
              value={queryDigit2}
              onChange={(e) => setQueryDigit2(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-2.5 font-bold outline-none"
            >
              <option value="open">Open Digit</option>
              <option value="close">Close Digit</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 mb-1">6. Row Distance</label>
            <select
              value={queryRowOffset}
              onChange={(e) => setQueryRowOffset(parseInt(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-2.5 font-bold outline-none"
            >
              <option value={0}>Same Week (Row 0)</option>
              <option value={1}>Next Week (Row +1)</option>
              <option value={2}>2 Weeks Down (Row +2)</option>
              <option value={-1}>Prev Week (Row -1)</option>
            </select>
          </div>
        </div>

        {/* QUERY SEARCH RESULTS BANNER & MATCHES DISPLAY */}
        {patternQueryResults && (
          <div className="bg-slate-950 border border-pink-500/50 p-4 rounded-2xl space-y-3 animate-fadeIn">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex items-center gap-2 text-xs font-bold text-white">
                <Sparkles className="w-4 h-4 text-pink-400 animate-pulse" />
                <span>
                  Query Result: <strong className="text-pink-300">{patternQueryResults.day1Name} {patternQueryResults.queryDigit1.toUpperCase()}</strong> == <strong className="text-pink-300">{patternQueryResults.day2Name} {patternQueryResults.queryDigit2.toUpperCase()}</strong>
                </span>
              </div>

              <div className="bg-pink-950 border border-pink-500/60 px-4 py-1.5 rounded-full text-xs font-mono font-extrabold text-pink-300">
                Found {patternQueryResults.totalMatches} Historical Matches Across Entire Chart!
              </div>
            </div>

            {/* List of First 6 Historical Matches */}
            {patternQueryResults.matchesList.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-2">
                {patternQueryResults.matchesList.slice(0, 6).map((m, idx) => (
                  <div key={idx} className="bg-slate-900/90 border border-slate-800 p-2 rounded-xl text-[11px] font-mono text-center">
                    <span className="text-slate-400 block text-[9px]">Row #{m.row1}</span>
                    <span className="text-emerald-400 font-bold">{m.val1}</span> → <span className="text-purple-400 font-bold">{m.val2}</span>
                    <span className="block text-[9px] text-pink-400">Digit ({m.d1Val})</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* SECTION 1: CHART SELECTION & INTERACTIVE VISUAL MARKING CANVAS */}
      <div className="glass-panel p-6 rounded-3xl space-y-5 shadow-2xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-pink-500/20 border border-pink-500/30 rounded-2xl">
              <Palette className="w-5 h-5 text-pink-400" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">1. Select Chart to Teach AI</h3>
              <p className="text-xs text-slate-400">Choose any existing chart from your stored database</p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <select
              value={selectedChart}
              onChange={(e) => {
                setSelectedChart(e.target.value);
                setActiveChartName(e.target.value);
              }}
              className="bg-slate-900 border border-slate-700 text-white rounded-xl p-3 text-xs font-extrabold outline-none focus:border-purple-500 min-w-[200px]"
            >
              {chartKeys.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>

            <button
              onClick={() => setIsCompactMobile(!isCompactMobile)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border bg-slate-900 border-slate-700 text-slate-300"
            >
              {isCompactMobile ? <Smartphone className="w-4 h-4 text-emerald-400" /> : <Monitor className="w-4 h-4 text-slate-400" />}
              <span>{isCompactMobile ? 'Mobile View' : 'Desktop View'}</span>
            </button>
          </div>
        </div>

        {/* NON-DESTRUCTIVE MARKING TOOLBAR WITH INDIVIDUAL ERASER (-) */}
        <div className="bg-purple-950/70 border border-purple-500/50 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-3">
            <span className="text-xs font-black uppercase text-purple-300 flex items-center gap-1">
              <Sparkles className="w-4 h-4 text-pink-400" /> Marker Color:
            </span>
            <div className="flex items-center gap-1.5">
              {COLOR_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => { setSelectedColor(opt.color); if (markingTool === 'eraser') setMarkingTool('highlight'); }}
                  style={{ backgroundColor: opt.color }}
                  className={`w-6 h-6 rounded-full border-2 transition transform hover:scale-110 ${
                    selectedColor === opt.color && markingTool !== 'eraser' ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-80'
                  }`}
                  title={opt.label}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => { setMarkingTool('highlight'); setFirstSelectedCell(null); }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                markingTool === 'highlight' ? 'bg-purple-600 text-white' : 'bg-slate-900 text-slate-400'
              }`}
            >
              Cell Highlight
            </button>

            <button
              onClick={() => { setMarkingTool('line'); setFirstSelectedCell(null); }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                markingTool === 'line' ? 'bg-purple-600 text-white' : 'bg-slate-900 text-slate-400'
              }`}
            >
              {firstSelectedCell ? 'Click 2nd Cell to Connect' : 'Connect Cells (Line)'}
            </button>

            <button
              onClick={() => { setMarkingTool('eraser'); setFirstSelectedCell(null); }}
              className={`flex items-center gap-1 px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                markingTool === 'eraser' ? 'bg-amber-600 text-white ring-2 ring-amber-400' : 'bg-slate-900 text-amber-300 border border-amber-500/40'
              }`}
            >
              <MinusCircle className="w-3.5 h-3.5 text-amber-300" /> Eraser / Remove (-)
            </button>

            <button
              onClick={handleClearMarkings}
              className="flex items-center gap-1 bg-red-950/80 border border-red-500/50 text-red-300 text-xs font-bold px-3.5 py-1.5 rounded-xl hover:bg-red-900 transition"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear All ({aiMarkings.length})
            </button>
          </div>
        </div>

        {/* ACTIVE MARKINGS INDIVIDUAL LIST WITH REMOVE BUTTONS (-) */}
        {aiMarkings.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 bg-slate-950/80 p-3 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-mono font-bold uppercase mr-1">Active Markings ({aiMarkings.length}):</span>
            {aiMarkings.map((m) => (
              <span
                key={m.id}
                style={{ borderColor: m.color, color: m.color }}
                className="bg-slate-900 border px-2.5 py-0.5 rounded-full text-[11px] font-mono flex items-center gap-1.5"
              >
                <span>{COL_HEADERS[m.c]} Row #{m.r + 1}</span>
                <button
                  onClick={() => removeSingleMarking(m.id)}
                  title="Remove this marking (-)"
                  className="hover:text-red-400 font-extrabold ml-1"
                >
                  -
                </button>
              </span>
            ))}
          </div>
        )}

        {/* INTERACTIVE WHITE CARD TABLE INSIDE AI ENGINE */}
        <div className="border-2 border-slate-950 rounded-2xl overflow-hidden shadow-2xl">
          <div
            ref={containerRef}
            onScroll={handleScroll}
            className="overflow-y-auto overflow-x-auto max-h-[550px] border-b border-slate-900 relative"
          >
            <div className="min-w-[480px] sm:min-w-[650px] relative">
              <table className="white-chart-table relative z-10">
                <thead className="sticky top-0 z-20 shadow-md">
                  <tr>
                    <th className="w-10 text-center border-2 border-slate-950 bg-slate-200 p-0.5">
                      <button
                        onClick={scrollToLastFilledRow}
                        title={`Jump to last filled row (#${lastFilledRowIndex + 1})`}
                        className="w-full py-0.5 text-slate-950 font-black hover:text-emerald-700 flex items-center justify-center gap-0.5 text-[11px] transition"
                      >
                        # <ArrowDown className="w-3 h-3 text-emerald-600" />
                      </button>
                    </th>
                    {Array.from({ length: colsInput }).map((_, c) => (
                      <th key={c} className="text-center border-2 border-slate-950 text-slate-950 font-black text-sm sm:text-base py-1">
                        {COL_HEADERS[c] || `Col ${c + 1}`}
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
                        <td className="text-center font-black text-slate-950 text-sm sm:text-lg bg-slate-100 border-2 border-slate-950 align-middle px-1">
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
                                borderWidth: highlightMarking ? '3px' : '2px'
                              }}
                              className={`relative px-1 py-0.5 text-center align-top min-w-[56px] sm:min-w-[85px] transition cursor-pointer hover:opacity-90 ${
                                isFirstSelected ? 'ring-4 ring-purple-500 animate-pulse' : ''
                              }`}
                            >
                              <div className="flex justify-between items-center w-full px-0.5 leading-none pt-0.5">
                                <span className="text-emerald-600 font-extrabold text-[11px] sm:text-xs font-mono">
                                  {total !== null ? total : ''}
                                </span>
                                <span className="text-red-600 font-extrabold text-[11px] sm:text-xs font-mono">
                                  {diffTotal !== null ? diffTotal : ''}
                                </span>
                              </div>

                              <div className="-mt-2 mb-2 flex items-center justify-center">
                                <span
                                  className={`w-full text-center text-2xl sm:text-3xl md:text-4xl font-black font-mono tracking-wider leading-none select-none ${
                                    red ? 'red-pair-text' : 'normal-jodi-text'
                                  }`}
                                >
                                  {val}
                                </span>
                              </div>

                              <div className="absolute bottom-1 left-0 right-0 text-center text-slate-950 font-black text-xs sm:text-sm font-mono tracking-wider leading-none">
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
        </div>

        {/* AI TRAINING & CONTEXT FIELD FORM */}
        <div className="bg-slate-900 border border-slate-800 p-4 md:p-6 rounded-3xl space-y-4 shadow-xl">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
            <Brain className="w-5 h-5 text-pink-400" />
            <div>
              <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">2. Teach Pattern to AI Engine</h3>
              <p className="text-[11px] text-slate-400">Explain your visual markings above to train the AI predictor in real-time</p>
            </div>
          </div>

          {trainingSuccessMsg && (
            <div className="bg-emerald-950/90 border border-emerald-500/60 p-3.5 rounded-2xl flex items-center justify-between gap-4 animate-fadeIn">
              <div className="flex items-center gap-3 text-emerald-300 font-bold text-xs">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>{trainingSuccessMsg}</span>
              </div>
              <button
                onClick={() => setActiveTab('predictor')}
                className="flex items-center gap-1 bg-pink-600 hover:bg-pink-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl transition shrink-0"
              >
                <Zap className="w-3.5 h-3.5" /> Predict Now
              </button>
            </div>
          )}

          <form onSubmit={handleTrainAIWithMarking} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={trainingExplanation}
              onChange={(e) => setTrainingExplanation(e.target.value)}
              placeholder={
                patternQueryResults && patternQueryResults.totalMatches > 0
                  ? `Auto-Query: ${patternQueryResults.day1Name} ${patternQueryResults.queryDigit1.toUpperCase()} == ${patternQueryResults.day2Name} ${patternQueryResults.queryDigit2.toUpperCase()} (${patternQueryResults.totalMatches} matches found)`
                  : "Explain pattern (e.g. Tuesday Open == Wednesday Close match across chart)"
              }
              className="flex-1 bg-slate-950 border border-slate-700 text-white placeholder-slate-500 rounded-xl p-3.5 text-xs font-mono outline-none focus:border-pink-500"
            />
            <button
              type="submit"
              disabled={aiMarkings.length === 0 && (!patternQueryResults || patternQueryResults.totalMatches === 0)}
              className="bg-gradient-to-r from-pink-600 to-purple-600 hover:opacity-90 disabled:opacity-50 text-white font-extrabold text-xs px-6 py-3.5 rounded-xl shadow-lg transition flex items-center justify-center gap-2 whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4 text-white" /> Train AI Engine with this Pattern
            </button>
          </form>

          {customAIPatterns.length > 0 && (
            <div className="pt-2">
              <span className="text-[11px] text-slate-400 font-mono block mb-2 font-bold uppercase">
                Learned Visual Patterns ({customAIPatterns.length}):
              </span>
              <div className="flex flex-wrap gap-2">
                {customAIPatterns.map((pat) => (
                  <div
                    key={pat.id}
                    className="bg-slate-950 border border-purple-500/40 text-purple-300 text-[11px] font-mono px-3 py-1.5 rounded-full flex items-center gap-2"
                  >
                    <Sparkles className="w-3 h-3 text-pink-400" />
                    <span><strong>{pat.chartName}</strong>: {pat.explanation}</span>
                    <button
                      onClick={() => deleteCustomAIPattern(pat.id)}
                      className="text-slate-500 hover:text-red-400 ml-1 font-bold"
                      title="Remove pattern (-)"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
