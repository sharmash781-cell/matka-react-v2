import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useChart, isRedPair, calculateCN, calculateCloseCond, calculateTotal, calculateDiffTotal } from '../context/ChartContext';
import { Save, FileSpreadsheet, Globe, ArrowDown, Smartphone, Monitor, ChevronUp, ChevronDown } from 'lucide-react';

const COL_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Col 8'];
const OVERSCAN = 10;

// Helper to parse pasted numbers or quick fill strings into 2-digit Jodi pairs
export const parseJodiTokens = (input) => {
  if (!input) return [];
  const rawTokens = input.trim().split(/[\s,\t\r\n]+/).filter(Boolean);
  const finalTokens = [];

  for (const raw of rawTokens) {
    if (raw === '**' || raw.toUpperCase() === 'XX') {
      finalTokens.push('**');
    } else if (/^\d+$/.test(raw)) {
      // Continuous digits (e.g. 8888 -> ['88', '88'] or 697184 -> ['69', '71', '84'])
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

  const [nameInput, setNameInput] = useState(activeChartName || "TIME BAZAR");
  const [rowsInput, setRowsInput] = useState(activeChart ? activeChart.rows : 50);
  const [colsInput, setColsInput] = useState(activeChart ? activeChart.cols : 7);
  const [grid, setGrid] = useState([]);
  const [quickInput, setQuickInput] = useState('');
  
  // Mobile Header Collapse & Fullscreen Modes
  const [showTopControls, setShowTopControls] = useState(true);
  const [isCompactMobile, setIsCompactMobile] = useState(true);

  // Virtualization Scroll State
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef(null);

  const rowHeight = isCompactMobile ? 62 : 98;

  useEffect(() => {
    if (activeChart) {
      setNameInput(activeChartName);
      setRowsInput(activeChart.rows);
      setColsInput(activeChart.cols);
      setGrid(activeChart.data || []);
    } else {
      initEmptyGrid(50, 7);
    }
  }, [activeChartName, activeChart]);

  const initEmptyGrid = (r, c) => {
    const newGrid = [];
    for (let i = 0; i < r; i++) {
      const row = [];
      for (let j = 0; j < c; j++) {
        row.push({ val: '' });
      }
      newGrid.push(row);
    }
    setGrid(newGrid);
  };

  const handleApplyResize = (e) => {
    if (e) e.preventDefault();
    const r = Math.max(1, parseInt(rowsInput) || 12);
    const c = Math.min(8, Math.max(5, parseInt(colsInput) || 7));
    
    let newGrid = [];
    for (let i = 0; i < r; i++) {
      let row = [];
      for (let j = 0; j < c; j++) {
        if (grid[i] && grid[i][j]) {
          row.push(grid[i][j]);
        } else {
          row.push({ val: '' });
        }
      }
      newGrid.push(row);
    }
    setGrid(newGrid);
    saveChart(nameInput, r, c, newGrid);
  };

  const handleCellChange = (rIdx, cIdx, value) => {
    const updated = grid.map((row, r) =>
      row.map((cell, c) => {
        if (r === rIdx && c === cIdx) {
          return { val: value };
        }
        return cell;
      })
    );
    setGrid(updated);

    if (value.length === 2) {
      let nextR = rIdx;
      let nextC = cIdx + 1;
      if (nextC >= colsInput) {
        nextC = 0;
        nextR = rIdx + 1;
      }
      const nextId = `cell-${nextR}-${nextC}`;
      const nextEl = document.getElementById(nextId);
      if (nextEl) nextEl.focus();
    }
  };

  // Direct Paste Handler into Cell Inputs (Supports 8888 -> 88, 88 across cells!)
  const handleCellPaste = (e, startR, startC) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const tokens = parseJodiTokens(pastedText);
    if (tokens.length === 0) return;

    let tIdx = 0;
    let curR = startR;
    let curC = startC;

    const newGrid = grid.map(row => row.map(cell => ({ ...cell })));

    while (tIdx < tokens.length && curR < newGrid.length) {
      newGrid[curR][curC] = { val: tokens[tIdx++] };
      curC++;
      if (curC >= colsInput) {
        curC = 0;
        curR++;
      }
    }

    setGrid(newGrid);

    // Focus cell after last filled cell
    const nextId = `cell-${curR}-${curC}`;
    const nextEl = document.getElementById(nextId);
    if (nextEl) nextEl.focus();
  };

  const handleQuickFill = () => {
    const tokens = parseJodiTokens(quickInput);
    if (tokens.length === 0) return;

    let tIdx = 0;
    const updated = grid.map((row) =>
      row.map((cell) => {
        if (tIdx < tokens.length) {
          return { val: tokens[tIdx++] };
        }
        return cell;
      })
    );
    setGrid(updated);
    setQuickInput('');
  };

  const handleSave = () => {
    saveChart(nameInput, grid.length, colsInput, grid);
  };

  // Find Last Active Filled Row Index
  const lastFilledRowIndex = useMemo(() => {
    for (let r = grid.length - 1; r >= 0; r--) {
      if (grid[r] && grid[r].some(cell => cell.val && cell.val !== '')) {
        return r;
      }
    }
    return Math.max(0, grid.length - 1);
  }, [grid]);

  // Scroll to Last Filled Row Smoothly
  const scrollToLastFilledRow = () => {
    if (containerRef.current) {
      const targetScroll = Math.max(0, lastFilledRowIndex * rowHeight - 60);
      containerRef.current.scrollTo({
        top: targetScroll,
        behavior: 'smooth'
      });
    }
  };

  // Virtualized Row Range Calculation
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

  return (
    <div className="space-y-3">
      {/* Top Header Toggle Bar */}
      <div className="flex justify-between items-center bg-slate-900/90 border border-slate-800 px-3 py-2 rounded-2xl">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-emerald-400" />
          <select
            value={activeChartName}
            onChange={(e) => setActiveChartName(e.target.value)}
            className="bg-slate-950 text-white text-xs font-extrabold rounded-lg px-2 py-1 outline-none border border-slate-700 cursor-pointer"
          >
            {Object.keys(charts).map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
            ({grid.length} Rows × {colsInput} Cols)
          </span>
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

          <button
            onClick={handleSave}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 text-white px-3 py-1 rounded-xl text-[11px] font-bold shadow-md"
          >
            Save
          </button>
        </div>
      </div>

      {/* Collapsible Control Panel */}
      {showTopControls && (
        <div className="glass-panel p-3.5 md:p-5 rounded-3xl space-y-3 shadow-xl border border-slate-800 animate-fadeIn">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm md:text-lg font-black text-white">
                Chart Editor Controls
              </h2>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => setIsCompactMobile(!isCompactMobile)}
                className={`flex items-center gap-1 px-3 py-1 rounded-xl text-[11px] font-bold border transition ${
                  isCompactMobile ? 'bg-emerald-950 border-emerald-500 text-emerald-300' : 'bg-slate-900 border-slate-700 text-slate-300'
                }`}
              >
                {isCompactMobile ? <Smartphone className="w-3.5 h-3.5 text-emerald-400" /> : <Monitor className="w-3.5 h-3.5 text-slate-400" />}
                <span>{isCompactMobile ? '12-Week Mobile View' : 'Standard View'}</span>
              </button>
            </div>
          </div>

          {/* Quick Fill Box & Resize Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div className="flex gap-1.5">
              <input
                type="text"
                placeholder="Quick fill: 8888 or 69 71 84 57 12 ** 74"
                value={quickInput}
                onChange={(e) => setQuickInput(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-2.5 py-1.5 text-[11px] font-mono outline-none focus:border-blue-500"
              />
              <button
                onClick={handleQuickFill}
                className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-xl text-[11px] font-bold shadow-md"
              >
                Fill
              </button>
            </div>

            <div className="flex items-center justify-end gap-1.5">
              <span className="font-extrabold text-slate-300 text-[10px]">ROWS × COLS:</span>
              <input
                type="number"
                value={rowsInput}
                onChange={(e) => setRowsInput(e.target.value)}
                className="w-12 bg-slate-950 border border-slate-700 text-white font-mono font-bold text-center py-1 rounded-lg text-xs"
              />
              <input
                type="number"
                value={colsInput}
                onChange={(e) => setColsInput(e.target.value)}
                className="w-12 bg-slate-950 border border-slate-700 text-white font-mono font-bold text-center py-1 rounded-lg text-xs"
              />
              <button
                onClick={handleApplyResize}
                className="bg-amber-600 hover:bg-amber-500 text-white px-2.5 py-1 rounded-lg text-[11px] font-extrabold shadow-md"
              >
                Resize
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL-WIDTH MOBILE FIT VIRTUALIZED WHITE CARD TABLE */}
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

                        return (
                          <td key={cIdx} className="bg-white border border-slate-950 relative px-0.5 py-0.5 text-center align-top">
                            <div className="flex justify-between items-center w-full px-0.5 leading-none pt-0.5">
                              <span className="text-emerald-600 font-extrabold text-[9px] sm:text-xs font-mono">
                                {total !== null ? total : ''}
                              </span>
                              <span className="text-red-600 font-extrabold text-[9px] sm:text-xs font-mono">
                                {diffTotal !== null ? diffTotal : ''}
                              </span>
                            </div>

                            <div className="-mt-1 mb-1 flex items-center justify-center">
                              <input
                                id={`cell-${rIdx}-${cIdx}`}
                                type="text"
                                maxLength={2}
                                value={val}
                                onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                                onPaste={(e) => handleCellPaste(e, rIdx, cIdx)}
                                className={`w-full bg-transparent text-center text-lg xs:text-xl sm:text-3xl md:text-4xl font-black font-mono tracking-tighter sm:tracking-wider outline-none p-0 leading-none ${
                                  red ? 'red-pair-text' : 'normal-jodi-text'
                                }`}
                                placeholder=""
                              />
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

        <div className="flex flex-row justify-between items-center gap-2 pt-0.5 border-t border-slate-800">
          <span className="text-[10px] sm:text-xs text-slate-400 font-mono">
            Total Rows: <strong className="text-white">{grid.length}</strong> | Active: <strong className="text-emerald-400">#{lastFilledRowIndex + 1}</strong>
          </span>

          <button
            onClick={scrollToLastFilledRow}
            className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[10px] sm:text-xs px-3 py-1 rounded-lg shadow-md transition active:scale-95"
          >
            <ArrowDown className="w-3 h-3" /> Go to Row #{lastFilledRowIndex + 1}
          </button>
        </div>
      </div>
    </div>
  );
};
