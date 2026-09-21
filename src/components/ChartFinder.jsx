import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useChart, isRedPair } from '../context/ChartContext';
import { parseQuery, queryChart } from '../ai/queryEngine';
import { Search, Sparkles, Filter, Eye, Layers, ArrowRight, HelpCircle, Check, X } from 'lucide-react';

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

  // MULTI-FAMILY HIGHLIGHT STATE (Up to 5 active families with distinct color palettes)
  const [activeFamilies, setActiveFamilies] = useState([]);

  // PRESS-AND-HOLD GESTURE STATE (1000ms threshold)
  const [pressingCell, setPressingCell] = useState(null); // format: `${r}_${c}`
  const [pressProgress, setPressProgress] = useState(0);  // 0 -> 100%
  const pressTimerRef = useRef(null);
  const progressAnimRef = useRef(null);

  const containerRef = useRef(null);
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
    return queryChart(grid, searchQuery);
  }, [grid, searchQuery]);

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

  const scrollToRowIndex = (rIdx) => {
    if (containerRef.current) {
      const targetScroll = Math.max(0, rIdx * rowHeight - 80);
      containerRef.current.scrollTo({ top: targetScroll, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (matches && matches.length > 0 && matches[0].r !== undefined) {
      scrollToRowIndex(matches[0].r);
    }
  }, [searchQuery, matches.length]);

  const presetQueries = [
    'master game',
    '03 family',
    '56 falti',
    'open to open same and close to close one down between 1 to 4 row',
    'mon open to open same and close to close one down',
    'wed 9 total near 6 total',
    'somavaram 03 family and 5th varam red pair'
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
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-tr from-pink-600 to-purple-600 p-2 rounded-xl text-white shadow-md">
              <Search className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                Chart Natural Language Search &amp; Finder
              </h2>
              <p className="text-[10px] text-slate-400">
                Ask in English or Telugu · <span className="text-cyan-400 font-bold">Hold any number 1s for multi-family highlight</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider hidden sm:block">Select Chart:</label>
            <select
              value={selectedChart}
              onChange={(e) => {
                setSelectedChart(e.target.value);
                if (setActiveChartName) setActiveChartName(e.target.value);
              }}
              className="bg-slate-900 border border-pink-500/80 text-pink-300 text-xs font-bold font-mono px-3 py-1.5 rounded-xl outline-none focus:ring-2 focus:ring-pink-500 shadow-inner cursor-pointer"
            >
              {Object.keys(charts).map((chartKey) => (
                <option key={chartKey} value={chartKey}>
                  {chartKey} ({charts[chartKey]?.data?.length || 0} rows)
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-pink-400" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder='Type search in English or Telugu e.g. "mon open to open same", "somavaram 03 family"...'
            className="w-full pl-9 pr-24 py-2.5 bg-slate-900 border-2 border-pink-500/80 focus:border-pink-400 rounded-xl text-xs sm:text-sm font-mono text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-pink-500/40 shadow-inner transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
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
              onClick={() => setSearchQuery(preset)}
              className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full transition whitespace-nowrap border ${
                searchQuery === preset
                  ? 'bg-pink-600 text-white border-pink-400 shadow-md'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              &quot;{preset}&quot;
            </button>
          ))}
        </div>

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
              Found <strong className="text-pink-400 text-sm">{matches.length}</strong> matching cell(s)
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

        {matches.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            <span className="text-[9px] text-slate-400 font-bold uppercase shrink-0">Matches:</span>
            {isRelational && relationalGroups.length > 0 ? (
              relationalGroups.map((group) => {
                const isHovered = group.id === hoveredPairId;
                return (
                  <div
                    key={group.id}
                    onMouseEnter={() => setHoveredPairId(group.id)}
                    onMouseLeave={() => setHoveredPairId(null)}
                    onClick={() => scrollToRowIndex(group.m1.r)}
                    style={{
                      borderColor: group.color,
                      backgroundColor: isHovered ? `${group.color}40` : 'rgba(15, 23, 42, 0.9)'
                    }}
                    className="flex items-center gap-1.5 border-2 px-2.5 py-1 rounded-xl cursor-pointer hover:scale-105 transition shadow-md shrink-0"
                  >
                    <span className="text-[10px] font-black text-amber-300">
                      Pair #{group.id} (R{group.m1.r + 1} → R{group.m2.r + 1})
                    </span>
                    {group.items.map((m, idx) => (
                      <React.Fragment key={idx}>
                        <span
                          style={{ backgroundColor: group.color, color: '#020617' }}
                          className="text-[9px] font-black font-mono px-1.5 py-0.2 rounded"
                        >
                          {m.day}: {m.val}
                        </span>
                        {idx < group.items.length - 1 && <span className="text-slate-400 text-[10px] font-bold">→</span>}
                      </React.Fragment>
                    ))}
                  </div>
                );
              })
            ) : (
              matches.map((m, idx) => (
                <button
                  key={idx}
                  onClick={() => scrollToRowIndex(m.r)}
                  style={{ backgroundColor: m.color, color: '#020617' }}
                  className="text-[9px] font-black font-mono px-2 py-0.5 rounded-md shadow-sm border border-black/80 flex items-center gap-1 hover:opacity-90 transition shrink-0"
                >
                  <span>#{m.rowNum} {m.day}: <strong>{m.val}</strong></span>
                  <ArrowRight className="w-2.5 h-2.5" />
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="bg-slate-950 p-1 sm:p-2 rounded-2xl shadow-2xl space-y-2 border border-slate-800 relative">
        <div className="flex items-center justify-between gap-1.5 px-1 pb-1 flex-wrap">
          <span className="text-[9px] text-slate-400 font-mono">
            💡 <span className="text-cyan-400 font-bold">Hold any cell 1s</span> → toggle family highlight with custom colors
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

                        const matchItem = matchMap[`${rIdx}_${cIdx}`];
                        const isHoveredPair = matchItem && matchItem.pairId && matchItem.pairId === hoveredPairId;
                        const pColor = matchItem?.color || '#f59e0b';

                        const familyInfo = getCellFamilyInfo(val);
                        const isFamilyHighlight = !!familyInfo;
                        const isBeingPressed = pressingCell === `${rIdx}_${cIdx}`;

                        let cellBg, cellBorderColor, cellBorderWidth, cellShadow;
                        if (matchItem) {
                          cellBg = isHoveredPair ? `${pColor}90` : `${pColor}45`;
                          cellBorderColor = isHoveredPair ? '#020617' : pColor;
                          cellBorderWidth = isHoveredPair ? '4px' : '3.5px';
                          cellShadow = isHoveredPair ? `0 0 18px ${pColor} inset` : `0 0 12px ${pColor}90 inset`;
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

                            <span
                              className={`text-base xs:text-lg sm:text-2xl font-black font-mono tracking-tighter ${
                                red ? 'red-pair-text' : 'normal-jodi-text'
                              }`}
                            >
                              {val || ''}
                            </span>
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
    </div>
  );
};
