import React, { useState, useRef, useMemo } from 'react';
import { useChart, isRedPair, isHoliday, calculateTotal, calculateDiffTotal } from '../context/ChartContext';
import { parseAndSearchChart } from '../ai/queryEngine';
import { Search, Sparkles, MapPin, Eye, Filter, Table, Layers, ArrowRight } from 'lucide-react';

const COL_HEADERS = ['Mo', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Col 8'];
const OVERSCAN = 20;

export const ChartFinder = () => {
  const { charts = {}, activeChartName, setActiveChartName, saveChart } = useChart();

  const [selectedChart, setSelectedChart] = useState(activeChartName || Object.keys(charts)[0] || 'SRIDEVI');
  const [searchQuery, setSearchQuery] = useState('find 56 in Mon');

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

  // Optimized row height allowing 12-14 rows on mobile screen
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

  // Preset example search queries for quick 1-click testing
  const presetQueries = [
    'one up open to open same row',
    '98 2 times in same col',
    'open to open 3 same row',
    'same row 59 sat and sunday',
    'find tuesday 11 and next tuesday 70',
    'sat 1 total'
  ];

  // Virtualization slicing
  const totalRows = grid.length;
  const viewportHeight = 600;
  const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN);
  const endRow = Math.min(totalRows, Math.ceil((scrollTop + viewportHeight) / rowHeight) + OVERSCAN);
  const visibleRows = grid.slice(startRow, endRow);

  const topPadding = startRow * rowHeight;
  const bottomPadding = Math.max(0, (totalRows - endRow) * rowHeight);

  return (
    <div className="max-w-7xl mx-auto space-y-3 p-1.5 sm:p-4 text-slate-100 font-poppins">
      {/* HEADER & CHART SELECTOR BAR */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 shadow-xl space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-tr from-pink-600 to-purple-600 p-2 rounded-xl text-white shadow-md">
              <Search className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                Chart Natural Language Search & Finder
              </h2>
              <p className="text-[10px] text-slate-400">
                Ask in simple English: e.g. "find 56 in Mon", "Tuesday total 2", or "consecutive red numbers"
              </p>
            </div>
          </div>

          {/* SELECT EXISTING CHART DROPDOWN */}
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

        {/* PROMINENT NATURAL LANGUAGE SEARCH BAR */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="w-4 h-4 text-pink-400" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder='Type search e.g. "find 56 in Mon", "Tuesday total 2", "consecutive red numbers"...'
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

        {/* QUICK PRESET CHIPS */}
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
              "{preset}"
            </button>
          ))}
        </div>

        {/* SEARCH RESULT SUMMARY */}
        <div className="flex items-center justify-between text-xs bg-slate-900/90 p-2 rounded-xl border border-slate-800">
          <span className="font-mono font-bold text-pink-300 text-[11px] sm:text-xs">
            {summary}
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            Chart: <strong className="text-white">{selectedChart}</strong> ({grid.length} Rows)
          </span>
        </div>

        {/* MATCHES LOCATION CHIPS (JUMP TO ROW) */}
        {matches.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 border-t border-slate-900">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider shrink-0">
              Matched Locations ({matches.length}):
            </span>
            {matches.map((m, idx) => (
              <button
                key={idx}
                onClick={() => scrollToRowIndex(m.r)}
                style={{ backgroundColor: m.color, color: '#020617' }}
                className="text-[9px] font-black font-mono px-2 py-0.5 rounded-md shadow-sm border border-black/80 flex items-center gap-1 hover:opacity-90 transition shrink-0"
              >
                <span>#{m.rowNum} {m.day}: <strong>{m.val}</strong></span>
                <ArrowRight className="w-2.5 h-2.5" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* MATKA GRID (MATCHING THE SCREENSHOT STYLING & UI SIZE EXACTLY) */}
      <div className="bg-slate-950 p-1 sm:p-2 rounded-2xl shadow-2xl space-y-2 border border-slate-800">
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="overflow-y-auto overflow-x-auto max-h-[calc(100vh-280px)] border border-slate-800 rounded-xl bg-[#fef9c3]"
        >
          <div className="w-full min-w-full">
            <table className="w-full table-fixed beige-chart-table">
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

                        // Look up match for this cell
                        const matchItem = matchMap[`${rIdx}_${cIdx}`];

                        return (
                          <td
                            key={cIdx}
                            style={{
                              backgroundColor: matchItem ? `${matchItem.color}45` : '#fef9c3',
                              borderColor: matchItem ? matchItem.color : '#020617',
                              borderWidth: matchItem ? '3.5px' : '1px',
                              boxShadow: matchItem ? `0 0 12px ${matchItem.color}90 inset` : 'none'
                            }}
                            className={`relative px-0.5 py-0.5 text-center align-middle ${
                              matchItem ? 'z-10 bg-amber-200/70 font-black' : ''
                            }`}
                          >
                            {/* Center Jodi Number */}
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
