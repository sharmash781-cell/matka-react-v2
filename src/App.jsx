import React from 'react';
import { ChartProvider, useChart, DEFAULT_PRESETS } from './context/ChartContext';
import { ChartEditor } from './components/ChartEditor';
import { ChartStore } from './components/ChartStore';
import { AILearningEngine } from './components/AILearningEngine';
import { PredictorEngine } from './components/PredictorEngine';
import { Table, Archive, Brain, Zap, AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught React Error:", error, errorInfo);
  }

  handleResetState = () => {
    try {
      localStorage.removeItem('chartHistory');
    } catch (e) {}
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center font-poppins">
          <div className="bg-red-950/80 border-2 border-red-600 rounded-3xl p-6 max-w-md shadow-2xl space-y-4">
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto animate-bounce" />
            <h2 className="text-xl font-black text-red-300">App Encountered an Issue</h2>
            <p className="text-xs text-slate-300 font-mono bg-slate-900 p-3 rounded-xl text-left overflow-auto max-h-28">
              {this.state.error ? this.state.error.toString() : 'Unknown render error'}
            </p>
            <button
              onClick={this.handleResetState}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:opacity-90 text-slate-950 px-5 py-3 rounded-xl font-black text-sm shadow-xl active:scale-95 transition"
            >
              <RefreshCw className="w-4 h-4" /> Reset Storage & Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

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
    <ErrorBoundary>
      <ChartProvider>
        <div className="min-h-screen bg-slate-950 text-slate-100 font-poppins selection:bg-pink-500 selection:text-white">
          <MainContent />
          <BottomNav />
        </div>
      </ChartProvider>
    </ErrorBoundary>
  );
}

export default App;
