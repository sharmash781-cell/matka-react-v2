import React from 'react';
import { useChart } from '../context/ChartContext';
import { Zap, Lock, ShieldCheck } from 'lucide-react';

export const Navbar = () => {
  const { setActiveTab, isAdminLoggedIn, setShowAdminModal } = useChart();

  return (
    <header className="px-3 py-2.5 sm:px-6 border-b border-slate-800 bg-slate-950/90 sticky top-0 z-40 backdrop-blur-md">
      <div className="max-w-7xl mx-auto flex justify-between items-center gap-3">
        
        {/* Brand Logo */}
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
    </header>
  );
};
