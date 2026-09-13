import React, { useState } from 'react';
import { useChart } from '../context/ChartContext';
import { Archive, Table, Zap, Brain, Trash2, Calendar, Hash, PlusCircle, X } from 'lucide-react';

export const ChartStore = () => {
  const { charts, setActiveChartName, deleteChart, setActiveTab, saveChart } = useChart();
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRows, setNewRows] = useState(20);
  const [newCols, setNewCols] = useState(7);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const handleOpenIn = (chartName, tab) => {
    setActiveChartName(chartName);
    setActiveTab(tab);
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

  const chartKeys = Object.keys(charts);

  return (
    <div className="space-y-4 px-3 py-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-yellow-500/20 border border-yellow-500/30 rounded-2xl">
            <Archive className="w-6 h-6 text-yellow-400" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white">Chart Store</h2>
            <p className="text-[10px] text-slate-400">{chartKeys.length} saved charts in local storage</p>
          </div>
        </div>
        <button
          onClick={() => setShowNewForm(v => !v)}
          className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-2 rounded-xl text-xs font-bold shadow-md"
        >
          <PlusCircle className="w-4 h-4" /> New Chart
        </button>
      </div>

      {/* New Chart Form */}
      {showNewForm && (
        <div className="bg-slate-900 border border-emerald-700/50 rounded-2xl p-4 space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-emerald-300">Create New Chart</h3>
            <button onClick={() => setShowNewForm(false)}><X className="w-4 h-4 text-slate-400" /></button>
          </div>
          <div className="flex flex-col gap-2">
            <input
              type="text"
              placeholder="Chart name (e.g. KALYAN NIGHT)"
              value={newName}
              onChange={(e) => setNewName(e.target.value.toUpperCase())}
              className="bg-slate-800 border border-slate-600 text-white font-bold rounded-xl px-3 py-2 text-xs outline-none focus:border-emerald-500"
            />
            <div className="flex gap-2 items-center">
              <label className="text-[10px] text-slate-400 font-bold">ROWS:</label>
              <input type="number" value={newRows} onChange={(e) => setNewRows(e.target.value)}
                className="w-16 bg-slate-800 border border-slate-700 text-white font-mono font-bold text-center py-1.5 rounded-lg text-xs" />
              <label className="text-[10px] text-slate-400 font-bold ml-2">COLS:</label>
              <input type="number" value={newCols} onChange={(e) => setNewCols(e.target.value)}
                className="w-16 bg-slate-800 border border-slate-700 text-white font-mono font-bold text-center py-1.5 rounded-lg text-xs" />
              <button onClick={handleCreateNew}
                className="ml-auto bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-1.5 rounded-xl text-xs font-bold">
                Create & Open
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chart Cards */}
      {chartKeys.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Archive className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-bold">No charts saved yet.</p>
          <p className="text-xs mt-1">Click "New Chart" to create one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {chartKeys.map((name) => {
            const chart = charts[name];
            let filledCount = 0;
            chart.data?.forEach(row => {
              row?.forEach(cell => { if (cell.val && cell.val !== '') filledCount++; });
            });

            return (
              <div key={name}
                className="bg-slate-900/80 border border-slate-800 hover:border-yellow-500/50 rounded-2xl p-4 flex flex-col gap-3 shadow-lg hover:-translate-y-0.5 transition-all duration-200"
              >
                {/* Chart Name & Delete */}
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-black text-white tracking-wide leading-tight">{name}</h3>
                  <button
                    onClick={() => handleDelete(name)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border transition ${
                      confirmDelete === name
                        ? 'bg-red-600 border-red-500 text-white animate-pulse'
                        : 'bg-slate-800 border-slate-700 text-red-400 hover:bg-red-950'
                    }`}
                  >
                    <Trash2 className="w-3 h-3" />
                    {confirmDelete === name ? 'Confirm?' : 'Delete'}
                  </button>
                </div>

                {/* Stats */}
                <div className="flex flex-wrap gap-1.5 text-[10px] font-mono text-slate-300">
                  <span className="bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700 flex items-center gap-1">
                    <Hash className="w-3 h-3 text-blue-400" /> {chart.rows} × {chart.cols}
                  </span>
                  <span className="bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700 flex items-center gap-1">
                    <Table className="w-3 h-3 text-emerald-400" /> {filledCount} filled
                  </span>
                  <span className="bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-700 flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-slate-400" />
                    {chart.updatedAt ? new Date(chart.updatedAt).toLocaleDateString() : '-'}
                  </span>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-800">
                  <button onClick={() => handleOpenIn(name, 'editor')}
                    className="flex items-center justify-center gap-1 bg-slate-800 hover:bg-slate-700 text-blue-400 border border-slate-700 py-2 rounded-xl text-[11px] font-bold transition">
                    <Table className="w-3.5 h-3.5" /> Edit Chart
                  </button>
                  <button onClick={() => handleOpenIn(name, 'ai-trainer')}
                    className="flex items-center justify-center gap-1 bg-slate-800 hover:bg-slate-700 text-purple-400 border border-slate-700 py-2 rounded-xl text-[11px] font-bold transition">
                    <Brain className="w-3.5 h-3.5" /> AI Train
                  </button>
                  <button onClick={() => handleOpenIn(name, 'predictor')}
                    className="col-span-2 flex items-center justify-center gap-1.5 bg-gradient-to-r from-pink-600 to-purple-600 hover:opacity-90 text-white py-2 rounded-xl text-[11px] font-bold shadow-md">
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
