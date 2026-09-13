import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useChart, isRedPair, calculateCN, calculateCloseCond, calculateTotal, calculateDiffTotal } from '../context/ChartContext';
import { ArrowDown, Trash2, Settings2, PlusCircle } from 'lucide-react';

const COL_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Col 8'];
const OVERSCAN = 20;

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

  const [nameInput, setNameInput] = useState(activeChartName || 'MY CHART');
  const [rowsInput, setRowsInput] = useState(activeChart ? activeChart.rows : 20);
  const [colsInput, setColsInput] = useState(activeChart ? activeChart.cols : 7);
  const [grid, setGrid] = useState([]);
  const [quickInput, setQuickInput] = useState('');
  const [showControls, setShowControls] = useState(false);
  const [showStats, setShowStats] = useState(true);
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef(null);
  const rowHeight = showStats ? 82 : 60;

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

  const handleApplyResize = () => {
    const r = Math.max(1, parseInt(rowsInput) || 12);
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

  // Save chart under nameInput (creates new if different name)
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
    <div className="relative">
      {/* Floating Buttons */}
      <div className="fixed top-2 right-2 z-50 flex items-center gap-1.5">
        <button
          onClick={scrollToLastRow}
          className="flex items-center gap-1 bg-emerald-600/90 backdrop-blur text-white px-2.5 py-1.5 rounded-xl text-[11px] font-bold shadow-lg"
        >
          <ArrowDown className="w-3.5 h-3.5" /> #{lastFilledRowIndex + 1}
        </button>
        <button
          onClick={() => setShowControls(v => !v)}
          className={`flex items-center gap-1 backdrop-blur px-2.5 py-1.5 rounded-xl text-[11px] font-bold shadow-lg border ${
            showControls ? 'bg-pink-700/90 border-pink-500 text-white' : 'bg-slate-800/90 border-slate-700 text-slate-200'
          }`}
        >
          <Settings2 className="w-3.5 h-3.5" />
          {showControls ? 'Close' : 'Edit'}
        </button>
      </div>

      {/* Slide-down Controls Panel */}
      {showControls && (
        <div className="sticky top-0 z-40 bg-slate-950/97 backdrop-blur-md border-b border-slate-700 px-3 py-3 shadow-2xl space-y-2.5 animate-fadeIn">

          {/* Row 1: Chart Name + Save */}
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-slate-400 font-bold whitespace-nowrap">CHART NAME:</label>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value.toUpperCase())}
              placeholder="e.g. TIME BAZAR"
              className="flex-1 bg-slate-900 border border-slate-600 text-white font-extrabold rounded-lg px-2 py-1.5 text-xs outline-none focus:border-blue-500 uppercase"
            />
          </div>

          {/* Row 2: Chart Selector + actions */}
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-[10px] text-slate-400 font-bold whitespace-nowrap">LOAD:</label>
            <select
              value={activeChartName}
              onChange={(e) => {
                setActiveChartName(e.target.value);
                setNameInput(e.target.value);
              }}
              className="bg-slate-900 text-white text-xs font-extrabold rounded-lg px-2 py-1.5 outline-none border border-slate-700 cursor-pointer flex-1"
            >
              {Object.keys(charts).map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold">Save</button>
            <button onClick={handleClearAll} className="flex items-center gap-1 bg-red-950 border border-red-700 text-red-300 hover:bg-red-900 px-2.5 py-1.5 rounded-lg text-[11px] font-bold">
              <Trash2 className="w-3 h-3" /> Clear
            </button>
          </div>

          {/* Row 3: Quick Fill */}
          <div className="flex gap-1.5">
            <input
              type="text"
              placeholder="Quick fill: 123456 → 12,34,56 | 8888 → 88,88"
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-2.5 py-1.5 text-[11px] font-mono outline-none focus:border-blue-500"
            />
            <button onClick={handleQuickFill} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-xl text-[11px] font-bold">Fill</button>
          </div>

          {/* Row 4: Stats toggle + Rows/Cols resize */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowStats(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all ${
                showStats
                  ? 'bg-indigo-900/80 border-indigo-500 text-indigo-200'
                  : 'bg-slate-900 border-slate-700 text-slate-400'
              }`}
            >
              🔢 {showStats ? 'Stats: ON' : 'Stats: OFF'}
            </button>
            <span className="text-[10px] text-slate-400 font-bold ml-auto">ROWS × COLS:</span>
            <input type="number" value={rowsInput} onChange={(e) => setRowsInput(e.target.value)}
              className="w-14 bg-slate-900 border border-slate-700 text-white font-mono font-bold text-center py-1.5 rounded-lg text-xs" />
            <input type="number" value={colsInput} onChange={(e) => setColsInput(e.target.value)}
              className="w-14 bg-slate-900 border border-slate-700 text-white font-mono font-bold text-center py-1.5 rounded-lg text-xs" />
            <button onClick={handleApplyResize} className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-lg text-[11px] font-extrabold">Resize</button>
          </div>

          {/* Row 5: Info */}
          <div className="text-[10px] text-slate-500 font-mono">
            {grid.length} Rows × {colsInput} Cols | Active Row #{lastFilledRowIndex + 1}
          </div>
        </div>
      )}

      {/* PURE CHART TABLE — EDGE TO EDGE, NO PADDING */}
      <div ref={containerRef} className="w-full overflow-x-auto bg-slate-950">
        <table className="w-full table-fixed white-chart-table">
          <thead className="sticky top-0 z-30">
            <tr>
              <th className="w-8 sm:w-10 text-center border border-slate-950 bg-slate-700 text-white text-[11px] font-black py-1.5">#</th>
              {Array.from({ length: colsInput }).map((_, c) => (
                <th key={c} className="text-center border border-slate-950 bg-slate-700 text-white font-black text-xs sm:text-sm py-1.5">
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
                  <td className="text-center font-black text-white text-[11px] bg-slate-800 border border-slate-700 align-middle">
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
                      <td key={cIdx} className="border border-slate-700 relative text-center align-top"
                        style={{ backgroundColor: '#f5e6c8' }}>

                        {/* TOP: total (green left) + diffTotal (red right) */}
                        {showStats && (
                          <div className="flex justify-between px-1 pt-0.5 leading-none">
                            <span className="text-emerald-800 font-black font-mono" style={{ fontSize: '12px' }}>
                              {total ?? ''}
                            </span>
                            <span className="text-red-700 font-black font-mono" style={{ fontSize: '12px' }}>
                              {diffTotal ?? ''}
                            </span>
                          </div>
                        )}

                        {/* MIDDLE: Big Jodi number */}
                        <div className={`flex items-center justify-center ${showStats ? '' : 'h-full'}`}>
                          <input
                            id={`cell-${rIdx}-${cIdx}`}
                            type="text"
                            maxLength={2}
                            value={val}
                            onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                            onPaste={(e) => handleCellPaste(e, rIdx, cIdx)}
                            className={`w-full bg-transparent text-center font-black font-mono outline-none p-0 leading-none ${
                              red ? 'text-red-600' : 'text-slate-950'
                            }`}
                            style={{ fontSize: 'clamp(22px, 6vw, 38px)' }}
                          />
                        </div>

                        {/* BOTTOM: open-close condition */}
                        {showStats && (
                          <div
                            className="absolute bottom-0.5 left-0 right-0 text-center font-black font-mono text-slate-800 leading-none"
                            style={{ fontSize: '12px' }}
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
