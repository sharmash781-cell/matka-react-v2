import React from 'react';
import { useChart } from '../context/ChartContext';
import { Archive, Table, Zap, Brain, Trash2, Calendar, Hash } from 'lucide-react';

export const ChartStore = () => {
  const { charts, setActiveChartName, deleteChart, setActiveTab } = useChart();

  const handleAction = (chartName, action) => {
    setActiveChartName(chartName);
    if (action === 'editor') setActiveTab('editor');
    if (action === 'ai-trainer') setActiveTab('ai-trainer');
    if (action === 'predictor') setActiveTab('predictor');
  };

  const chartKeys = Object.keys(charts);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="glass-panel p-6 md:p-8 rounded-3xl flex justify-between items-center shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-2xl">
            <Archive className="w-8 h-8 text-yellow-400" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white">Saved Chart Repository</h2>
            <p className="text-xs text-slate-400">Manage, launch, and inspect stored matrix charts synchronized in local storage</p>
          </div>
        </div>
        <span className="hidden sm:inline-block bg-yellow-950 border border-yellow-600/40 text-yellow-400 text-xs font-mono font-bold px-3 py-1.5 rounded-full uppercase tracking-wider">
          {chartKeys.length} Saved Matrix Charts
        </span>
      </div>

      {/* Grid of Saved Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {chartKeys.map((name) => {
          const chart = charts[name];
          let filledCount = 0;
          chart.data.forEach(row => {
            row.forEach(cell => {
              if (cell.val && cell.val !== '') filledCount++;
            });
          });

          return (
            <div
              key={name}
              className="glass-panel p-6 rounded-3xl border border-slate-800 hover:border-yellow-500/50 transition-all duration-300 flex flex-col justify-between space-y-5 shadow-xl hover:-translate-y-1"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start gap-2">
                  <h3 className="text-lg font-black text-white tracking-wide">{name}</h3>
                  {chart.isPana && (
                    <span className="bg-purple-950 border border-purple-500/50 text-purple-300 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">
                      Pana Chart
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 text-xs font-mono text-slate-300">
                  <span className="bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800 flex items-center gap-1">
                    <Hash className="w-3.5 h-3.5 text-blue-400" /> {chart.rows} Rows × {chart.cols} Cols
                  </span>
                  <span className="bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800 flex items-center gap-1">
                    <Table className="w-3.5 h-3.5 text-emerald-400" /> {filledCount} Jodis Filled
                  </span>
                </div>

                <div className="text-[11px] text-slate-500 flex items-center gap-1.5 font-mono pt-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>Updated: {new Date(chart.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
                <button
                  onClick={() => handleAction(name, 'editor')}
                  className="flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-blue-400 border border-slate-700/80 py-2 rounded-xl text-xs font-bold transition"
                >
                  <Table className="w-3.5 h-3.5" /> Open Editor
                </button>
                <button
                  onClick={() => handleAction(name, 'ai-trainer')}
                  className="flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-purple-400 border border-slate-700/80 py-2 rounded-xl text-xs font-bold transition"
                >
                  <Brain className="w-3.5 h-3.5" /> Train AI
                </button>
                <button
                  onClick={() => handleAction(name, 'predictor')}
                  className="flex items-center justify-center gap-1.5 bg-gradient-to-r from-pink-600 to-purple-600 hover:opacity-90 text-white py-2 rounded-xl text-xs font-bold shadow-md shadow-pink-500/20 col-span-2"
                >
                  <Zap className="w-3.5 h-3.5" /> Launch Predictor Engine
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
