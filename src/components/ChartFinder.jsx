import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { useChart, isRedPair, isHoliday, calculateTotal, calculateDiffTotal } from '../context/ChartContext';
import { parseAndSearchChart } from '../ai/queryEngine';
import { Search, Sparkles, MapPin, Eye, Filter, Table, Layers, ArrowRight, Link, X } from 'lucide-react';

const COL_HEADERS = ['Mo', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Col 8'];
const OVERSCAN = 20;

// Vibrant, distinct colors for multi-family highlights
const FAMILY_PALETTE = [
  { exact: '#06b6d4', member: '#0ea5e9', border: '#0284c7', text: 'text-cyan-300', bg: 'bg-cyan-950', badge: 'bg-cyan-500' }, // Cyan
  { exact: '#a855f7', member: '#c084fc', border: '#9333ea', text: 'text-purple-300', bg: 'bg-purple-950', badge: 'bg-purple-500' }, // Purple
  { exact: '#10b981', member: '#34d399', border: '#059669', text: 'text-emerald-300', bg: 'bg-emerald-950', badge: 'bg-emerald-500' }, // Emerald
  { exact: '#f59e0b', member: '#fbbf24', border: '#d97706', text: 'text-amber-300', bg: 'bg-amber-950', badge: 'bg-amber-500' }, // Amber
  { exact: '#ec4899', member: '#f472b6', border: '#db2777', text: 'text-pink-300', bg: 'bg-pink-950', badge: 'bg-pink-500' }  // Pink
];

// Compute jodi family: open, close, cut-open, cut-close and all reverses
const getJodiFamily = (jodiStr) => {
  if (!jodiStr || !/^\d{2}$/.test(jodiStr)) return new Set();
  const o = parseInt(jodiStr[0]);
  const c = parseInt(jodiStr[1]);
  const cutO = (o + 5) % 10;
  const cutC = (c + 5) % 10;
  return new Set([
    `${o}${c}`, `${o}${cutC}`, `${cutO}${c}`, `${cutO}${cutC}`,
    `${c}${o}`, `${c}${cutO}`, `${cutC}${o}`, `${cutC}${cutO}`
  ]);
};

export const ChartFinder = () => {
  const { charts = {}, activeChartName, setActiveChartName, saveChart } = useChart();

  const [selectedChart, setSelectedChart] = useState(activeChartName || Object.keys(charts)[0] || 'SRIDEVI');
  const [searchQuery, setSearchQuery] = useState('open to open same and close to close one down between 1 to 4 row');
  const [hoveredPairId, setHoveredPairId] = useState(null);

  // ── MULTI-FAMILY HIGHLIGHT STATE ───────────────────────────────────────────
  // Array of active family objects: [{ jodi: "54", familySet: Set(), colorObj: FAMILY_PALETTE[i] }]
  const [activeFamilies, setActiveFamilies] = useState([]);
  const [pressProgress, setPressProgress] = useState(0);     // 0-100 for press progress
  const [pressingCell, setPressingCell] = useState(null);    // "rIdx_cIdx" of cell held
  const longPressTimerRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const LONG_PRESS_MS = 750;

  const clearLongPress = useCallback(() => {
    clearTimeout(longPressTimerRef.current);
    clearInterval(progressIntervalRef.current);
    setPressProgress(0);
    setPressingCell(null);
  }, []);

  const handleCellPointerDown = useCallback((e, val, rIdx, cIdx) => {
    if (!val || !/^\d{2}$/.test(val)) return;
    e.currentTarget.setPointerCapture(e.pointerId);

    const cellKey = `${rIdx}_${cIdx}`;
    setPressingCell(cellKey);
    setPressProgress(0);

    const startTime = Date.now();
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, (elapsed / LONG_PRESS_MS) * 100);
      setPressProgress(pct);
    }, 16);

    longPressTimerRef.current = setTimeout(() => {
      clearInterval(progressIntervalRef.current);
      setPressProgress(100);
      setPressingCell(null);

      // Check if this jodi (or a jodi belonging to an active family) is already active
      setActiveFamilies(prev => {
        const existingIdx = prev.findIndex(f => f.jodi === val || f.familySet.has(val));
        if (existingIdx !== -1) {
          // Toggle OFF existing family
          return prev.filter((_, idx) => idx !== existingIdx);
        } else {
          // Add NEW family with next color from palette
          const nextColorObj = FAMILY_PALETTE[prev.length % FAMILY_PALETTE.length];
          const newFamSet = getJodiFamily(val);
          return [...prev, { jodi: val, familySet: newFamSet, colorObj: nextColorObj }];
        }
      });
    }, LONG_PRESS_MS);
  }, []);

  const handleCellPointerUp = useCallback(() => {
    clearLongPress();
  }, [clearLongPress]);

  const handleCellPointerCancel = useCallback(() => {
    clearLongPress();
  }, [clearLongPress]);

  const removeFamily = useCallback((jodiToRemove) => {
    setActiveFamilies(prev => prev.filter(f => f.jodi !== jodiToRemove));
  }, []);

  const clearAllFamilies = useCallback(() => {
    setActiveFamilies([]);
  }, []);

  // Cleanup timers on unmount
  useEffect(() => () => clearLongPress(), [clearLongPress]);
  // ───────────────────────────────────────────────────────────────────────────

  // Virtualization Scroll State
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef(null);

  const activeChartObj = charts[selectedChart] || null;
  const grid = activeChartObj ? activeChartObj.data : [];
  const colsInput = activeChartObj ? activeChartObj.cols : 7;

  // Perform Natural Language Search
  const searchResult = useMemo(() => {
    return parseAndSearchChart(searchQuery, grid, colsInput);
  }, [searchQuery, grid, colsInput]);

  const { matches = [], summary = '', matchMap = {} } = searchResult;

  // Group matches by pairId if available
  const pairedGroupMap = useMemo(() => {
    const groups = {};
    matches.forEach(m => {
      if (m.pairId) {
        if (!groups[m.pairId]) groups[m.pairId] = [];
        groups[m.pairId].push(m);
      }
    });
    return groups;
  }, [matches]);

  const rowHeight = 44;

  const handleScroll = (e) => {
    setScrollTop(e.target.scrollTop);
  };

  const scrollToRowIndex = (rIdx) => {
    if (containerRef.current) {
      const targetScroll = Math.max(0, rIdx * rowHeight - 80);
      containerRef.current.scrollTo({ top: targetScroll, behavior: 'smooth' });
    }
  };

  // Auto-scroll to first matched row instantly on search
  React.useEffect(() => {
    if (matches && matches.length > 0 && matches[0].r !== undefined) {
      scrollToRowIndex(matches[0].r);
    }
  }, [searchQuery, matches.length]);

  const presetQueries = [
    '03 family',
    '56 falti',
    'open to open same and close to close one down between 1 to 4 row',
    'mon open to open same and close to close one down',
    'wed 9 total near 6 total',
    'somavaram 03 family and 5th varam red pair'
  ];

  // Virtualization slicing
  const totalRows = grid.length;
  const viewportHeight = 600;
  const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN);
  const endRow = Math.min(totalRows, Math.ceil((scrollTop + viewportHeight) / rowHeight) + OVERSCAN);
  const visibleRows = grid.slice(startRow, endRow);

  const topPadding = startRow * rowHeight;
  const bottomPadding = Math.max(0, (totalRows - endRow) * rowHeight);

  // Quick lookup helper for cell family highlights
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
      {/* HEADER & SEARCH BAR */}
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

        {/* SEARCH INPUT FIELD */}
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

        {/* PRESET QUERY CHIPS */}
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

        {/* MULTI-FAMILY HIGHLIGHT ACTIVE BANNERS */}
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
              Clear All Families
            </button>
          </div>
        )}

        {/* SEARCH RESULT SUMMARY */}
        <div className="flex items-center justify-between text-xs bg-slate-900/90 p-2 rounded-xl border border-slate-800">
          <span className="font-mono font-bold text-pink-300 text-[11px] sm:text-xs">
            {summary}
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            Chart: <strong className="text-white">{selectedChart}</strong> ({grid.length} Rows)
          </span>
        </div>

        {/* MATCHES LOCATION CHIPS */}
        {matches.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 border-t border-slate-900">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider shrink-0 flex items-center gap-1">
              <Link className="w-3 h-3 text-emerald-400" /> Matches ({Object.keys(pairedGroupMap).length > 0 ? `${Object.keys(pairedGroupMap).length} Pairs` : matches.length}):
            </span>

            {Object.keys(pairedGroupMap).length > 0 ? (
              Object.entries(pairedGroupMap).map(([pId, pairItems]) => {
                const pColor = pairItems[0]?.color || '#10b981';
                return (
                  <div
                    key={pId}
                    onMouseEnter={() => setHoveredPairId(pId)}
                    onMouseLeave={() => setHoveredPairId(null)}
                    style={{ borderColor: hoveredPairId === pId ? pColor : '#334155' }}
                    className={`flex items-center gap-1.5 bg-slate-900 border px-2.5 py-1 rounded-lg transition shrink-0 cursor-pointer shadow-md ${
                      hoveredPairId === pId ? 'scale-105 shadow-xl' : ''
                    }`}
                  >
                    <span
                      style={{ backgroundColor: pColor }}
                      className="w-2.5 h-2.5 rounded-full inline-block border border-black/40 shadow-sm"
                    />
                    {pairItems.map((m, idx) => (
                      <React.Fragment key={idx}>
                        {idx > 0 && <span className="text-[10px] font-black" style={{ color: pColor }}>↔</span>}
                        <button
                          onClick={() => scrollToRowIndex(m.r)}
                          className="text-[10px] font-mono text-white font-bold hover:underline"
                        >
                          #{m.rowNum} {m.day}: <strong>{m.val}</strong>
                        </button>
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

      {/* MATKA GRID */}
      <div className="bg-slate-950 p-1 sm:p-2 rounded-2xl shadow-2xl space-y-2 border border-slate-800 relative">
        {/* Long-press hint */}
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
          className="overflow-y-auto overflow-x-auto max-h-[calc(100vh-300px)] border border-slate-800 rounded-xl bg-[#fef9c3] relative"
        >
          <div className="w-full min-w-full relative">
            <table className="w-full table-fixed beige-chart-table relative z-10">
              <thead className="sticky top-0 z-20 shadow-md bg-white border-b-2 border-slate-950">
                <tr>
                  <th className="w-10 sm:w-14 py-2 text-center font-black text-slate-950 text-xs sm:text-base border border-slate-950 bg-slate-100">
                    #
                  </th>
                  {Array.from({ length: colsInput }).map((_, cIdx) => (
                    <th key={cIdx} className="py-2 text-center font-black text-slate-950 text-xs sm:text-base border border-slate-950 bg-slate-100">
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

                        // Multi-family highlight lookup for this cell
                        const familyInfo = getCellFamilyInfo(val);
                        const isFamilyHighlight = !!familyInfo;

                        // Press-in-progress indicator on THIS cell
                        const isBeingPressed = pressingCell === `${rIdx}_${cIdx}`;

                        // Determine final cell styling: Search matches take priority over family highlight
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
                        } else {
                          cellBg = '#fef9c3';
                          cellBorderColor = '#020617';
                          cellBorderWidth = '1px';
                          cellShadow = 'none';
                        }

                        return (
                          <td
                            key={cIdx}
                            onMouseEnter={() => matchItem && matchItem.pairId && setHoveredPairId(matchItem.pairId)}
                            onMouseLeave={() => setHoveredPairId(null)}
                            onPointerDown={(e) => handleCellPointerDown(e, val, rIdx, cIdx)}
                            onPointerUp={handleCellPointerUp}
                            onPointerCancel={handleCellPointerCancel}
                            onPointerLeave={handleCellPointerUp}
                            style={{
                              backgroundColor: cellBg,
                              borderColor: isBeingPressed ? '#06b6d4' : cellBorderColor,
                              borderWidth: isBeingPressed ? '2.5px' : cellBorderWidth,
                              boxShadow: isBeingPressed
                                ? `0 0 0 ${Math.round(pressProgress / 14)}px rgba(6,182,212,0.45) inset`
                                : cellShadow,
                              outline: isBeingPressed ? `2px solid rgba(6,182,212,${pressProgress / 100})` : 'none',
                              userSelect: 'none',
                              touchAction: 'none'
                            }}
                            className={`relative px-0.5 py-0.5 text-center align-middle transition-all duration-150 cursor-pointer ${
                              matchItem ? 'z-10 font-black' : ''
                            } ${isFamilyHighlight && !matchItem ? 'z-5' : ''}`}
                          >
                            {/* SEARCH MATCH MICRO DOT */}
                            {matchItem && (
                              <div className="absolute top-1 right-1 z-20 pointer-events-none flex items-center justify-center">
                                <span
                                  style={{
                                    backgroundColor: pColor,
                                    boxShadow: `0 0 5px ${pColor}, 0 0 1.5px #000`
                                  }}
                                  className="w-2 h-2 rounded-full border border-slate-950/90 inline-block"
                                />
                              </div>
                            )}

                            {/* MULTI-FAMILY MICRO DOT (only when no search match) */}
                            {isFamilyHighlight && !matchItem && (
                              <div className="absolute top-1 right-1 z-20 pointer-events-none">
                                <span
                                  style={{
                                    backgroundColor: familyInfo.isExact ? familyInfo.colorObj.exact : familyInfo.colorObj.member,
                                    boxShadow: `0 0 5px ${familyInfo.colorObj.exact}, 0 0 1.5px #000`,
                                    width: familyInfo.isExact ? '8px' : '6px',
                                    height: familyInfo.isExact ? '8px' : '6px',
                                  }}
                                  className="rounded-full border border-slate-950/90 inline-block"
                                />
                              </div>
                            )}

                            {/* Center Jodi Number - 100% Unobscured & Fully Legible */}
                            <div className="flex items-center justify-center my-auto relative z-10 w-full h-full">
                              <span
                                className={`text-base xs:text-lg sm:text-2xl font-black font-mono tracking-wider leading-none ${
                                  red ? 'text-red-600 drop-shadow-sm font-black' : (holiday ? 'text-slate-400 font-bold' : 'text-slate-950 font-black')
                                }`}
                              >
                                {val || ''}
                              </span>
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
    </div>
  );
};
