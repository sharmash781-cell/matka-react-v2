import React from 'react';
import { ChartProvider, useChart } from './context/ChartContext';
import { ChartEditor } from './components/ChartEditor';
import { ChartStore } from './components/ChartStore';
import { AILearningEngine } from './components/AILearningEngine';
import { PredictorEngine } from './components/PredictorEngine';
import { Table, Archive, Brain, Zap } from 'lucide-react';

const BottomNav = () => {
  const { activeTab, setActiveTab } = useChart();
  const navItems = [
    { id: 'editor', label: 'Chart', icon: Table },
    { id: 'store', label: 'Store', icon: Archive },
    { id: 'ai', label: 'AI', icon: Brain },
    { id: 'predict', label: 'Predict', icon: Zap },
  ];
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-around items-center bg-slate-950/95 border-t border-slate-800 backdrop-blur-md py-2 px-2 shadow-2xl">
      {navItems.map(({ id, label, icon: Icon }) => {
        const active = activeTab === id || (id === 'ai' && activeTab === 'ai-trainer') || (id === 'predict' && activeTab === 'predictor');
        return (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex flex-col items-center gap-0.5 px-4 py-1 rounded-xl transition-all ${
              active
                ? 'bg-gradient-to-t from-pink-600/30 to-purple-600/20 text-pink-400'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <Icon className={`w-5 h-5 ${active ? 'text-pink-400' : 'text-slate-500'}`} />
            <span className={`text-[10px] font-bold ${active ? 'text-pink-300' : 'text-slate-500'}`}>{label}</span>
            {active && <div className="w-1 h-1 rounded-full bg-pink-400 mt-0.5" />}
          </button>
        );
      })}
    </div>
  );
};

const MainContent = () => {
  const { activeTab } = useChart();

  return (
    <main className="pb-16 min-h-[85vh]">
      {(activeTab === 'editor' || !activeTab) && <ChartEditor />}
      {activeTab === 'store' && (
        <div className="p-2 sm:p-4"><ChartStore /></div>
      )}
      {(activeTab === 'ai' || activeTab === 'ai-trainer') && (
        <div className="p-2 sm:p-4"><AILearningEngine /></div>
      )}
      {(activeTab === 'predict' || activeTab === 'predictor') && (
        <div className="p-2 sm:p-4"><PredictorEngine /></div>
      )}
    </main>
  );
};

export function App() {
  return (
    <ChartProvider>
      <div className="min-h-screen bg-slate-950 text-slate-100 font-poppins selection:bg-pink-500 selection:text-white">
        <MainContent />
        <BottomNav />
      </div>
    </ChartProvider>
  );
}

export default App;
