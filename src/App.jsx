import React from 'react';
import { ChartProvider, useChart } from './context/ChartContext';
import { Navbar } from './components/Navbar';
import { ChartEditor } from './components/ChartEditor';
import { ChartStore } from './components/ChartStore';
import { AILearningEngine } from './components/AILearningEngine';
import { PredictorEngine } from './components/PredictorEngine';

const MainContent = () => {
  const { activeTab } = useChart();

  return (
    <main className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
      {activeTab === 'editor' && <ChartEditor />}
      {activeTab === 'store' && <ChartStore />}
      {activeTab === 'ai-trainer' && <AILearningEngine />}
      {activeTab === 'predictor' && <PredictorEngine />}
    </main>
  );
};

export function App() {
  return (
    <ChartProvider>
      <div className="min-h-screen bg-slate-950 text-slate-100 font-poppins selection:bg-pink-500 selection:text-white">
        <Navbar />
        <MainContent />
      </div>
    </ChartProvider>
  );
}

export default App;
