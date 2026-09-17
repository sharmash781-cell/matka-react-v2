import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useChart, isRedPair, calculateCN, calculateCloseCond, calculateTotal, calculateDiffTotal } from '../context/ChartContext';
import { ArrowDown, Trash2, Settings2, Save, Store, PlusCircle, CheckCircle, Maximize2, Minimize2, ExternalLink } from 'lucide-react';

const COL_HEADERS = ['Mo', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Col 8'];
const OVERSCAN = 30;

export const parseJodiTokens = (input) => {
  if (!input) return [];
  const rawTokens = input.trim().split(/[\s,\t\r\n]+/).filter(Boolean);
  const finalTokens = [];
  for (const raw of rawTokens) {
    const upper = raw.toUpperCase();
    if (raw === '**' || raw === '*' || upper === 'XX' || upper === 'X') {
      finalTokens.push(raw === '*' ? '*' : upper === 'X' ? 'X' : upper === 'XX' ? 'XX' : '**');
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
  const { charts = {}, activeChartName, setActiveChartName, activeChart, saveChart, setActiveTab } = useChart();

  const [nameInput, setNameInput] = useState(activeChartName || 'NEW CHART');
  const [rowsInput, setRowsInput] = useState(activeChart ? activeChart.rows : 20);
  const [colsInput, setColsInput] = useState(activeChart ? activeChart.cols : 7);
  const [grid, setGrid] = useState([]);
  const [quickInput, setQuickInput] = useState('');
  const [showControls, setShowControls] = useState(true);
  const [showStats, setShowStats] = useState(false);
  const [isCompact, setIsCompact] = useState(true);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef(null);

  // Optimized row height allowing 12-14 rows on mobile screen
  const rowHeight = isCompact ? (showStats ? 54 : 34) : (showStats ? 68 : 45);

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

  const targetCols = useMemo(() => {
    const parsed = parseInt(colsInput);
    if (isNaN(parsed) || parsed < 1) return 7;
    return Math.min(8, Math.max(1, parsed));
  }, [colsInput]);

  const initEmptyGrid = (r, c) => {
    const safeC = Math.min(8, Math.max(1, parseInt(c) || 7));
    setGrid(Array.from({ length: r }, () => Array.from({ length: safeC }, () => ({ val: '' }))));
  };

  const handleCreateNewBlank = () => {
    const newName = `MY CHART ${Object.keys(charts).length + 1}`;
    setNameInput(newName);
    setRowsInput(20);
    setColsInput(7);
    initEmptyGrid(20, 7);
    setSaveSuccessMsg(`Created blank grid for "${newName}". Fill numbers & click Save to Store!`);
    setTimeout(() => setSaveSuccessMsg(''), 4000);
  };

  const handleApplyResize = () => {
    const r = Math.max(1, parseInt(rowsInput) || 20);
    const c = Math.min(8, Math.max(1, parseInt(colsInput) || 7));
    setColsInput(c);
    setRowsInput(r);

    const newGrid = Array.from({ length: r }, (_, i) =>
      Array.from({ length: c }, (_, j) => (grid[i] && grid[i][j]) ? grid[i][j] : { val: '' })
    );
    setGrid(newGrid);

    const cleanName = nameInput.trim().toUpperCase() || activeChartName || 'CUSTOM CHART';
    saveChart(cleanName, r, c, newGrid);
    setSaveSuccessMsg(`Resized chart "${cleanName}" to ${r} Rows × ${c} Cols!`);
    setTimeout(() => setSaveSuccessMsg(''), 3000);
  };

  const displayGrid = useMemo(() => {
    if (!grid) return [];
    const cCount = targetCols;

    const normalizedGrid = grid.map(row => {
      const r = Array.isArray(row) ? [...row] : [];
      if (r.length > cCount) {
        return r.slice(0, cCount);
      }
      while (r.length < cCount) {
        r.push({ val: '' });
      }
      return r;
    });

    let lastFilledIdx = -1;
    for (let r = normalizedGrid.length - 1; r >= 0; r--) {
      if (normalizedGrid[r] && normalizedGrid[r].some(cell => cell && cell.val && cell.val.trim() !== '')) {
        lastFilledIdx = r;
        break;
      }
    }

    const minEmptyBelow = 15;
    const requiredRows = Math.max(
      normalizedGrid.length + minEmptyBelow,
      lastFilledIdx + 1 + minEmptyBelow,
      35
    );

    const padded = normalizedGrid.map(row => [...row]);
    while (padded.length < requiredRows) {
      padded.push(Array.from({ length: cCount }, () => ({ val: '' })));
    }
    return padded;
  }, [grid, targetCols]);

  const handleCellChange = (rIdx, cIdx, value) => {
    const cCount = targetCols;
    let currentGrid = grid.map(row => {
      const r = Array.isArray(row) ? [...row] : [];
      if (r.length > cCount) return r.slice(0, cCount);
      while (r.length < cCount) r.push({ val: '' });
      return r;
    });

    while (currentGrid.length <= rIdx) {
      currentGrid.push(Array.from({ length: cCount }, () => ({ val: '' })));
    }

    let updated = currentGrid.map((row, r) =>
      row.map((cell, c) => (r === rIdx && c === cIdx) ? { val: value } : cell)
    );

    const valUpper = value.toUpperCase();
    if (value.length >= 2 || value === '*' || valUpper === 'X') {
      let nextR = rIdx, nextC = cIdx + 1;
      if (nextC >= cCount) {
        nextC = 0;
        nextR++;
      }

      if (nextR >= updated.length) {
        const emptyRow = Array.from({ length: cCount }, () => ({ val: '' }));
        updated = [...updated, emptyRow];
        setRowsInput(updated.length);
      }

      setGrid(updated);

      const cleanName = nameInput.trim().toUpperCase() || activeChartName || 'CUSTOM CHART';
      saveChart(cleanName, updated.length, cCount, updated);

      setTimeout(() => {
        const nextInput = document.getElementById(`cell-${nextR}-${nextC}`);
        if (nextInput) {
          nextInput.focus();
          if (nextInput.select) nextInput.select();
        }
      }, 15);
    } else {
      setGrid(updated);
      const cleanName = nameInput.trim().toUpperCase() || activeChartName || 'CUSTOM CHART';
      saveChart(cleanName, updated.length, cCount, updated);
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
    setSaveSuccessMsg(`Saved "${cleanName}" to Store repository! Opening Store...`);
    setTimeout(() => {
      setActiveTab('store');
    }, 600);
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

  const chartKeys = Object.keys(charts);
  const totalRows = displayGrid.length;
  const visibleHeight = typeof window !== 'undefined' ? window.innerHeight : 900;

  // Chunked virtualization: Render all rows directly for totalRows <= 250.
  // For totalRows > 250, update in 25-row chunks to eliminate per-pixel reflow jitter.
  const { startRow, endRow, topPadding, bottomPadding } = useMemo(() => {
    if (totalRows <= 250) return { startRow: 0, endRow: totalRows, topPadding: 0, bottomPadding: 0 };
    const chunkSize = 25;
    const currentChunk = Math.floor(scrollTop / (chunkSize * rowHeight));
    const s = Math.max(0, (currentChunk - 1) * chunkSize);
    const e = Math.min(totalRows, (currentChunk + 3) * chunkSize);
    return { startRow: s, endRow: e, topPadding: s * rowHeight, bottomPadding: (totalRows - e) * rowHeight };
  }, [scrollTop, totalRows, rowHeight]);

  const visibleRows = useMemo(() => displayGrid.slice(startRow, endRow), [displayGrid, startRow, endRow]);

  return (
    <div className="min-h-screen bg-[#f7e3c4] text-slate-950 font-poppins selection:bg-pink-500 selection:text-white pb-20">

      {/* CENTERED DESKTOP VIEW WITH SIDE MARGINS */}
      <div className="max-w-3xl mx-auto px-1 sm:px-3">

        {/* 1. TOP HEADER PANEL WITH STORE BUTTON BESIDE EDIT CONTROLS */}
        <div className="my-2 bg-slate-950 text-slate-100 border border-slate-800 rounded-2xl p-3 shadow-xl space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            
            {/* Dynamic Chart Name & Last Jodi */}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
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

            {/* Top Action Buttons (STORE BUTTON BESIDE EDIT CONTROLS) */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setShowStats(v => !v)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-black shadow transition-all active:scale-95 border ${
                  showStats ? 'bg-indigo-950 border-indigo-500 text-indigo-200' : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}
              >
                🔢 <span>Stats: {showStats ? 'ON' : 'OFF'}</span>
              </button>

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
                className="flex items-center gap-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white px-3 py-1.5 rounded-xl text-xs font-black shadow-lg transition-all active:scale-95 border border-purple-400"
              >
                <Store className="w-3.5 h-3.5" />
                <span>Store</span>
                <span className="bg-purple-950 text-purple-200 px-1.5 py-0.2 rounded-full text-[10px] font-mono">
                  {chartKeys.length}
                </span>
              </button>
            </div>
          </div>

          {/* Save Success Toast */}
          {saveSuccessMsg && (
            <div className="flex items-center justify-between bg-emerald-950 border border-emerald-500 text-emerald-200 text-xs px-3 py-2 rounded-xl font-bold animate-fadeIn">
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                {saveSuccessMsg}
              </span>
              <button
                onClick={() => setActiveTab('store')}
                className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black px-2.5 py-1 rounded-lg shadow flex items-center gap-1"
              >
                Open Store <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* 2. EXPANDABLE EDIT CONTROLS PANEL */}
        {showControls && (
          <div className="mb-3 bg-slate-950 text-slate-100 border-2 border-slate-700 rounded-2xl p-3 shadow-2xl space-y-3 animate-fadeIn w-full box-border">
            
            {/* Quick Action: Start New Blank Chart */}
            <div className="flex items-center justify-between flex-wrap gap-2 bg-slate-900/90 border border-slate-700 rounded-xl p-2.5">
              <span className="text-xs font-black text-slate-300">Create New Blank Grid:</span>
              <button
                onClick={handleCreateNewBlank}
                className="flex items-center gap-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black px-3 py-1.5 rounded-lg text-xs shadow-md transition-all active:scale-95"
              >
                <PlusCircle className="w-4 h-4" /> Create Blank Grid
              </button>
            </div>

            {/* Chart Name Input & Save to Store */}
            <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 space-y-2.5 w-full box-border">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <span className="text-xs font-black text-amber-400 uppercase tracking-wider">
                  ✏️ Create / Edit Chart Name:
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Active: {activeChartName}
                </span>
              </div>
              
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value.toUpperCase())}
                placeholder="ENTER CHART NAME (e.g. KALYAN NIGHT)"
                className="w-full bg-slate-950 border border-slate-600 text-amber-300 font-black rounded-lg px-3 py-2.5 text-xs outline-none focus:border-amber-400 uppercase tracking-wide box-border"
              />

              <button
                onClick={handleSave}
                className="w-full flex items-center justify-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-90 text-white px-4 py-2.5 rounded-lg text-xs font-black shadow-md active:scale-95 box-border"
              >
                <Save className="w-4 h-4" /> 💾 Save Chart to Store & View Card
              </button>
            </div>

            {/* LIVE EXISTING CHARTS LIST IN STORE */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-purple-300 uppercase tracking-wider flex items-center gap-1">
                  📦 Saved Charts in Store ({chartKeys.length}):
                </span>
                <button
                  onClick={() => setActiveTab('store')}
                  className="text-[10px] text-purple-400 hover:underline font-bold flex items-center gap-0.5"
                >
                  Manage All →
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {chartKeys.map((name) => {
                  const isActive = name === activeChartName;
                  return (
                    <button
                      key={name}
                      onClick={() => {
                        setActiveChartName(name);
                        setNameInput(name);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black tracking-wide uppercase transition-all flex items-center gap-1 ${
                        isActive
                          ? 'bg-amber-400 text-slate-950 shadow-md font-extrabold ring-2 ring-amber-300'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                      }`}
                    >
                      <span>{name}</span>
                      {isActive && <CheckCircle className="w-3 h-3 text-slate-950" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Load Saved Chart Dropdown & Clear */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full">
              <div className="flex items-center gap-2 flex-1">
                <label className="text-[11px] text-slate-400 font-bold whitespace-nowrap">LOAD SAVED:</label>
                <select
                  value={activeChartName}
                  onChange={(e) => {
                    setActiveChartName(e.target.value);
                    setNameInput(e.target.value);
                  }}
                  className="bg-slate-900 text-white text-xs font-extrabold rounded-lg px-3 py-2 outline-none border border-slate-700 cursor-pointer w-full"
                >
                  {chartKeys.map((name) => (
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
            <div className="flex gap-1.5 w-full">
              <input
                type="text"
                placeholder="Quick fill: 123456 → 12, 34, 56"
                value={quickInput}
                onChange={(e) => setQuickInput(e.target.value)}
                className="flex-1 bg-slate-900 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-blue-500 min-w-0"
              />
              <button onClick={handleQuickFill} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold shrink-0">Fill</button>
            </div>

            {/* Display Mode & Grid Sizing */}
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

        {/* 3. CHART TABLE GRID (Ultra-Smooth DPBoss Scrolling Engine) */}
        <div 
          ref={containerRef} 
          className="w-full max-w-3xl mx-auto overflow-x-auto shadow-2xl rounded-lg border border-slate-400 bg-[#fef3c7]"
          style={{
            WebkitOverflowScrolling: 'touch',
            willChange: 'scroll-position',
            contain: 'content',
            transform: 'translateZ(0)'
          }}
        >

          {/* Dynamic Chart Title Banner */}
          <div className="bg-[#1e3a8a] text-white text-center font-black py-2 px-2 text-xs sm:text-sm uppercase tracking-wider border-b-2 border-blue-950 shadow-inner">
            {activeChartName} JODI CHART RECORD
          </div>

          <table className="w-full table-fixed white-chart-table border-collapse">
            {/* STICKY GOLDEN DAY HEADERS */}
            <thead className="sticky top-0 z-30 shadow-md">
              <tr className="bg-[#fbbf24] text-slate-950 border-b-2 border-slate-900">
                <th style={{ width: '36px', minWidth: '36px' }} className="text-center border border-slate-900 bg-[#f59e0b] text-slate-950 text-[10px] sm:text-xs font-black py-1">#</th>
                {Array.from({ length: targetCols }).map((_, c) => (
                  <th key={c} style={{ width: `${(100 / targetCols).toFixed(2)}%` }} className="text-center border border-slate-900 text-slate-950 font-black text-xs sm:text-base py-1">
                    {COL_HEADERS[c] || `C${c + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topPadding > 0 && (
                <tr><td colSpan={targetCols + 1} style={{ height: topPadding, padding: 0, border: 'none' }} /></tr>
              )}

              {visibleRows.map((row, relIdx) => {
                const rIdx = startRow + relIdx;
                const safeRow = row.slice(0, targetCols);
                return (
                  <tr key={rIdx} style={{ height: rowHeight }}>
                    {/* Row Number Column */}
                    <td className="text-center font-black text-slate-950 text-[10px] sm:text-xs bg-[#fcd34d] border border-slate-800 align-middle">
                      {rIdx + 1}
                    </td>
                    {safeRow.map((cell, cIdx) => {
                      const val = cell.val || '';
                      const total = calculateTotal(val);
                      const diffTotal = calculateDiffTotal(val);
                      const cn = calculateCN(val);
                      const closeCond = calculateCloseCond(val);
                      const red = isRedPair(val);
                      return (
                        <td
                          key={cIdx}
                          className="border border-slate-800 relative text-center align-middle transition-colors hover:bg-amber-200 p-0"
                          style={{ backgroundColor: '#fef3c7' }}
                        >
                          <div className={`flex flex-col justify-between items-center h-full w-full ${showStats ? 'py-0.5 px-0.5' : 'justify-center'}`}>
                            {/* TOP: Total (emerald left) + Diff Total (red right) */}
                            {showStats && (
                              <div className="flex justify-between items-center w-full px-1 leading-none pt-0.5">
                                <span className="text-emerald-800 font-black font-mono text-[10px] sm:text-xs">
                                  {total ?? ''}
                                </span>
                                <span className="text-red-700 font-black font-mono text-[10px] sm:text-xs">
                                  {diffTotal ?? ''}
                                </span>
                              </div>
                            )}

                            {/* MIDDLE: Jodi Number */}
                            <div className="flex items-center justify-center w-full my-auto">
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
                                  fontSize: isCompact
                                    ? (showStats ? 'clamp(15px, 4vw, 22px)' : 'clamp(18px, 5.2vw, 28px)')
                                    : (showStats ? 'clamp(20px, 5vw, 30px)' : 'clamp(24px, 6.5vw, 40px)'),
                                  fontWeight: '900'
                                }}
                              />
                            </div>

                            {/* BOTTOM: Open-Close Condition Pair */}
                            {showStats && (
                              <div className="w-full text-center leading-none pb-0.5">
                                {cn !== null && closeCond !== null ? (
                                  <span className="inline-block text-[10px] sm:text-xs font-black font-mono text-slate-900 bg-amber-200/90 border border-amber-300/80 rounded px-1 shadow-xs">
                                    {`${cn}-${closeCond}`}
                                  </span>
                                ) : (
                                  <span className="text-[10px] opacity-0">-</span>
                                )}
                              </div>
                            )}
                          </div>
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

          {/* TABLE FOOTER ACTIONS */}
          <div className="flex items-center justify-between flex-wrap gap-2 p-2 bg-[#fbbf24] border-t-2 border-slate-900 text-xs font-mono font-black text-slate-950">
            <span>Showing {displayGrid.length} Weeks</span>
            <button
              onClick={scrollToLastRow}
              className="bg-slate-900 text-amber-400 hover:bg-slate-800 px-3 py-1 rounded-lg shadow active:scale-95 transition text-xs font-mono font-black"
            >
              Go to Bottom ⬇
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
