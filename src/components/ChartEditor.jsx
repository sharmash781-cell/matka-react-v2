import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useChart, isRedPair, calculateCN, calculateCloseCond, calculateTotal, calculateDiffTotal } from '../context/ChartContext';
import { ArrowDown, Trash2, Settings2, Save, RefreshCw, Layers } from 'lucide-react';

const COL_HEADERS = ['Mo', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Col 8'];
const OVERSCAN = 25;

export const parseJodiTokens = (input) => {
  if (!input) return [];
  const rawTokens = input.trim().split(/[\s,\t\r\n]+/).filter(Boolean);
  const finalTokens = [];
  for (const raw of rawTokens) {
    if (raw === '**' || raw.toUpperCase() === 'XX') {
      finalTokens.push('**');
    } else if (/^\d+$/.test(raw)) {
      for (let i = 0; i < raw.length; i += 2) {
        let pair = raw.slice(i, i + 2);
        if (pair.length === 1) pair = '0' + pair;
        finalTokens.push(pair);
      }
    } else {
      finalTokens.push(raw.padStart(2, '0').slice(-2));
    }
  }
  return finalTokens;
};

export const ChartEditor = () => {
  const { charts, activeChartName, setActiveChartName, activeChart, saveChart } = useChart();

  const [nameInput, setNameInput] = useState(activeChartName || 'SRIDEVI');
  const [rowsInput, setRowsInput] = useState(activeChart ? activeChart.rows : 440);
  const [colsInput, setColsInput] = useState(activeChart ? activeChart.cols : 7);
  const [grid, setGrid] = useState([]);
  const [quickInput, setQuickInput] = useState('');
  const [showControls, setShowControls] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef(null);

  // Dynamic row height to fit stat numbers cleanly
  const rowHeight = showStats ? 88 : 62;

  useEffect(() => {
    if (activeChart) {
      setNameInput(activeChartName);
      setRowsInput(activeChart.rows);
      setColsInput(activeChart.cols);
      setGrid(activeChart.data || []);
    } else {
      initEmptyGrid(440, 7);
    }
  }, [activeChartName, activeChart]);

  useEffect(() => {
    const handleWindowScroll = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setScrollTop(Math.max(0, -rect.top));
      }
    };
    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    handleWindowScroll();
    return () => window.removeEventListener('scroll', handleWindowScroll);
  }, []);

  const initEmptyGrid = (r, c) => {
    setGrid(Array.from({ length: r }, () => Array.from({ length: c }, () => ({ val: '' }))));
  };

  const handleApplyResize = () => {
    const r = Math.max(1, parseInt(rowsInput) || 100);
    const c = Math.min(8, Math.max(5, parseInt(colsInput) || 7));
    const newGrid = Array.from({ length: r }, (_, i) =>
      Array.from({ length: c }, (_, j) => (grid[i] && grid[i][j]) ? grid[i][j] : { val: '' })
    );
    setGrid(newGrid);
  };

  const handleCellChange = (rIdx, cIdx, value) => {
    const updated = grid.map((row, r) =>
      row.map((cell, c) => (r === rIdx && c === cIdx) ? { val: value } : cell)
    );
    setGrid(updated);
    if (value.length === 2) {
      let nextR = rIdx, nextC = cIdx + 1;
      if (nextC >= colsInput) { nextC = 0; nextR++; }
      document.getElementById(`cell-${nextR}-${nextC}`)?.focus();
    }
  };

  const handleCellPaste = (e, startR, startC) => {
    e.preventDefault();
    const tokens = parseJodiTokens(e.clipboardData.getData('text'));
    if (!tokens.length) return;
    let tIdx = 0, curR = startR, curC = startC;
    const newGrid = grid.map(row => row.map(cell => ({ ...cell })));
    while (tIdx < tokens.length && curR < newGrid.length) {
      newGrid[curR][curC] = { val: tokens[tIdx++] };
      if (++curC >= colsInput) { curC = 0; curR++; }
    }
    setGrid(newGrid);
    document.getElementById(`cell-${curR}-${curC}`)?.focus();
  };

  const handleQuickFill = () => {
    const tokens = parseJodiTokens(quickInput);
    if (!tokens.length) return;
    let tIdx = 0;
    const updated = grid.map(row => row.map(() => tIdx < tokens.length ? { val: tokens[tIdx++] } : { val: '' }));
    setGrid(updated);
    setQuickInput('');
  };

  const handleClearAll = () => {
    const cleared = grid.map(row => row.map(() => ({ val: '' })));
    setGrid(cleared);
  };

  const handleSave = () => {
    const cleanName = nameInput.trim().toUpperCase() || activeChartName;
    saveChart(cleanName, grid.length, parseInt(colsInput) || 7, grid);
    if (cleanName !== activeChartName) setActiveChartName(cleanName);
  };

  const lastFilledRowIndex = useMemo(() => {
    for (let r = grid.length - 1; r >= 0; r--) {
      if (grid[r]?.some(cell => cell.val && cell.val !== '')) return r;
    }
    return Math.max(0, grid.length - 1);
  }, [grid]);

  const scrollToLastRow = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const elementTop = rect.top + window.scrollY;
      window.scrollTo({ top: elementTop + lastFilledRowIndex * rowHeight - 60, behavior: 'smooth' });
    }
  };

  const totalRows = grid.length;
  const visibleHeight = typeof window !== 'undefined' ? window.innerHeight : 900;

  const { startRow, endRow, topPadding, bottomPadding } = useMemo(() => {
    if (totalRows <= 30) return { startRow: 0, endRow: totalRows, topPadding: 0, bottomPadding: 0 };
    const s = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN);
    const e = Math.min(totalRows, Math.ceil((scrollTop + visibleHeight) / rowHeight) + OVERSCAN);
    return { startRow: s, endRow: e, topPadding: s * rowHeight, bottomPadding: (totalRows - e) * rowHeight };
  }, [scrollTop, totalRows, rowHeight, visibleHeight]);

  const visibleRows = useMemo(() => grid.slice(startRow, endRow), [grid, startRow, endRow]);

  return (
    <div className="min-h-screen bg-[#f5d5a7] text-slate-950 font-poppins selection:bg-pink-500 selection:text-white pb-20">

      {/* 1. TOP HEADER BANNER (DPBOSS STYLE) - PLACED OUTSIDE / ABOVE TABLE */}
      <header className="bg-gradient-to-r from-rose-600 via-pink-600 to-rose-700 text-white text-center py-2.5 px-3 shadow-md border-b-2 border-rose-800">
        <h1 className="text-base sm:text-xl font-black tracking-wider uppercase font-mono drop-shadow">
          DpBOSS.TAX
        </h1>
        <div className="text-[11px] font-extrabold bg-pink-900/60 py-0.5 px-2 rounded mt-1 inline-block tracking-widest uppercase">
          {activeChartName} JODI CHART
        </div>
      </header>

      {/* 2. SUB-HEADER RECORD DETAILS (DPBOSS STYLE YELLOW BOX) */}
      <div className="mx-2 my-2 bg-[#fef9c3] border border-amber-300 rounded-lg p-2.5 text-center text-xs font-bold text-amber-950 shadow-sm leading-relaxed">
        <span className="font-black block uppercase text-amber-900 text-xs">
          {activeChartName} JODI RESULT CHART RECORDS
        </span>
        <p className="text-[10px] text-amber-800 font-medium mt-0.5">
          Dpboss {activeChartName} jodi chart, {activeChartName} jodi record, matka jodi chart, {grid.length} records available
        </p>
      </div>

      {/* 3. RESULT DISPLAY & ACTION CONTROL BUTTONS (ALL OUTSIDE & ABOVE TABLE) */}
      <div className="mx-2 mb-3 bg-[#fce7f3]/80 border border-pink-300 rounded-xl p-3 text-center space-y-2 shadow-sm">
        <h2 className="text-lg font-black text-slate-900 uppercase tracking-wide">
          {activeChartName}
        </h2>
        <div className="text-sm font-black text-purple-900 font-mono tracking-widest bg-purple-100/80 py-1 px-3 rounded-full inline-block border border-purple-200">
          234-94-257
        </div>

        {/* Action Controls - Placed UP SIDE of table so zero obstruction! */}
        <div className="flex items-center justify-center gap-2 flex-wrap pt-1">
          <button
            onClick={scrollToLastRow}
            className="flex items-center gap-1.5 bg-blue-700 hover:bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-black shadow transition-all active:scale-95"
          >
            <ArrowDown className="w-4 h-4" /> Go to Bottom (#{lastFilledRowIndex + 1})
          </button>

          <button
            onClick={() => setShowControls(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-black shadow transition-all active:scale-95 border ${
              showControls ? 'bg-rose-700 border-rose-800 text-white' : 'bg-slate-900 border-slate-800 text-amber-300'
            }`}
          >
            <Settings2 className="w-4 h-4" />
            {showControls ? 'Close Controls' : 'Edit Controls'}
          </button>
        </div>
      </div>

      {/* 4. EXPANDABLE EDIT CONTROLS PANEL (SITS INLINE ABOVE TABLE, NEVER OVERLAPS) */}
      {showControls && (
        <div className="mx-2 mb-4 bg-slate-950 text-slate-100 border-2 border-slate-700 rounded-2xl p-3.5 shadow-2xl space-y-3 animate-fadeIn">
          
          {/* Section A: Chart Name Input & Save */}
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-1">
                ✏️ Create / Edit Chart Name:
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                Current: {activeChartName}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value.toUpperCase())}
                placeholder="ENTER CHART NAME (e.g. KALYAN NIGHT)"
                className="flex-1 bg-slate-950 border border-slate-600 text-amber-300 font-black rounded-lg px-3 py-2 text-xs outline-none focus:border-amber-400 uppercase tracking-wide"
              />
              <button
                onClick={handleSave}
                className="flex items-center gap-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 text-white px-4 py-2 rounded-lg text-xs font-black shadow-md"
              >
                <Save className="w-3.5 h-3.5" /> Save Chart
              </button>
            </div>
          </div>

          {/* Section B: Load Chart & Clear */}
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-[11px] text-slate-400 font-bold whitespace-nowrap">LOAD SAVED:</label>
            <select
              value={activeChartName}
              onChange={(e) => {
                setActiveChartName(e.target.value);
                setNameInput(e.target.value);
              }}
              className="bg-slate-900 text-white text-xs font-extrabold rounded-lg px-3 py-2 outline-none border border-slate-700 cursor-pointer flex-1"
            >
              {Object.keys(charts).map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1 bg-red-950 border border-red-700 text-red-300 hover:bg-red-900 px-3 py-2 rounded-lg text-xs font-bold"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear Cells
            </button>
          </div>

          {/* Section C: Quick Fill Input */}
          <div className="flex gap-1.5">
            <input
              type="text"
              placeholder="Quick fill: 123456 → 12, 34, 56 | 8888 → 88, 88"
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-blue-500"
            />
            <button onClick={handleQuickFill} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold">Fill</button>
          </div>

          {/* Section D: Stats Toggle & Grid Sizing */}
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-800">
            <button
              onClick={() => setShowStats(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                showStats
                  ? 'bg-indigo-900 border-indigo-500 text-indigo-200 shadow-md'
                  : 'bg-slate-900 border-slate-700 text-slate-400'
              }`}
            >
              🔢 {showStats ? 'Stats: ON' : 'Stats: OFF'}
            </button>
            <span className="text-[11px] text-slate-400 font-bold ml-auto">ROWS × COLS:</span>
            <input type="number" value={rowsInput} onChange={(e) => setRowsInput(e.target.value)}
              className="w-16 bg-slate-900 border border-slate-700 text-white font-mono font-bold text-center py-1.5 rounded-lg text-xs" />
            <input type="number" value={colsInput} onChange={(e) => setColsInput(e.target.value)}
              className="w-14 bg-slate-900 border border-slate-700 text-white font-mono font-bold text-center py-1.5 rounded-lg text-xs" />
            <button onClick={handleApplyResize} className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg text-xs font-extrabold">Resize</button>
          </div>

          <div className="text-[10px] text-slate-400 font-mono flex justify-between pt-1">
            <span>Grid: {grid.length} Rows × {colsInput} Cols</span>
            <span>Active Row #{lastFilledRowIndex + 1}</span>
          </div>
        </div>
      )}

      {/* 5. DPBOSS CHART TABLE — CLEAN, FULL WIDTH, STICKY DAYS HEADER */}
      <div ref={containerRef} className="w-full overflow-x-auto shadow-xl">

        {/* DPBOSS TABLE TITLE BAR */}
        <div className="bg-[#1e3a8a] text-white text-center font-black py-2.5 px-2 text-xs sm:text-sm uppercase tracking-wider border-b-2 border-blue-950 shadow-inner">
          {activeChartName} MATKA JODI RECORD 2018 - 2026
        </div>

        <table className="w-full table-fixed white-chart-table border-collapse">
          {/* STICKY GOLDEN DAY HEADERS (Mo, Tue, Wed, Thu, Fri, Sat, Sun) */}
          <thead className="sticky top-0 z-30 shadow-md">
            <tr className="bg-[#fbbf24] text-slate-950 border-b-2 border-slate-900">
              <th className="w-8 sm:w-10 text-center border border-slate-900 bg-[#f59e0b] text-slate-950 text-[11px] font-black py-2">#</th>
              {Array.from({ length: colsInput }).map((_, c) => (
                <th key={c} className="text-center border border-slate-900 text-slate-950 font-black text-xs sm:text-base py-2">
                  {COL_HEADERS[c] || `C${c + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {topPadding > 0 && (
              <tr><td colSpan={colsInput + 1} style={{ height: topPadding, padding: 0, border: 'none' }} /></tr>
            )}

            {visibleRows.map((row, relIdx) => {
              const rIdx = startRow + relIdx;
              return (
                <tr key={rIdx} style={{ height: rowHeight }}>
                  {/* Row Number Column */}
                  <td className="text-center font-black text-slate-950 text-[11px] bg-[#fcd34d] border border-slate-800 align-middle">
                    {rIdx + 1}
                  </td>
                  {row.map((cell, cIdx) => {
                    const val = cell.val || '';
                    const total = calculateTotal(val);
                    const diffTotal = calculateDiffTotal(val);
                    const cn = calculateCN(val);
                    const closeCond = calculateCloseCond(val);
                    const red = isRedPair(val);
                    return (
                      <td
                        key={cIdx}
                        className="border border-slate-800 relative text-center align-top transition-colors hover:bg-amber-200"
                        style={{ backgroundColor: '#fef3c7' }}
                      >

                        {/* TOP: Total (green left) + Diff Total (red right) — 14px BOLD */}
                        {showStats && (
                          <div className="flex justify-between px-1 pt-0.5 leading-none">
                            <span
                              className="text-emerald-900 font-black font-mono tracking-tighter"
                              style={{ fontSize: '14px', fontWeight: '900' }}
                            >
                              {total ?? ''}
                            </span>
                            <span
                              className="text-red-700 font-black font-mono tracking-tighter"
                              style={{ fontSize: '14px', fontWeight: '900' }}
                            >
                              {diffTotal ?? ''}
                            </span>
                          </div>
                        )}

                        {/* MIDDLE: Big Jodi Number — DPBoss Bold Styling */}
                        <div className={`flex items-center justify-center ${showStats ? '' : 'h-full'}`}>
                          <input
                            id={`cell-${rIdx}-${cIdx}`}
                            type="text"
                            maxLength={2}
                            value={val}
                            onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                            onPaste={(e) => handleCellPaste(e, rIdx, cIdx)}
                            className={`w-full bg-transparent text-center font-black font-mono outline-none p-0 leading-none ${
                              red ? 'text-red-600 font-black' : 'text-slate-950 font-black'
                            }`}
                            style={{ fontSize: 'clamp(24px, 6.5vw, 40px)', fontWeight: '900' }}
                          />
                        </div>

                        {/* BOTTOM: Open-Close Condition Pair (cn-closeCond) — 14px BOLD */}
                        {showStats && (
                          <div
                            className="absolute bottom-0.5 left-0 right-0 text-center font-black font-mono text-slate-950 leading-none tracking-tight"
                            style={{ fontSize: '14px', fontWeight: '900' }}
                          >
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
              <tr><td colSpan={colsInput + 1} style={{ height: bottomPadding, padding: 0, border: 'none' }} /></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
