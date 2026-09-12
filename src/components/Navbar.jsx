import React from 'react';
import { useChart } from '../context/ChartContext';
import { Table, Archive, Brain, Zap } from 'lucide-react';

export const Navbar = () => {
  const { activeTab, setActiveTab } = useChart();

  const navItems = [
    { id: 'editor', label: 'Chart Editor', icon: Table, color: 'hover:text-blue-400' },
    { id: 'store', label: 'Store', icon: Archive, color: 'hover:text-yellow-400' },
    { id: 'ai-trainer', label: 'AI Model Trainer', icon: Brain, color: 'hover:text-purple-400' },
    { id: 'predictor', label: 'Predictor Engine', icon: Zap, color: 'hover:text-pink-400' },
  ];

  return (
    <header className="px-4 py-3 md:px-8 border-b border-slate-800">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab('editor')}>
          <div className="bg-gradient-to-tr from-pink-600 to-purple-600 p-2.5 rounded-2xl shadow-lg shadow-pink-500/20">
            <Zap className="w-6 h-6 text-white animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              Number-Cal <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">React v2.0</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">AI Matka Engine</p>
          </div>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-1.5 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800/80">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/25 scale-[1.02]'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : ''}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
