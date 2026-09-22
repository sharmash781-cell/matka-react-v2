import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useChart, isRedPair } from '../context/ChartContext';
import { parseQuery, queryChart, analyzeCellOrigin } from '../ai/queryEngine';
import { Search, Sparkles, Filter, Eye, Layers, ArrowRight, HelpCircle, Check, X, Target } from 'lucide-react';

const COL_HEADERS = ['Mo', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Col 8'];
const OVERSCAN = 150;

// Up to 5 vibrant color themes for active highlighted families
const PALETTES = [
  { id: 'cyan',   name: 'Cyan',   exact: '#06b6d4', member: '#67e8f9', bg: 'bg-cyan-950',   text: 'text-cyan-300',   dot: 'bg-cyan-400' },
  { id: 'purple', name: 'Purple', exact: '#a855f7', member: '#c084fc', bg: 'bg-purple-950', text: 'text-purple-300', dot: 'bg-purple-400' },
  { id: 'emerald',name: 'Emerald',exact: '#10b981', member: '#6ee7b7', bg: 'bg-emerald-950',text: 'text-emerald-300',dot: 'bg-emerald-400' },
  { id: 'amber',  name: 'Amber',  exact: '#f59e0b', member: '#fcd34d', bg: 'bg-amber-950',  text: 'text-amber-300',  dot: 'bg-amber-400' },
  { id: 'pink',   name: 'Pink',   exact: '#ec4899', member: '#f472b6', bg: 'bg-pink-950',   text: 'text-pink-300',   dot: 'bg-pink-400' }
];

// Helper to compute all 8 family jodis (cut, reverse, cut-reverse, etc.)
const getJodiFamily = (jodiStr) => {
  if (!jodiStr || !/^\d{2}$/.test(jodiStr)) return new Set();
  const o = parseInt(jodiStr[0], 10);
  const c = parseInt(jodiStr[1], 10);

  const cut = (d) => (d + 5) % 10;

  const f1 = `${o}${c}`;          // direct
  const f2 = `${cut(o)}${c}`;     // open cut
  const f3 = `${o}${cut(c)}`;     // close cut
  const f4 = `${cut(o)}${cut(c)}`;// double cut

  const f5 = `${c}${o}`;          // reverse
  const f6 = `${cut(c)}${o}`;     // reverse open cut
  const f7 = `${c}${cut(o)}`;     // reverse close cut
  const f8 = `${cut(c)}${cut(o)}`;// reverse double cut

  return new Set([f1, f2, f3, f4, f5, f6, f7, f8]);
};

export const ChartFinder = () => {
  const { charts = {}, activeChartName, setActiveChartName } = useChart();
  const [selectedChart, setSelectedChart] = useState(activeChartName || Object.keys(charts)[0] || 'MAIN BAZAR');

  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredPairId, setHoveredPairId] = useState(null);
  const [selectedPairId, setSelectedPairId] = useState(null);

  // SEQUENCE TOTAL OPTIONS STATE
  const [seqGap, setSeqGap] = useState(0);
  const [seqDirection, setSeqDirection] = useState('both');

  // OPEN-CLOSE FINDER ENGINE STATE
  const [openCloseMode, setOpenCloseMode] = useState(false);
  const [selectedTargetRow, setSelectedTargetRow] = useState(1);
  const [selectedTargetCol, setSelectedTargetCol] = useState(0); // 0 = Mon
  const [originResult, setOriginResult] = useState(null);

  // MULTI-FAMILY HIGHLIGHT STATE (Up to 5 active families with distinct color palettes)
  const [activeFamilies, setActiveFamilies] = useState([]);

  // PRESS-AND-HOLD GESTURE STATE (1000ms threshold)
  const [pressingCell, setPressingCell] = useState(null); // format: `${r}_${c}`
  const [pressProgress, setPressProgress] = useState(0);  // 0 -> 100%
  const pressTimerRef = useRef(null);
  const progressAnimRef = useRef(null);

  const containerRef = useRef(null);
  const matchesBarRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);

  const activeChartObj = charts[selectedChart] || null;
  const grid = activeChartObj ? activeChartObj.data : [];
  const colsInput = activeChartObj ? activeChartObj.cols : 7;
  const rowHeight = 38;

  // Toggle or add a family to active state
  const toggleJodiFamily = useCallback((jodiStr) => {
    if (!jodiStr || !/^\d{2}$/.test(jodiStr)) return;

    setActiveFamilies((prev) => {
      const existingIdx = prev.findIndex((f) => f.jodi === jodiStr);
      if (existingIdx !== -1) {
        return prev.filter((f) => f.jodi !== jodiStr);
      }
      if (prev.length >= 5) {
        const nextPalette = prev[0].colorObj;
        const newFam = {
          jodi: jodiStr,
          familySet: getJodiFamily(jodiStr),
          colorObj: nextPalette
        };
        return [...prev.slice(1), newFam];
      }

      const usedPaletteIds = new Set(prev.map((f) => f.colorObj.id));
      const availablePalette = PALETTES.find((p) => !usedPaletteIds.has(p.id)) || PALETTES[prev.length % PALETTES.length];

      return [
        ...prev,
        {
          jodi: jodiStr,
          familySet: getJodiFamily(jodiStr),
          colorObj: availablePalette
        }
      ];
    });
  }, []);

  const removeFamily = useCallback((jodiStr) => {
    setActiveFamilies((prev) => prev.filter((f) => f.jodi !== jodiStr));
  }, []);

  const clearAllFamilies = useCallback(() => {
    setActiveFamilies([]);
  }, []);

  // PRESS-AND-HOLD HANDLERS
  const startPressTimer = (rIdx, cIdx, cellVal) => {
    if (!cellVal || !/^\d{2}$/.test(cellVal)) return;

    cancelPressTimer();
    const cellKey = `${rIdx}_${cIdx}`;
    setPressingCell(cellKey);
    setPressProgress(0);

    const startTime = Date.now();
    const duration = 1000;

    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, (elapsed / duration) * 100);
      setPressProgress(pct);

      if (pct < 100) {
        progressAnimRef.current = requestAnimationFrame(updateProgress);
      }
    };
    progressAnimRef.current = requestAnimationFrame(updateProgress);

    pressTimerRef.current = setTimeout(() => {
      toggleJodiFamily(cellVal);
      cancelPressTimer();
    }, duration);
  };

  const cancelPressTimer = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    if (progressAnimRef.current) {
      cancelAnimationFrame(progressAnimRef.current);
      progressAnimRef.current = null;
    }
    setPressingCell(null);
    setPressProgress(0);
  };

  // Run natural language NLP query parser on active grid
  const queryResult = useMemo(() => {
    if (!grid || grid.length === 0) return { matches: [], isRelational: false, stats: {} };
    return queryChart(grid, searchQuery, { gap: seqGap, direction: seqDirection });
  }, [grid, searchQuery, seqGap, seqDirection]);

  const { matches = [], parsedFilter, isRelational = false, stats = {}, relationalGroups = [] } = queryResult;

  const matchMap = useMemo(() => {
    const map = {};
    matches.forEach((m) => {
      map[`${m.r}_${m.c}`] = m;
    });
    return map;
  }, [matches]);

  const isHoliday = (val) => {
    if (!val) return false;
    const v = val.toUpperCase();
    return v === '*' || v === 'X' || v === '**';
  };

  const handleScroll = (e) => {
    setScrollTop(e.target.scrollTop);
  };

  const scrollToRowIndex = useCallback((rIdx) => {
    if (containerRef.current) {
      const targetScroll = Math.max(0, rIdx * rowHeight - 80);
      containerRef.current.scrollTo({ top: targetScroll, behavior: 'smooth' });
    }
  }, [rowHeight]);

  const runOriginAnalysis = useCallback((rIdx, cIdx) => {
    if (rIdx === undefined || cIdx === undefined || rIdx < 0 || !grid[rIdx]) return;
    const res = analyzeCellOrigin(grid, rIdx, cIdx);
    setOriginResult(res);
    setSelectedTargetRow(rIdx + 1);
    setSelectedTargetCol(cIdx);
    setOpenCloseMode(true);
    scrollToRowIndex(rIdx);
  }, [grid, scrollToRowIndex]);

  useEffect(() => {
    if (matches && matches.length > 0 && matches[0].r !== undefined) {
      scrollToRowIndex(matches[0].r);
    }
  }, [searchQuery, matches.length, scrollToRowIndex]);

  // Auto-scroll matches bar to the right (latest occurrences) when matches change
  useEffect(() => {
    if (matchesBarRef.current && matches.length > 0) {
      matchesBarRef.current.scrollLeft = matchesBarRef.current.scrollWidth;
    }
  }, [matches]);

  const presetQueries = [
    'open-close finder',
    'sequence totals',
    'master game',
    'close double',
    '03 family',
    '56 falti',
    'mon open to open same and close to close one down',
    'wed 9 total near 6 total'
  ];

  const totalRows = grid.length;

  const { startRow, endRow, topPadding, bottomPadding } = useMemo(() => {
    if (totalRows <= 1000) {
      return { startRow: 0, endRow: totalRows, topPadding: 0, bottomPadding: 0 };
    }
    const chunkSize = 50;
    const currentChunk = Math.floor(scrollTop / (chunkSize * rowHeight));
    const startIndex = Math.max(0, (currentChunk - 2) * chunkSize);
    const endIndex = Math.min(totalRows, (currentChunk + 4) * chunkSize);
    const topPad = startIndex * rowHeight;
    const bottomPad = (totalRows - endIndex) * rowHeight;
    return { startRow: startIndex, endRow: endIndex, topPadding: topPad, bottomPadding: bottomPad };
  }, [scrollTop, totalRows, rowHeight]);

  const visibleRows = useMemo(() => {
    return grid.slice(startRow, endRow);
  }, [grid, startRow, endRow]);

  const activeMatchMap = useMemo(() => {
    if (originResult && originResult.matchMap) {
      return { ...matchMap, ...originResult.matchMap };
    }
    return matchMap;
  }, [matchMap, originResult]);

  const getCellFamilyInfo = useCallback((val) => {
    if (!val || activeFamilies.length === 0) return null;
    for (const fam of activeFamilies) {
      if (val === fam.jodi) {
        return { isExact: true, colorObj: fam.colorObj, jodi: fam.jodi };
      }
      if (fam.familySet.has(val)) {
        return { isExact: false, colorObj: fam.colorObj, jodi: fam.jodi };
      }
    }
    return null;
  }, [activeFamilies]);

  return (
    <div className="max-w-7xl mx-auto space-y-3 p-1.5 sm:p-4 text-slate-100 font-poppins">
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 shadow-xl space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="bg-gradient-to-tr from-pink-600 to-purple-600 p-2 sm:p-2.5 rounded-xl text-white shadow-md shrink-0">
              <Search className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse" />
            </div>
            <div className="flex-1 sm:flex-initial">
              <label className="text-[10px] text-pink-400 font-black uppercase tracking-widest block mb-0.5">
                Active Chart
              </label>
              <select
                value={selectedChart}
                onChange={(e) => {
                  setSelectedChart(e.target.value);
                  if (setActiveChartName) setActiveChartName(e.target.value);
                  setOriginResult(null);
                }}
                className="w-full sm:w-auto bg-slate-900 border-2 border-pink-500/80 text-pink-300 text-base sm:text-xl font-black font-mono px-3.5 py-1.5 rounded-xl outline-none focus:ring-2 focus:ring-pink-500 shadow-lg cursor-pointer transition hover:border-pink-400"
              >
                {Object.keys(charts).map((chartKey) => (
                  <option key={chartKey} value={chartKey} className="bg-slate-950 text-white font-bold text-sm">
                    {chartKey} ({charts[chartKey]?.data?.length || 0} rows)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-pink-400" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value.toLowerCase().includes('open-close')) {
                setOpenCloseMode(true);
                runOriginAnalysis(grid.length - 1, 0);
              }
            }}
            placeholder='Type search in English e.g. "open-close finder", "sequence totals", "master game"...'
            className="w-full pl-9 pr-24 py-2.5 bg-slate-900 border-2 border-pink-500/80 focus:border-pink-400 rounded-xl text-xs sm:text-sm font-mono text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-pink-500/40 shadow-inner transition"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(''); setOriginResult(null); setOpenCloseMode(false); }}
              className="absolute inset-y-0 right-2 my-auto text-[10px] font-bold text-slate-400 hover:text-white bg-slate-800 px-2 py-0.5 rounded-md h-6"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider shrink-0 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" /> Try:
          </span>
          {presetQueries.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => {
                setSearchQuery(preset);
                if (preset === 'open-close finder') {
                  setOpenCloseMode(true);
                  runOriginAnalysis(grid.length - 1, 0);
                }
              }}
              className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full transition whitespace-nowrap border ${
                searchQuery === preset || (preset === 'open-close finder' && openCloseMode)
                  ? 'bg-pink-600 text-white border-pink-400 shadow-md'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              &quot;{preset}&quot;
            </button>
          ))}
        </div>

        {/* SEQUENCE TOTAL OPTIONS SELECTOR BAR */}
        {(searchQuery.toLowerCase().includes('sequence') || searchQuery.toLowerCase().includes('serial total')) && (
          <div className="bg-slate-900 border border-purple-500/60 rounded-xl p-2.5 space-y-2 shadow-xl animate-fadeIn">
            <div className="flex items-center justify-between flex-wrap gap-2 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="text-base">🔢</span>
                <span className="font-black text-purple-300 uppercase tracking-wider">
                  Sequence Total Gap & Direction Controls
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                Current Gap: <strong className="text-amber-300 font-bold">{seqGap} Cell(s)</strong> {seqGap === 0 ? '(Direct Day-by-Day)' : `(${seqGap} Middle Cell Skipped)`}
              </span>
            </div>

            <div className="flex items-center gap-3 flex-wrap text-xs font-mono">
              {/* GAP STEP COUNTER WITH - AND + BUTTONS */}
              <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-purple-900 shadow-sm">
                <span className="text-slate-300 font-bold text-[11px]">Cell Gap:</span>
                <button
                  onClick={() => setSeqGap(prev => Math.max(0, prev - 1))}
                  className="w-6 h-6 rounded bg-slate-800 hover:bg-purple-950 hover:border-purple-500 border border-slate-700 text-white font-black text-sm flex items-center justify-center active:scale-95 transition cursor-pointer"
                  title="Decrease Gap (-1)"
                >
                  -
                </button>
                <span className="w-8 text-center text-amber-300 font-black text-sm bg-slate-900 px-1 py-0.5 rounded border border-slate-800">
                  {seqGap}
                </span>
                <button
                  onClick={() => setSeqGap(prev => Math.min(5, prev + 1))}
                  className="w-6 h-6 rounded bg-slate-800 hover:bg-purple-950 hover:border-purple-500 border border-slate-700 text-white font-black text-sm flex items-center justify-center active:scale-95 transition cursor-pointer"
                  title="Increase Gap (+1)"
                >
                  +
                </button>
              </div>

              {/* DIRECTION PILLS */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-purple-900 shadow-sm">
                <span className="text-slate-400 font-bold text-[10px] px-1">Direction:</span>
                {[
                  { id: 'both', label: 'Both (Row & Col)' },
                  { id: 'horizontal', label: 'Horizontal (Rows)' },
                  { id: 'vertical', label: 'Vertical (Cols)' }
                ].map(dir => (
                  <button
                    key={dir.id}
                    onClick={() => setSeqDirection(dir.id)}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition cursor-pointer ${
                      seqDirection === dir.id
                        ? 'bg-purple-600 text-white shadow font-extrabold'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    {dir.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* OPEN-CLOSE FINDER SELECTOR BAR */}
        {openCloseMode && (
          <div className="bg-slate-900 border border-cyan-500/50 rounded-xl p-3 space-y-2 shadow-xl animate-fadeIn">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-cyan-400 animate-pulse" />
                <span className="text-xs font-black text-cyan-300 uppercase tracking-wider font-mono">
                  Open-Close Pattern Origin Finder
                </span>
              </div>
              <button
                onClick={() => { setOpenCloseMode(false); setOriginResult(null); }}
                className="text-[10px] font-bold bg-slate-800 text-slate-400 hover:text-white px-2 py-0.5 rounded border border-slate-700"
              >
                Close Finder ✕
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
              <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                <span className="text-slate-400 font-bold">Row #:</span>
                <input
                  type="number"
                  min="1"
                  max={grid.length}
                  value={selectedTargetRow}
                  onChange={(e) => {
                    const rVal = parseInt(e.target.value, 10);
                    if (!isNaN(rVal) && rVal >= 1 && rVal <= grid.length) {
                      setSelectedTargetRow(rVal);
                    }
                  }}
                  className="w-16 bg-slate-900 text-amber-300 font-black font-mono text-center rounded px-1 border border-slate-700"
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                <span className="text-slate-400 font-bold">Day:</span>
                {['Mo', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].slice(0, colsInput).map((dName, dIdx) => (
                  <button
                    key={dIdx}
                    onClick={() => {
                      setSelectedTargetCol(dIdx);
                      runOriginAnalysis(selectedTargetRow - 1, dIdx);
                    }}
                    className={`px-2 py-0.5 rounded font-black text-[11px] transition ${
                      selectedTargetCol === dIdx
                        ? 'bg-cyan-500 text-slate-950 shadow-md font-extrabold'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {dName}
                  </button>
                ))}
              </div>

              <button
                onClick={() => runOriginAnalysis(selectedTargetRow - 1, selectedTargetCol)}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-3.5 py-1 rounded-lg shadow-md transition flex items-center gap-1 cursor-pointer"
              >
                <span>🔍 Analyze Pattern Origin</span>
              </button>
            </div>

            <div className="text-[10px] text-cyan-400/90 font-mono">
              💡 <strong>Tip:</strong> Click ANY cell directly in the table below to instantly analyze how its Open & Close digits were formed!
            </div>
          </div>
        )}

        {activeFamilies.length > 0 && (
          <div className="flex items-center justify-between flex-wrap bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Active Families ({activeFamilies.length}):
              </span>
              {activeFamilies.map((fam) => (
                <div
                  key={fam.jodi}
                  className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg border shadow-sm text-xs font-black font-mono ${fam.colorObj.bg} ${fam.colorObj.text}`}
                  style={{ borderColor: fam.colorObj.exact }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block border border-black/40"
                    style={{ backgroundColor: fam.colorObj.exact, boxShadow: `0 0 6px ${fam.colorObj.exact}` }}
                  />
                  <span>{fam.jodi} Family</span>
                  <button
                    onClick={() => removeFamily(fam.jodi)}
                    className="ml-1 hover:text-white hover:bg-black/40 rounded-full p-0.5 transition"
                    title={`Remove ${fam.jodi} family`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={clearAllFamilies}
              className="text-[10px] font-bold text-red-400 hover:text-red-300 bg-red-950/60 hover:bg-red-900/80 border border-red-800/80 px-2 py-0.5 rounded-md transition"
            >
              Clear All
            </button>
          </div>
        )}

        <div className="flex items-center justify-between flex-wrap gap-2 text-xs font-mono pt-1">
          <div className="flex items-center gap-2">
            <span className="font-bold text-pink-300">
              Found <strong className="text-pink-400 text-sm">
                {matches.some(m => m.pairId)
                  ? new Set(matches.map(m => m.pairId)).size
                  : matches.length}
              </strong> matching {matches.some(m => m.pairId) ? 'occurrence(s)' : 'cell(s)'}
            </span>
            {isRelational && (
              <span className="bg-purple-900/80 text-purple-200 border border-purple-500/80 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm">
                Relational Pattern Query
              </span>
            )}
          </div>
          <div className="text-[10px] text-slate-400">
            Showing {totalRows} total weeks
          </div>
        </div>

        {/* MATCHES BAR WITH RESPONSIVE MOBILE LAYOUT AND DEDICATED JUMP CONTROLS */}
        {matches.length > 0 && (
          <div className="bg-slate-900/90 p-2 rounded-xl border border-slate-800 space-y-1.5 shadow-md">
            {/* Top Control Header */}
            <div className="flex items-center justify-between gap-2 flex-wrap text-xs font-mono">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-amber-400 font-black uppercase font-mono tracking-wider">
                  Matches ({matches.some(m => m.pairId) ? new Set(matches.map(m => m.pairId)).size : matches.length}):
                </span>
              </div>
              <div className="flex items-center gap-1 font-mono">
                <button
                  onClick={() => {
                    if (matchesBarRef.current) matchesBarRef.current.scrollLeft = 0;
                    const firstMatch = matches[0];
                    if (firstMatch) scrollToRowIndex(firstMatch.r);
                  }}
                  className="text-[10px] font-black bg-cyan-950 hover:bg-cyan-900 text-cyan-300 px-2 py-0.5 rounded-lg border border-cyan-700/80 transition flex items-center gap-1 active:scale-95 shadow-sm cursor-pointer"
                  title="Jump to Oldest Occurrence (#1)"
                >
                  ⏮️ Oldest (#1)
                </button>
                <button
                  onClick={() => {
                    if (matchesBarRef.current) matchesBarRef.current.scrollLeft = matchesBarRef.current.scrollWidth;
                    const lastMatch = matches[matches.length - 1];
                    if (lastMatch) scrollToRowIndex(lastMatch.r);
                  }}
                  className="text-[10px] font-black bg-amber-950 hover:bg-amber-900 text-amber-300 px-2 py-0.5 rounded-lg border border-amber-700/80 transition flex items-center gap-1 active:scale-95 shadow-sm cursor-pointer"
                  title="Jump to Latest Occurrence"
                >
                  Latest ⏭️
                </button>
              </div>
            </div>

            {/* Scrollable Match Chips Bar */}
            <div ref={matchesBarRef} className="flex items-center gap-1.5 overflow-x-auto py-1 scroll-smooth">
              {(() => {
                const hasPairIds = matches.some(m => m.pairId);
                if (hasPairIds) {
                  const groupMap = {};
                  const groupOrder = [];
                  matches.forEach((m) => {
                    const gId = m.pairId || `${m.r}_${m.c}`;
                    if (!groupMap[gId]) {
                      groupMap[gId] = { id: gId, color: m.color, border: m.border, items: [] };
                      groupOrder.push(gId);
                    }
                    groupMap[gId].items.push(m);
                  });

                  return groupOrder.map((gId, gIdx) => {
                    const group = groupMap[gId];
                    const isHoveredOrSelected = group.id === hoveredPairId || group.id === selectedPairId;
                    const chainText = group.items.map(item => item.val).join('-');
                    const daysText = group.items.map(item => item.day).join('-');
                    const firstRow = group.items[0]?.rowNum || 1;

                    return (
                      <button
                        key={group.id}
                        onMouseEnter={() => setHoveredPairId(group.id)}
                        onMouseLeave={() => setHoveredPairId(null)}
                        onClick={() => {
                          setSelectedPairId(prev => prev === group.id ? null : group.id);
                          scrollToRowIndex(group.items[0]?.r);
                        }}
                        style={{
                          borderColor: isHoveredOrSelected ? '#ffffff' : group.color,
                          backgroundColor: isHoveredOrSelected ? `${group.color}ee` : `${group.color}35`
                        }}
                        className={`flex items-center gap-1 border-2 px-2 py-1 rounded-lg cursor-pointer transition shadow-md shrink-0 text-white font-mono whitespace-nowrap text-[11px] ${
                          isHoveredOrSelected ? 'ring-2 ring-white font-black scale-105 border-white' : ''
                        }`}
                      >
                        <span className="font-black text-amber-300 bg-slate-950/80 px-1.5 py-0.5 rounded border border-slate-700 text-[10px]">
                          #{gIdx + 1} (R#{firstRow})
                        </span>
                        <span className="font-black tracking-tight text-emerald-300 bg-slate-950/90 px-1.5 py-0.5 rounded border border-slate-700">
                          {chainText}
                        </span>
                        <span className="text-[10px] font-bold text-slate-300 bg-slate-900/60 px-1 py-0.5 rounded">
                          ({daysText})
                        </span>
                      </button>
                    );
                  });
                } else {
                  return matches.map((m, idx) => (
                    <button
                      key={idx}
                      onClick={() => scrollToRowIndex(m.r)}
                      style={{ backgroundColor: m.color, color: '#020617' }}
                      className="text-[10px] font-black font-mono px-2 py-1 rounded-lg shadow-sm border border-black/80 flex items-center gap-1 hover:opacity-90 transition shrink-0 whitespace-nowrap"
                    >
                      <span>#{idx + 1} (R#{m.rowNum}) {m.day}: <strong>{m.val}</strong></span>
                      <ArrowRight className="w-2.5 h-2.5" />
                    </button>
                  ));
                }
              })()}
            </div>
          </div>
        )}
      </div>

      <div className="bg-slate-950 p-1 sm:p-2 rounded-2xl shadow-2xl space-y-2 border border-slate-800 relative">
        <div className="flex items-center justify-between gap-1.5 px-1 pb-1 flex-wrap">
          <span className="text-[9px] text-slate-400 font-mono">
            💡 <span className="text-cyan-400 font-bold">Click any cell</span> → inspect pattern origin | <span className="text-pink-400 font-bold">Hold 1s</span> → toggle family
          </span>
          {pressingCell && (
            <span className="text-[9px] text-cyan-400 font-bold animate-pulse">
              Holding… {Math.round(pressProgress)}%
            </span>
          )}
        </div>

        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="smooth-scroll-container overflow-y-auto overflow-x-auto max-h-[75vh] border border-slate-800 rounded-xl bg-[#fef9c3] relative"
        >
          <div className="w-full min-w-full relative">
            <table className="w-full table-fixed beige-chart-table relative z-10">
              <thead className="sticky top-0 z-20 shadow-md bg-white border-b-2 border-slate-950">
                <tr>
                  <th className="w-10 sm:w-14 py-1 text-center font-black text-slate-950 text-xs sm:text-base border border-slate-950 bg-slate-100">
                    #
                  </th>
                  {Array.from({ length: colsInput }).map((_, cIdx) => (
                    <th key={cIdx} className="py-1 text-center font-black text-slate-950 text-xs sm:text-base border border-slate-950 bg-slate-100">
                      {COL_HEADERS[cIdx] || `Col ${cIdx + 1}`}
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
                      <td className="text-center font-black text-slate-950 text-xs sm:text-base bg-slate-100 border border-slate-950 align-middle px-0.5">
                        {rIdx + 1}
                      </td>

                      {row.map((cell, cIdx) => {
                        const val = cell.val || '';
                        const red = isRedPair(val);
                        const holiday = isHoliday(val);

                        const matchItem = activeMatchMap[`${rIdx}_${cIdx}`];
                        const isHoveredPair = matchItem && matchItem.pairId && (matchItem.pairId === hoveredPairId || matchItem.pairId === selectedPairId);
                        const pColor = matchItem?.color || '#f59e0b';

                        const familyInfo = getCellFamilyInfo(val);
                        const isFamilyHighlight = !!familyInfo;
                        const isBeingPressed = pressingCell === `${rIdx}_${cIdx}`;

                        let cellBg, cellBorderColor, cellBorderWidth, cellShadow;
                        if (matchItem) {
                          cellBg = isHoveredPair ? `${pColor}ff` : `${pColor}70`;
                          cellBorderColor = isHoveredPair ? '#000000' : pColor;
                          cellBorderWidth = isHoveredPair ? '4px' : '3px';
                          cellShadow = isHoveredPair ? `0 0 18px ${pColor} inset, 0 0 0 2px #000000` : `0 0 10px ${pColor}80 inset`;
                        } else if (isFamilyHighlight) {
                          const fColor = familyInfo.isExact ? familyInfo.colorObj.exact : familyInfo.colorObj.member;
                          cellBg = familyInfo.isExact ? `${fColor}55` : `${fColor}28`;
                          cellBorderColor = fColor;
                          cellBorderWidth = familyInfo.isExact ? '3px' : '2px';
                          cellShadow = familyInfo.isExact
                            ? `0 0 14px ${fColor}cc inset`
                            : `0 0 8px ${fColor}80 inset`;
                        } else if (holiday) {
                          cellBg = '#f1f5f9';
                          cellBorderColor = '#020617';
                          cellBorderWidth = '1px';
                          cellShadow = 'none';
                        } else if (red) {
                          cellBg = '#fee2e2';
                          cellBorderColor = '#020617';
                          cellBorderWidth = '1px';
                          cellShadow = 'none';
                        } else {
                          cellBg = '#fef9c3';
                          cellBorderColor = '#020617';
                          cellBorderWidth = '1px';
                          cellShadow = 'none';
                        }

                        return (
                          <td
                            key={cIdx}
                            onMouseDown={() => startPressTimer(rIdx, cIdx, val)}
                            onMouseUp={cancelPressTimer}
                            onMouseLeave={cancelPressTimer}
                            onTouchStart={() => startPressTimer(rIdx, cIdx, val)}
                            onTouchEnd={cancelPressTimer}
                            onTouchCancel={cancelPressTimer}
                            onClick={() => runOriginAnalysis(rIdx, cIdx)}
                            style={{
                              backgroundColor: cellBg,
                              borderColor: cellBorderColor,
                              borderWidth: cellBorderWidth,
                              boxShadow: cellShadow
                            }}
                            className={`text-center align-middle font-mono font-black select-none cursor-pointer relative transition-all ${
                              matchItem || isFamilyHighlight ? 'z-10' : ''
                            }`}
                          >
                            {isBeingPressed && (
                              <div className="absolute inset-0 bg-cyan-500/30 z-30 flex items-center justify-center pointer-events-none">
                                <span className="text-[10px] font-black text-cyan-950 bg-cyan-300 px-1 rounded shadow">
                                  {Math.round(pressProgress)}%
                                </span>
                              </div>
                            )}

                            {isFamilyHighlight && !matchItem && (
                              <div className="absolute top-0.5 right-0.5 z-20 pointer-events-none flex items-center gap-0.5">
                                <span
                                  style={{
                                    backgroundColor: familyInfo.colorObj.exact,
                                    boxShadow: `0 0 6px ${familyInfo.colorObj.exact}`
                                  }}
                                  className={`rounded-full border border-slate-950/80 ${
                                    familyInfo.isExact ? 'w-2 h-2' : 'w-1.5 h-1.5'
                                  }`}
                                />
                              </div>
                            )}

                            {matchItem && matchItem.isProjectionCell ? (
                              <span className="text-xs font-black font-mono tracking-tight text-pink-600 bg-pink-100 px-1 rounded border border-pink-500 animate-pulse">
                                {matchItem.val}
                              </span>
                            ) : (
                              <span
                                className={`text-base xs:text-lg sm:text-2xl font-black font-mono tracking-tighter ${
                                  red ? 'red-pair-text' : 'normal-jodi-text'
                                }`}
                              >
                                {val || ''}
                              </span>
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

        {/* AI ORIGIN ANALYSIS BREAKDOWN CARD BELOW TABLE */}
        {originResult && (
          <div className="bg-slate-900 border-2 border-amber-500/60 rounded-2xl p-3 sm:p-4 space-y-3 shadow-2xl text-slate-100 mt-2">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">🎯</span>
                <div>
                  <h4 className="text-sm font-black text-amber-400 tracking-wide uppercase font-mono">
                    Pattern Origin Breakdown: Row #{originResult.targetRow} {originResult.targetDay} Jodi "{originResult.targetVal}"
                  </h4>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Open Digit: <span className="text-cyan-300 font-bold">{originResult.openDigit}</span> | Close Digit: <span className="text-purple-300 font-bold">{originResult.closeDigit}</span> | Jodi Total: <span className="text-emerald-300 font-bold">{originResult.jodiTotal}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOriginResult(null)}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white px-2.5 py-1 rounded-lg border border-slate-700 transition"
              >
                Dismiss ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono">
              {/* OPEN DIGIT EXPLANATIONS */}
              <div className="bg-slate-950/90 p-3 rounded-xl border border-cyan-500/40 space-y-2">
                <h5 className="text-xs font-black text-cyan-400 uppercase flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <span className="flex items-center gap-1.5">🔓 How Open "{originResult.openDigit}" Was Formed:</span>
                  <span className="text-[10px] text-cyan-300 font-bold bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-700">
                    {originResult.openOrigins.length} Rule(s) Found
                  </span>
                </h5>
                {originResult.openOrigins.length > 0 ? (
                  <div className="space-y-2.5 text-xs">
                    {originResult.openOrigins.map((orig, idx) => {
                      const isProof = orig.title.includes('Proof') || orig.title.includes('🔥') || orig.title.includes('⚡');
                      const palette = orig.palette || { bg: '#06b6d4', name: 'Cyan' };
                      return (
                        <div
                          key={idx}
                          className={`p-2.5 rounded-lg border space-y-1.5 transition-all ${
                            isProof
                              ? 'bg-amber-950/30 border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                              : 'bg-slate-900 border-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 flex-wrap">
                            <span className="font-bold text-amber-300 text-[11px] flex items-center gap-1">
                              #{idx + 1} {orig.title}
                            </span>
                            <span
                              className="text-[9px] font-black px-2 py-0.5 rounded shadow border border-black/50 uppercase tracking-wider"
                              style={{ backgroundColor: palette.bg, color: '#020617' }}
                            >
                              {palette.name} Pattern
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-200 leading-snug font-mono bg-slate-950/60 p-2 rounded border border-slate-800/80">
                            {orig.desc}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 italic py-2">
                    No direct historical origin pattern matched for Open digit {originResult.openDigit} in preceding 6 rows.
                  </div>
                )}
              </div>

              {/* CLOSE DIGIT EXPLANATIONS */}
              <div className="bg-slate-950/90 p-3 rounded-xl border border-purple-500/40 space-y-2">
                <h5 className="text-xs font-black text-purple-400 uppercase flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <span className="flex items-center gap-1.5">🔒 How Close "{originResult.closeDigit}" Was Formed:</span>
                  <span className="text-[10px] text-purple-300 font-bold bg-purple-950/80 px-2 py-0.5 rounded border border-purple-700">
                    {originResult.closeOrigins.length} Rule(s) Found
                  </span>
                </h5>
                {originResult.closeOrigins.length > 0 ? (
                  <div className="space-y-2.5 text-xs">
                    {originResult.closeOrigins.map((orig, idx) => {
                      const isProof = orig.title.includes('Proof') || orig.title.includes('🔥') || orig.title.includes('⚡');
                      const palette = orig.palette || { bg: '#a855f7', name: 'Purple' };
                      return (
                        <div
                          key={idx}
                          className={`p-2.5 rounded-lg border space-y-1.5 transition-all ${
                            isProof
                              ? 'bg-amber-950/30 border-amber-500/60 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
                              : 'bg-slate-900 border-slate-800'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 flex-wrap">
                            <span className="font-bold text-amber-300 text-[11px] flex items-center gap-1">
                              #{idx + 1} {orig.title}
                            </span>
                            <span
                              className="text-[9px] font-black px-2 py-0.5 rounded shadow border border-black/50 uppercase tracking-wider"
                              style={{ backgroundColor: palette.bg, color: '#020617' }}
                            >
                              {palette.name} Pattern
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-200 leading-snug font-mono bg-slate-950/60 p-2 rounded border border-slate-800/80">
                            {orig.desc}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 italic py-2">
                    No direct historical origin pattern matched for Close digit {originResult.closeDigit} in preceding 6 rows.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
