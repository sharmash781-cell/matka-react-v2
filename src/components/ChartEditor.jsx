import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useChart, isRedPair, calculateCN, calculateCloseCond, calculateTotal, calculateDiffTotal } from '../context/ChartContext';
import { ArrowDown, Trash2, Settings2, Save, Store, PlusCircle, CheckCircle, Maximize2, Minimize2 } from 'lucide-react';

const COL_HEADERS = ['Mo', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Col 8'];
const OVERSCAN = 30;

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
  const { charts, activeChartName, setActiveChartName, activeChart, saveChart, setActiveTab } = useChart();

  const [nameInput, setNameInput] = useState(activeChartName || 'NEW CHART');
  const [rowsInput, setRowsInput] = useState(activeChart ? activeChart.rows : 20);
  const [colsInput, setColsInput] = useState(activeChart ? activeChart.cols : 7);
  const [grid, setGrid] = useState([]);
  const [quickInput, setQuickInput] = useState('');
  const [showControls, setShowControls] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [isCompact, setIsCompact] = useState(true); // Compact mode to fit 15+ rows on mobile!
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef(null);

  // Compact row height (52px) allows 15+ rows on mobile screen at once (DPBoss match)!
  const rowHeight = isCompact ? (showStats ? 54 : 40) : (showStats ? 84 : 60);

  useEffect(() => {
    if (activeChart) {
      setNameInput(activeChartName);
      setRowsInput(activeChart.rows);
      setColsInput(activeChart.cols);
      setGrid(activeChart.data || []);
    } else {
      initEmptyGrid(20, 7);
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

  const handleCreateNewBlank = () => {
    const newName = `MY CHART ${Object.keys(charts).length + 1}`;
    setNameInput(newName);
    setRowsInput(20);
    setColsInput(7);
    initEmptyGrid(20, 7);
    setSaveSuccessMsg(`Created blank grid for "${newName}". Type numbers and click "Save to Store"!`);
    setTimeout(() => setSaveSuccessMsg(''), 4000);
  };

  const handleApplyResize = () => {
    const r = Math.max(1, parseInt(rowsInput) || 20);
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
    const cleanName = nameInput.trim().toUpperCase() || activeChartName || 'CUSTOM CHART';
    saveChart(cleanName, grid.length, parseInt(colsInput) || 7, grid);
    if (cleanName !== activeChartName) setActiveChartName(cleanName);
    setSaveSuccessMsg(`Saved "${cleanName}" to Store repository!`);
    setTimeout(() => setSaveSuccessMsg(''), 4000);
  };

  const lastFilledRowIndex = useMemo(() => {
    for (let r = grid.length - 1; r >= 0; r--) {
      if (grid[r]?.some(cell => cell.val && cell.val !== '')) return r;
    }
    return Math.max(0, grid.length - 1);
  }, [grid]);

  const lastFilledJodi = useMemo(() => {
    for (let r = grid.length - 1; r >= 0; r--) {
      if (grid[r]) {
        for (let c = grid[r].length - 1; c >= 0; c--) {
          if (grid[r][c]?.val && grid[r][c].val !== '') {
            return { val: grid[r][c].val, row: r + 1, col: c + 1 };
          }
        }
      }
    }
    return null;
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
    <div className="min-h-screen bg-[#f7e3c4] text-slate-950 font-poppins selection:bg-pink-500 selection:text-white pb-20">

      {/* CONTAINER FOR PC VIEW: CENTERED MAX-W-5XL WITH OUTSIDE DPBOSS SPACE */}
      <div className="max-w-5xl mx-auto">

        {/* 1. TOP HEADER PANEL */}
        <div className="mx-1 sm:mx-2 my-2.5 bg-slate-950 text-slate-100 border border-slate-800 rounded-2xl p-3 shadow-xl space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            
            {/* Dynamic Chart Name & Last Jodi */}
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-2xl font-black text-amber-400 uppercase tracking-wide">
                  {activeChartName}
                </h1>
                {lastFilledJodi && (
                  <div className="flex items-center gap-1 bg-amber-400/20 border border-amber-400/40 text-amber-300 px-2 py-0.5 rounded-lg text-xs font-mono font-black">
                    <span>Last Jodi:</span>
                    <span className="text-amber-400 font-extrabold text-sm">{lastFilledJodi.val}</span>
                  </div>
                )}
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                {grid.length} Rows × {colsInput} Cols | Row #{lastFilledRowIndex + 1}
              </div>
            </div>

            {/* Top Action Buttons (Responsive & Clean) */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={scrollToLastRow}
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

              <button
                onClick={() => setActiveTab('store')}
                className="flex items-center gap-1 bg-purple-600 hover:bg-purple-500 text-white px-2.5 py-1.5 rounded-xl text-xs font-black shadow transition-all active:scale-95 border border-purple-400"
              >
                <Store className="w-3.5 h-3.5" />
                <span>Store</span>
                <span className="bg-purple-950 text-purple-200 px-1.5 py-0.2 rounded-full text-[10px]">
                  {Object.keys(charts).length}
                </span>
              </button>
            </div>
          </div>

          {/* Feedback Toast */}
          {saveSuccessMsg && (
            <div className="flex items-center justify-between bg-emerald-950 border border-emerald-500 text-emerald-200 text-xs px-3 py-2 rounded-xl font-bold animate-fadeIn">
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                {saveSuccessMsg}
              </span>
              <button
                onClick={() => setActiveTab('store')}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black px-2 py-0.5 rounded-lg shadow"
              >
                View Store →
              </button>
            </div>
          )}
        </div>

        {/* 2. EXPANDABLE EDIT CONTROLS PANEL (100% RESPONSIVE - FIXES MOBILE OVERFLOW IMAGE 3) */}
        {showControls && (
          <div className="mx-1 sm:mx-2 mb-3 bg-slate-950 text-slate-100 border-2 border-slate-700 rounded-2xl p-3 shadow-2xl space-y-3 animate-fadeIn max-w-full overflow-hidden">
            
            {/* Quick Action: Start New Blank Chart */}
            <div className="flex items-center justify-between flex-wrap gap-2 bg-slate-900/90 border border-slate-700 rounded-xl p-2.5">
              <span className="text-xs font-black text-slate-300">Create New Grid:</span>
              <button
                onClick={handleCreateNewBlank}
                className="flex items-center gap-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-3 py-1.5 rounded-lg text-xs shadow-md transition-all active:scale-95"
              >
                <PlusCircle className="w-4 h-4" /> Create Blank Chart Grid
              </button>
            </div>

            {/* Chart Name Input & Save to Store (RESPONSIVE STACKING FOR MOBILE) */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 space-y-2 max-w-full">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <span className="text-xs font-black text-amber-400 uppercase tracking-wider">
                  ✏️ Create / Edit Chart Name:
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Active: {activeChartName}
                </span>
              </div>
              
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 max-w-full">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value.toUpperCase())}
                  placeholder="ENTER CHART NAME (e.g. KALYAN NIGHT)"
                  className="flex-1 bg-slate-950 border border-slate-600 text-amber-300 font-black rounded-lg px-3 py-2 text-xs outline-none focus:border-amber-400 uppercase tracking-wide min-w-0"
                />
                <button
                  onClick={handleSave}
                  className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 text-white px-4 py-2 rounded-lg text-xs font-black shadow-md shrink-0 active:scale-95"
                >
                  <Save className="w-4 h-4" /> Save to Store
                </button>
              </div>
            </div>

            {/* Load Saved Chart Dropdown & Clear */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 max-w-full">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <label className="text-[11px] text-slate-400 font-bold whitespace-nowrap">LOAD SAVED:</label>
                <select
                  value={activeChartName}
                  onChange={(e) => {
                    setActiveChartName(e.target.value);
                    setNameInput(e.target.value);
                  }}
                  className="bg-slate-900 text-white text-xs font-extrabold rounded-lg px-3 py-2 outline-none border border-slate-700 cursor-pointer w-full min-w-0"
                >
                  {Object.keys(charts).map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleClearAll}
                className="flex items-center justify-center gap-1 bg-red-950 border border-red-700 text-red-300 hover:bg-red-900 px-3 py-2 rounded-lg text-xs font-bold shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear Cells
              </button>
            </div>

            {/* Quick Fill Input */}
            <div className="flex gap-1.5 max-w-full">
              <input
                type="text"
                placeholder="Quick fill: 123456 → 12, 34, 56 | 8888 → 88, 88"
                value={quickInput}
                onChange={(e) => setQuickInput(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-blue-500 min-w-0"
              />
              <button onClick={handleQuickFill} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold shrink-0">Fill</button>
            </div>

            {/* Display Mode (Compact 15+ Rows Toggle) & Grid Sizing */}
            <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-800">
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => setIsCompact(v => !v)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all ${
                    isCompact ? 'bg-amber-500 text-slate-950 border-amber-400 font-extrabold' : 'bg-slate-900 text-slate-400 border-slate-700'
                  }`}
                >
                  {isCompact ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  {isCompact ? '15+ Rows View: ON' : 'Normal Rows View'}
                </button>

                <button
                  onClick={() => setShowStats(v => !v)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all ${
                    showStats ? 'bg-indigo-900 border-indigo-500 text-indigo-200' : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  🔢 {showStats ? 'Stats: ON' : 'Stats: OFF'}
                </button>
              </div>

              <div className="flex items-center gap-1.5 ml-auto">
                <span className="text-[10px] text-slate-400 font-bold">ROWS × COLS:</span>
                <input type="number" value={rowsInput} onChange={(e) => setRowsInput(e.target.value)}
                  className="w-14 bg-slate-900 border border-slate-700 text-white font-mono font-bold text-center py-1 rounded-lg text-xs" />
                <input type="number" value={colsInput} onChange={(e) => setColsInput(e.target.value)}
                  className="w-12 bg-slate-900 border border-slate-700 text-white font-mono font-bold text-center py-1 rounded-lg text-xs" />
                <button onClick={handleApplyResize} className="bg-amber-600 hover:bg-amber-500 text-white px-2.5 py-1 rounded-lg text-xs font-extrabold">Resize</button>
              </div>
            </div>
          </div>
        )}

        {/* 3. CHART TABLE GRID — EDGE-TO-EDGE WITH COMPACT 15+ ROW HEIGHT (IMAGE 1 MATCH) */}
        <div ref={containerRef} className="w-full overflow-x-auto shadow-xl border-x border-slate-300">

          {/* Dynamic Chart Title Banner */}
          <div className="bg-[#1e3a8a] text-white text-center font-black py-2 px-2 text-xs sm:text-sm uppercase tracking-wider border-b-2 border-blue-950 shadow-inner">
            {activeChartName} JODI CHART RECORD
          </div>

          <table className="w-full table-fixed white-chart-table border-collapse">
            {/* STICKY GOLDEN DAY HEADERS */}
            <thead className="sticky top-0 z-30 shadow-md">
              <tr className="bg-[#fbbf24] text-slate-950 border-b-2 border-slate-900">
                <th className="w-7 sm:w-10 text-center border border-slate-900 bg-[#f59e0b] text-slate-950 text-[10px] sm:text-xs font-black py-1">#</th>
                {Array.from({ length: colsInput }).map((_, c) => (
                  <th key={c} className="text-center border border-slate-900 text-slate-950 font-black text-xs sm:text-base py-1">
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
                    <td className="text-center font-black text-slate-950 text-[10px] sm:text-xs bg-[#fcd34d] border border-slate-800 align-middle">
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

                          {/* TOP: Total (green left) + Diff Total (red right) */}
                          {showStats && (
                            <div className="flex justify-between px-0.5 pt-0.5 leading-none">
                              <span
                                className="text-emerald-900 font-black font-mono tracking-tighter"
                                style={{ fontSize: isCompact ? '11px' : '14px', fontWeight: '900' }}
                              >
                                {total ?? ''}
                              </span>
                              <span
                                className="text-red-700 font-black font-mono tracking-tighter"
                                style={{ fontSize: isCompact ? '11px' : '14px', fontWeight: '900' }}
                              >
                                {diffTotal ?? ''}
                              </span>
                            </div>
                          )}

                          {/* MIDDLE: Jodi Number (Fits 15+ Rows on Mobile Image 1) */}
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
                              style={{
                                fontSize: isCompact ? 'clamp(18px, 5.2vw, 28px)' : 'clamp(24px, 6.5vw, 40px)',
                                fontWeight: '900'
                              }}
                            />
                          </div>

                          {/* BOTTOM: Open-Close Condition Pair */}
                          {showStats && (
                            <div
                              className="absolute bottom-0.5 left-0 right-0 text-center font-black font-mono text-slate-950 leading-none tracking-tight"
                              style={{ fontSize: isCompact ? '10px' : '14px', fontWeight: '900' }}
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
    </div>
  );
};
