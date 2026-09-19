import React, { useState } from 'react';
import { useChart } from '../context/ChartContext';
import { Archive, Table, Zap, Brain, Trash2, Hash, PlusCircle, X } from 'lucide-react';

export const ChartStore = () => {
  const {
    charts = {},
    setActiveChartName,
    deleteChart,
    clearAllCharts,
    setActiveTab,
    saveChart,
    setShowAdminModal
  } = useChart();
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRows, setNewRows] = useState(20);
  const [newCols, setNewCols] = useState(7);

  const safeCharts = charts && typeof charts === 'object' ? charts : {};
  const chartKeys = Object.keys(safeCharts);

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

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          {chartKeys.length > 0 && (
            <button
              onClick={clearAllCharts}
              className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-black transition-all active:scale-95 shrink-0 bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-800"
              title="Wipe all charts permanently"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear All Store
            </button>
          )}

          <button
            onClick={() => setShowAdminModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black shadow-lg transition-all active:scale-95 shrink-0 border bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700"
            title="Repository Settings & Backup"
          >
            <Archive className="w-4 h-4 text-amber-400" />
            <span>Manage Store &amp; Backup</span>
          </button>

          <button
            onClick={() => {
              setActiveChartName("MY NEW CHART");
              setActiveTab('editor');
            }}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-2 rounded-xl text-xs font-black shadow-md transition-all active:scale-95 shrink-0"
          >
            <PlusCircle className="w-4 h-4" /> + Create New Chart
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
                Create &amp; Open Grid
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chart Cards or Clean Empty State */}
      {chartKeys.length === 0 ? (
        <div className="bg-slate-900/90 border-2 border-dashed border-slate-800 rounded-3xl text-center py-14 px-6 text-slate-400 shadow-2xl space-y-4 max-w-xl mx-auto my-6">
          <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-3xl flex items-center justify-center mx-auto text-amber-400 shadow-inner">
            <Archive className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-black text-white text-lg">No Saved Charts in Store</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 leading-relaxed">
              Your chart repository is empty. Create your market charts below. All created charts persist in browser storage until deleted.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2.5 flex-wrap pt-2">
            <button
              onClick={() => {
                setActiveChartName("MY NEW CHART");
                setActiveTab('editor');
              }}
              className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-black px-5 py-2.5 rounded-xl text-xs shadow-lg transition-all active:scale-95 inline-flex items-center gap-1.5"
            >
              <PlusCircle className="w-4 h-4" /> + Create First Chart
            </button>
          </div>
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
                {/* Chart Name & Instant Delete Button */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-black text-amber-400 tracking-wide uppercase leading-snug">{name}</h3>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                      Updated: {chart.updatedAt ? new Date(chart.updatedAt).toLocaleDateString() : 'Today'}
                    </div>
                  </div>
                  <button
                    onClick={() => deleteChart(name)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition bg-slate-950 border-slate-800 text-red-400 hover:bg-red-950 hover:border-red-600 active:scale-95"
                    title={`Delete ${name}`}
                  >
                    <Trash2 className="w-3 h-3" /> Delete
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
