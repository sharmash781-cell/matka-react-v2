import React from 'react';
import { useChart } from '../context/ChartContext';
import { Table, Archive, Brain, Zap, Search, Lock, ShieldCheck, PlusCircle } from 'lucide-react';

export const Navbar = () => {
  const { activeTab, setActiveTab, isAdminLoggedIn, setShowAdminModal } = useChart();

  const navItems = [
    { id: 'editor', label: 'Chart Editor', shortLabel: 'Editor', icon: Table },
    { id: 'store', label: 'Store', shortLabel: 'Store', icon: Archive },
    { id: 'ai-trainer', label: 'AI Model Trainer', shortLabel: 'AI Trainer', icon: Brain },
    { id: 'predictor', label: 'Predictor Engine', shortLabel: 'Predictor', icon: Zap },
    { id: 'finder', label: 'Chart Finder', shortLabel: 'Find', icon: Search },
  ];

  return (
    <header className="px-2 py-2 sm:px-6 border-b border-slate-800 bg-slate-950/90 border-slate-800">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
        
        {/* Brand & Admin Login Button */}
        <div className="flex items-center justify-between w-full sm:w-auto gap-3">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('editor')}>
            <div className="bg-gradient-to-tr from-pink-600 to-purple-600 p-1.5 sm:p-2 rounded-xl shadow-lg shadow-pink-500/20">
              <Zap className="w-4 h-4 sm:w-5 sm:h-5 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                Number-Cal <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400">React v2.0</span>
              </h1>
              <p className="text-[9px] text-slate-400 font-mono tracking-widest uppercase hidden sm:block">AI Matka Engine</p>
            </div>
          </div>

          {/* Top Admin Login / Status Trigger */}
          <button
            onClick={() => setShowAdminModal(true)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black shadow-md transition active:scale-95 border ${
              isAdminLoggedIn
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 border-amber-400 text-slate-950 font-extrabold'
                : 'bg-slate-900 border-slate-700 text-amber-300 hover:bg-slate-800'
            }`}
          >
            {isAdminLoggedIn ? (
              <>
                <ShieldCheck className="w-4 h-4 text-slate-950" />
                <span>👑 Admin Active</span>
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Admin Login</span>
              </>
            )}
          </button>
        </div>

        {/* Navigation bar tabs */}
        <nav className="flex items-center justify-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 w-full sm:w-auto overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1 sm:gap-2 px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-bold transition-all duration-200 whitespace-nowrap ${
                  isActive
                    ? 'bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 text-white shadow-md scale-[1.01]'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isActive ? 'text-white' : ''}`} />
                <span className="sm:hidden">{item.shortLabel}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
