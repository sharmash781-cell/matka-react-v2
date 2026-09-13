import React, { useState, useEffect } from 'react';
import { useChart } from '../context/ChartContext';
import { Archive, Table, Zap, Brain, Trash2, Hash, PlusCircle, X, RefreshCw } from 'lucide-react';

export const ChartStore = () => {
  const { charts = {}, setActiveChartName, deleteChart, resetToDefaultCharts, setActiveTab, saveChart } = useChart();
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRows, setNewRows] = useState(20);
  const [newCols, setNewCols] = useState(7);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const safeCharts = charts && typeof charts === 'object' && Object.keys(charts).length > 0 ? charts : {};
  const chartKeys = Object.keys(safeCharts);

  // Auto-heal: If store ever has 0 charts, automatically restore default market presets!
  useEffect(() => {
    if (chartKeys.length === 0) {
      resetToDefaultCharts();
    }
  }, [chartKeys.length, resetToDefaultCharts]);

  const handleOpenIn = (chartName, tab) => {
    if (!chartName) return;
    setActiveChartName(chartName);
    const targetTab = tab === 'ai-trainer' ? 'ai' : tab === 'predictor' ? 'predict' : tab;
    setActiveTab(targetTab);
  };

  const handleCreateNew = () => {
    const cleanName = newName.trim().toUpperCase();
    if (!cleanName) return;
    const r = Math.max(1, parseInt(newRows) || 20);
    const c = Math.min(8, Math.max(5, parseInt(newCols) || 7));
    const emptyData = Array.from({ length: r }, () => Array.from({ length: c }, () => ({ val: '' })));
    saveChart(cleanName, r, c, emptyData);
    setNewName('');
    setNewRows(20);
    setNewCols(7);
    setShowNewForm(false);
    setActiveChartName(cleanName);
    setActiveTab('editor');
  };

  const handleDelete = (name) => {
    if (confirmDelete === name) {
      deleteChart(name);
      setConfirmDelete(null);
    } else {
      setConfirmDelete(name);
    }
  };

  return (
    <div className="space-y-4 px-2 py-2 max-w-5xl mx-auto min-h-[80vh] font-poppins">
      
      {/* Store Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-3.5 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-yellow-500/20 border border-yellow-500/30 rounded-2xl">
            <Archive className="w-6 h-6 text-yellow-400" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white">Chart Store Repository</h2>
            <p className="text-[10px] text-slate-400 font-mono">
              {chartKeys.length} saved market charts in storage
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={resetToDefaultCharts}
            className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 shrink-0"
            title="Restore default market charts"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Restore Defaults
          </button>
          <button
            onClick={() => setShowNewForm(v => !v)}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-xl text-xs font-black shadow-md transition-all active:scale-95 shrink-0"
          >
            <PlusCircle className="w-4 h-4" /> New Chart
          </button>
        </div>
      </div>

      {/* New Chart Form */}
      {showNewForm && (
        <div className="bg-slate-900 border-2 border-emerald-500/80 rounded-2xl p-4 space-y-3 shadow-2xl animate-fadeIn">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-emerald-400 uppercase tracking-wider">➕ Create New Blank Chart</h3>
            <button onClick={() => setShowNewForm(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex flex-col gap-2.5">
            <input
              type="text"
              placeholder="ENTER CHART NAME (e.g. KALYAN NIGHT)"
              value={newName}
              onChange={(e) => setNewName(e.target.value.toUpperCase())}
              className="bg-slate-950 border border-slate-700 text-amber-300 font-black rounded-xl px-3.5 py-2.5 text-xs outline-none focus:border-emerald-400 uppercase tracking-wide"
            />
            <div className="flex gap-2 items-center flex-wrap">
              <label className="text-[10px] text-slate-400 font-bold">ROWS:</label>
              <input type="number" value={newRows} onChange={(e) => setNewRows(e.target.value)}
                className="w-16 bg-slate-950 border border-slate-700 text-white font-mono font-bold text-center py-1.5 rounded-lg text-xs" />
              <label className="text-[10px] text-slate-400 font-bold ml-1">COLS:</label>
              <input type="number" value={newCols} onChange={(e) => setNewCols(e.target.value)}
                className="w-14 bg-slate-950 border border-slate-700 text-white font-mono font-bold text-center py-1.5 rounded-lg text-xs" />
              <button onClick={handleCreateNew}
                className="ml-auto bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-black shadow-md transition-all active:scale-95">
                Create & Open Grid
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chart Cards */}
      {chartKeys.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl text-center py-16 px-4 text-slate-400 shadow-inner">
          <Archive className="w-12 h-12 mx-auto mb-3 text-slate-600 animate-spin" />
          <p className="font-black text-white text-base">Loading Default Charts...</p>
          <button
            onClick={resetToDefaultCharts}
            className="mt-4 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-xs font-black shadow-md inline-flex items-center gap-1.5"
          >
            <RefreshCw className="w-4 h-4" /> Load Default Markets
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pb-10">
          {chartKeys.map((name) => {
            const chart = safeCharts[name] || {};
            const rows = chart.rows || (chart.data ? chart.data.length : 20);
            const cols = chart.cols || (chart.data && chart.data[0] ? chart.data[0].length : 7);
            
            let filledCount = 0;
            if (chart.data && Array.isArray(chart.data)) {
              chart.data.forEach(row => {
                if (Array.isArray(row)) {
                  row.forEach(cell => { if (cell && cell.val && cell.val !== '') filledCount++; });
                }
              });
            }

            return (
              <div key={name}
                className="bg-slate-900 border border-slate-800 hover:border-amber-500/60 rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-xl transition-all duration-200"
              >
                {/* Chart Name & Delete */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-black text-amber-400 tracking-wide uppercase leading-snug">{name}</h3>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      Updated: {chart.updatedAt ? new Date(chart.updatedAt).toLocaleDateString() : 'Today'}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(name)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition ${
                      confirmDelete === name
                        ? 'bg-red-600 border-red-500 text-white animate-pulse'
                        : 'bg-slate-950 border-slate-800 text-red-400 hover:bg-red-950'
                    }`}
                  >
                    <Trash2 className="w-3 h-3" />
                    {confirmDelete === name ? 'Confirm Delete?' : 'Delete'}
                  </button>
                </div>

                {/* Grid Metadata Badges */}
                <div className="flex flex-wrap gap-1.5 text-[10px] font-mono text-slate-300">
                  <span className="bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800 flex items-center gap-1">
                    <Hash className="w-3 h-3 text-blue-400" /> {rows} × {cols} Grid
                  </span>
                  <span className="bg-slate-950 px-2 py-0.5 rounded-lg border border-slate-800 flex items-center gap-1">
                    <Table className="w-3 h-3 text-emerald-400" /> {filledCount} cells filled
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-800/80">
                  <button onClick={() => handleOpenIn(name, 'editor')}
                    className="flex items-center justify-center gap-1 bg-slate-800 hover:bg-slate-700 text-blue-300 border border-slate-700 py-2 rounded-xl text-[11px] font-extrabold transition">
                    <Table className="w-3.5 h-3.5" /> Edit Chart
                  </button>
                  <button onClick={() => handleOpenIn(name, 'ai')}
                    className="flex items-center justify-center gap-1 bg-slate-800 hover:bg-slate-700 text-purple-300 border border-slate-700 py-2 rounded-xl text-[11px] font-extrabold transition">
                    <Brain className="w-3.5 h-3.5" /> AI Train
                  </button>
                  <button onClick={() => handleOpenIn(name, 'predict')}
                    className="col-span-2 flex items-center justify-center gap-1.5 bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:opacity-90 text-white py-2 rounded-xl text-[11px] font-black shadow-md">
                    <Zap className="w-3.5 h-3.5" /> Launch Predictor
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
