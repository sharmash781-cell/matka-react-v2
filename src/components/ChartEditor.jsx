import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useChart, isRedPair, calculateCN, calculateCloseCond, calculateTotal, calculateDiffTotal } from '../context/ChartContext';
import { Save, FileSpreadsheet, Globe, ArrowDown, Smartphone, Monitor } from 'lucide-react';

const COL_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Col 8'];
const OVERSCAN = 10;

export const ChartEditor = () => {
  const { charts, activeChartName, setActiveChartName, activeChart, saveChart } = useChart();

  const [nameInput, setNameInput] = useState(activeChartName || "TIME BAZAR");
  const [rowsInput, setRowsInput] = useState(activeChart ? activeChart.rows : 50);
  const [colsInput, setColsInput] = useState(activeChart ? activeChart.cols : 7);
  const [grid, setGrid] = useState([]);
  const [quickInput, setQuickInput] = useState('');
  
  // Compact Mobile Mode toggle (68px cell height for clear condition visibility)
  const [isCompactMobile, setIsCompactMobile] = useState(true);

  // Virtualization Scroll State
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef(null);

  const rowHeight = isCompactMobile ? 68 : 105;

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

  const handleQuickFill = () => {
    const tokens = quickInput.trim().split(/[\s,\t]+/).filter(t => t !== '');
    if (tokens.length === 0) return;

    let tIdx = 0;
    const updated = grid.map((row) =>
      row.map((cell) => {
        if (tIdx < tokens.length) {
          const raw = tokens[tIdx++];
          const val = raw === '**' || raw === 'XX' ? '**' : raw.padStart(2, '0').slice(-2);
          return { val };
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
  const visibleHeight = 740;

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
    <div className="space-y-4 md:space-y-6">
      {/* Control Toolbar */}
      <div className="glass-panel p-4 md:p-6 rounded-3xl space-y-4 shadow-2xl">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 border border-blue-500/30 rounded-2xl">
              <FileSpreadsheet className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg md:text-2xl font-black text-white tracking-tight">
                Number-Cal <span className="text-emerald-400">Chart Editor</span>
              </h2>
              <p className="text-[11px] text-slate-400">12+ Week Mobile Fit Grid (Clear Condition Visibility)</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            {/* Market Selector */}
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-xl">
              <Globe className="w-4 h-4 text-emerald-400" />
              <select
                value={activeChartName}
                onChange={(e) => setActiveChartName(e.target.value)}
                className="bg-transparent text-white text-xs font-bold outline-none cursor-pointer"
              >
                {Object.keys(charts).map((name) => (
                  <option key={name} value={name} className="bg-slate-900 text-white">{name}</option>
                ))}
              </select>
            </div>

            {/* View Mode Toggle */}
            <button
              onClick={() => setIsCompactMobile(!isCompactMobile)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                isCompactMobile
                  ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300'
                  : 'bg-slate-900 border-slate-700 text-slate-300'
              }`}
            >
              {isCompactMobile ? (
                <>
                  <Smartphone className="w-4 h-4 text-emerald-400" /> 📱 12-Week Mobile View
                </>
              ) : (
                <>
                  <Monitor className="w-4 h-4 text-slate-400" /> Standard Desktop View
                </>
              )}
            </button>

            {/* Quick Navigation */}
            <button
              onClick={scrollToLastFilledRow}
              className="flex items-center gap-1 bg-slate-900 border border-slate-700 hover:bg-slate-800 text-emerald-300 px-3 py-1.5 rounded-xl text-xs font-bold transition"
            >
              <ArrowDown className="w-3.5 h-3.5 text-emerald-400" /> Row #{lastFilledRowIndex + 1}
            </button>

            <button
              onClick={handleSave}
              className="flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-90 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold shadow-md"
            >
              <Save className="w-3.5 h-3.5" /> Save
            </button>
          </div>
        </div>

        {/* Quick Fill Box & Resize Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-center">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Quick fill values like: 69 71 84 57 12 ** 74"
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              className="flex-1 bg-slate-900/90 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-3 py-2 text-xs font-mono outline-none focus:border-blue-500"
            />
            <button
              onClick={handleQuickFill}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-md transition"
            >
              Fill
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 text-xs">
            <span className="font-extrabold text-slate-300">ROWS × COLS:</span>
            <input
              type="number"
              value={rowsInput}
              onChange={(e) => setRowsInput(e.target.value)}
              className="w-14 bg-slate-900 border border-slate-700 text-white font-mono font-bold text-center py-1.5 rounded-xl text-xs"
            />
            <input
              type="number"
              value={colsInput}
              onChange={(e) => setColsInput(e.target.value)}
              className="w-14 bg-slate-900 border border-slate-700 text-white font-mono font-bold text-center py-1.5 rounded-xl text-xs"
            />
            <button
              onClick={handleApplyResize}
              className="bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 rounded-xl text-xs font-extrabold shadow-md transition"
            >
              Resize
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE-FIT VIRTUALIZED WHITE CARD TABLE */}
      <div className="glass-panel p-2 md:p-4 rounded-3xl shadow-2xl space-y-3">
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="overflow-y-auto overflow-x-auto max-h-[740px] border-2 border-slate-950 rounded-2xl"
        >
          <div className="min-w-[480px] sm:min-w-[650px]">
            <table className="white-chart-table">
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
                      {/* S.No column on the left */}
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

                        return (
                          <td key={cIdx} className="bg-white border-2 border-slate-950 relative px-1 py-0.5 text-center align-top min-w-[56px] sm:min-w-[85px]">
                            {/* Top Row Indicators: Total Left, Diff Right */}
                            <div className="flex justify-between items-center w-full px-0.5 leading-none pt-0.5">
                              <span className="text-emerald-600 font-extrabold text-[11px] sm:text-xs font-mono">
                                {total !== null ? total : ''}
                              </span>
                              <span className="text-red-600 font-extrabold text-[11px] sm:text-xs font-mono">
                                {diffTotal !== null ? diffTotal : ''}
                              </span>
                            </div>

                            {/* Center Jodi Number: Shifted UP (-mt-2 mb-2) */}
                            <div className="-mt-2 mb-2 flex items-center justify-center">
                              <input
                                id={`cell-${rIdx}-${cIdx}`}
                                type="text"
                                maxLength={2}
                                value={val}
                                onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                                className={`w-full bg-transparent text-center text-2xl sm:text-3xl md:text-4xl font-black font-mono tracking-wider outline-none p-0 leading-none ${
                                  red ? 'red-pair-text' : 'normal-jodi-text'
                                }`}
                                placeholder=""
                              />
                            </div>

                            {/* Bottom Condition Pair */}
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

        {/* BOTTOM PANEL NAVIGATION BAR */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-2 pt-1 border-t border-slate-800/80">
          <span className="text-[11px] text-slate-400 font-mono">
            Total Rows: <strong className="text-white">{grid.length}</strong> | Active Row: <strong className="text-emerald-400">#{lastFilledRowIndex + 1}</strong>
          </span>

          <button
            onClick={scrollToLastFilledRow}
            className="flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs px-4 py-2 rounded-xl shadow-md transition active:scale-95"
          >
            <ArrowDown className="w-3.5 h-3.5" /> Go to Row #{lastFilledRowIndex + 1}
          </button>
        </div>
      </div>
    </div>
  );
};
