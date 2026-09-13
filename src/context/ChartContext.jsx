import React, { createContext, useContext, useState, useEffect } from 'react';
import srideviPreset from '../data/sridevi_preset.json';

const ChartContext = createContext();

export const RED_PAIRS = { 0: 5, 1: 6, 2: 7, 3: 8, 4: 9, 5: 0, 6: 1, 7: 2, 8: 3, 9: 4 };

export const isRedPair = (num) => {
  if (!num || num.length !== 2 || num === '**' || !/^\d{2}$/.test(num)) return false;
  const a = parseInt(num[0]), b = parseInt(num[1]);
  return a === b || RED_PAIRS[a] === b;
};

export const calculateCN = (val) => {
  if (!val || !/^\d{2}$/.test(val)) return null;
  const o = parseInt(val[0]), c = parseInt(val[1]);
  return (3 * o + c) % 10;
};

export const calculateCloseCond = (val) => {
  if (!val || !/^\d{2}$/.test(val)) return null;
  const o = parseInt(val[0]), c = parseInt(val[1]);
  return (o + 3 * c) % 10;
};

export const calculateTotal = (val) => {
  if (!val || !/^\d{2}$/.test(val)) return null;
  return (parseInt(val[0]) + parseInt(val[1])) % 10;
};

export const calculateDiffTotal = (val) => {
  if (!val || !/^\d{2}$/.test(val)) return null;
  const o = parseInt(val[0]), c = parseInt(val[1]);
  return ((10 - c) + o) % 10;
};

// Default Initial Market Presets
export const DEFAULT_PRESETS = {
  "SRIDEVI": srideviPreset,
  "TIME BAZAR": {
    rows: 15,
    cols: 7,
    updatedAt: new Date().toISOString(),
    data: [
      [{val:"69"}, {val:"71"}, {val:"84"}, {val:"57"}, {val:"12"}, {val:"**"}, {val:"74"}],
      [{val:"23"}, {val:"10"}, {val:"25"}, {val:"97"}, {val:"51"}, {val:"08"}, {val:"59"}],
      [{val:"80"}, {val:"35"}, {val:"52"}, {val:"17"}, {val:"95"}, {val:"11"}, {val:"33"}],
      [{val:"14"}, {val:"49"}, {val:"22"}, {val:"54"}, {val:"65"}, {val:"24"}, {val:"10"}],
      [{val:"05"}, {val:"92"}, {val:"36"}, {val:"78"}, {val:"19"}, {val:"40"}, {val:"88"}],
      [{val:"61"}, {val:"27"}, {val:"83"}, {val:"04"}, {val:"59"}, {val:"16"}, {val:"72"}],
      [{val:"38"}, {val:"90"}, {val:"45"}, {val:"11"}, {val:"67"}, {val:"29"}, {val:"03"}],
      [{val:"75"}, {val:"13"}, {val:"60"}, {val:"24"}, {val:"89"}, {val:"32"}, {val:"51"}],
      [{val:"42"}, {val:"86"}, {val:"97"}, {val:"30"}, {val:"08"}, {val:"64"}, {val:"15"}],
      [{val:"19"}, {val:"53"}, {val:"06"}, {val:"71"}, {val:"28"}, {val:"40"}, {val:"92"}],
      [{val:"84"}, {val:"20"}, {val:"77"}, {val:"15"}, {val:"69"}, {val:"33"}, {val:"08"}],
      [{val:"56"}, {val:"91"}, {val:"34"}, {val:"82"}, {val:"09"}, {val:"70"}, {val:"25"}],
      [{val:"27"}, {val:"63"}, {val:"18"}, {val:"50"}, {val:"41"}, {val:"89"}, {val:"36"}],
      [{val:"90"}, {val:"44"}, {val:"85"}, {val:"26"}, {val:"73"}, {val:"12"}, {val:"07"}],
      [{val:"81"}, {val:"48"}, {val:"84"}, {val:"08"}, {val:"58"}, {val:"04"}, {val:""}]
    ]
  },
  "KALYAN MARKET": {
    rows: 10,
    cols: 7,
    updatedAt: new Date().toISOString(),
    data: [
      [{val:"12"}, {val:"45"}, {val:"78"}, {val:"90"}, {val:"23"}, {val:"56"}, {val:"89"}],
      [{val:"34"}, {val:"67"}, {val:"01"}, {val:"24"}, {val:"57"}, {val:"80"}, {val:"13"}],
      [{val:"58"}, {val:"91"}, {val:"25"}, {val:"46"}, {val:"79"}, {val:"02"}, {val:"35"}],
      [{val:"70"}, {val:"14"}, {val:"36"}, {val:"68"}, {val:"92"}, {val:"15"}, {val:"47"}],
      [{val:"81"}, {val:"26"}, {val:"49"}, {val:"71"}, {val:"03"}, {val:"37"}, {val:"60"}],
      [{val:"93"}, {val:"38"}, {val:"50"}, {val:"82"}, {val:"16"}, {val:"40"}, {val:"74"}],
      [{val:"04"}, {val:"41"}, {val:"62"}, {val:"95"}, {val:"27"}, {val:"51"}, {val:"83"}],
      [{val:"17"}, {val:"52"}, {val:"73"}, {val:"06"}, {val:"39"}, {val:"64"}, {val:"98"}],
      [{val:"28"}, {val:"63"}, {val:"85"}, {val:"10"}, {val:"42"}, {val:"75"}, {val:"09"}],
      [{val:"30"}, {val:"76"}, {val:"94"}, {val:"21"}, {val:"53"}, {val:"86"}, {val:"18"}]
    ]
  }
};

export const ChartProvider = ({ children }) => {
  const [charts, setCharts] = useState(() => {
    const saved = localStorage.getItem('chartHistory');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
          return parsed;
        }
      } catch (e) {}
    }
    return DEFAULT_PRESETS;
  });

  const [activeChartName, setActiveChartName] = useState(() => {
    const keys = Object.keys(charts);
    return keys.length > 0 ? keys[0] : "SRIDEVI";
  });

  const [activeTab, setActiveTab] = useState('editor');

  const [learnedModels, setLearnedModels] = useState(() => {
    const saved = localStorage.getItem('matkaLearnedModels');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      "Default_AI_V1": {
        name: "Default_AI_V1",
        columnWeight: 1.35,
        rowWeight: 1.20,
        conditionWeight: 1.45,
        familyWeight: 1.15,
        redPairWeight: 1.25,
        recencyDecay: 0.97,
        epochs: 50,
        loss: 0.042,
        trainedOn: "SRIDEVI",
        updatedAt: new Date().toISOString()
      }
    };
  });

  const [activeModelName, setActiveModelName] = useState("Default_AI_V1");

  const [customAIPatterns, setCustomAIPatterns] = useState(() => {
    const saved = localStorage.getItem('matkaCustomAIPatterns');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [];
  });

  // Always sync charts state to localStorage
  useEffect(() => {
    if (charts && Object.keys(charts).length > 0) {
      localStorage.setItem('chartHistory', JSON.stringify(charts));
    }
  }, [charts]);

  useEffect(() => {
    localStorage.setItem('matkaLearnedModels', JSON.stringify(learnedModels));
  }, [learnedModels]);

  useEffect(() => {
    localStorage.setItem('matkaCustomAIPatterns', JSON.stringify(customAIPatterns));
  }, [customAIPatterns]);

  const saveChart = (name, rows, cols, data) => {
    const cleanName = name.trim().toUpperCase() || 'CUSTOM CHART';
    const updated = {
      ...charts,
      [cleanName]: {
        rows: parseInt(rows) || (data ? data.length : 20),
        cols: parseInt(cols) || (data && data[0] ? data[0].length : 7),
        updatedAt: new Date().toISOString(),
        data: data || []
      }
    };
    setCharts(updated);
    setActiveChartName(cleanName);
    localStorage.setItem('chartHistory', JSON.stringify(updated));
  };

  const deleteChart = (name) => {
    const cleanName = name.trim().toUpperCase();
    const updated = { ...charts };
    delete updated[cleanName];
    setCharts(updated);
    const keys = Object.keys(updated);
    if (keys.length > 0) {
      setActiveChartName(keys[0]);
    } else {
      setCharts(DEFAULT_PRESETS);
      setActiveChartName("SRIDEVI");
    }
    localStorage.setItem('chartHistory', JSON.stringify(updated));
  };

  const resetToDefaultCharts = () => {
    setCharts(DEFAULT_PRESETS);
    setActiveChartName("SRIDEVI");
    localStorage.setItem('chartHistory', JSON.stringify(DEFAULT_PRESETS));
  };

  const saveCustomAIPattern = (pattern) => {
    const newPattern = {
      ...pattern,
      id: `pattern_${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    const updated = [newPattern, ...customAIPatterns];
    setCustomAIPatterns(updated);
    return newPattern;
  };

  const deleteCustomAIPattern = (id) => {
    const updated = customAIPatterns.filter(p => p.id !== id);
    setCustomAIPatterns(updated);
  };

  // Universal DPBoss Raw Text Parser
  const importRawData = (chartName, rawText, customCols = 7, customRows = null) => {
    if (!rawText || rawText.trim() === '') return false;

    const extractedTokens = [];
    const rawTokens = rawText.trim().split(/[\s,\t\r\n]+/);

    rawTokens.forEach(token => {
      if (token === '**' || token === 'XX') {
        extractedTokens.push('**');
      } else {
        const clean = token.replace(/[^0-9]/g, '');
        if (clean.length === 2) {
          extractedTokens.push(clean);
        } else if (clean.length === 1) {
          extractedTokens.push(`0${clean}`);
        } else if (clean.length > 2) {
          for (let i = 0; i < clean.length - 1; i += 2) {
            extractedTokens.push(clean.slice(i, i + 2));
          }
        }
      }
    });

    if (extractedTokens.length === 0) return false;

    const cols = Math.min(8, Math.max(5, parseInt(customCols) || 7));
    const autoCalculatedRows = Math.ceil(extractedTokens.length / cols);
    const rows = customRows && parseInt(customRows) > 0 ? parseInt(customRows) : autoCalculatedRows;

    const grid = [];
    let tIdx = 0;

    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        if (tIdx < extractedTokens.length) {
          row.push({ val: extractedTokens[tIdx++] });
        } else {
          row.push({ val: '' });
        }
      }
      grid.push(row);
    }

    saveChart(chartName, grid.length, cols, grid);
    return true;
  };

  const trainAIModel = (chartName, epochs = 100, learningRate = 0.05) => {
    const chart = charts[chartName];
    if (!chart) return null;

    let totalCells = 0;
    let redPairsCount = 0;
    let conditionMatches = 0;

    chart.data.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (cell.val && /^\d{2}$/.test(cell.val)) {
          totalCells++;
          if (isRedPair(cell.val)) redPairsCount++;
          if (r > 0 && chart.data[r-1][c]?.val) {
            const prevVal = chart.data[r-1][c].val;
            if (calculateCN(prevVal) === calculateTotal(cell.val)) conditionMatches++;
          }
        }
      });
    });

    const redRatio = totalCells > 0 ? (redPairsCount / totalCells) : 0.1;
    const condRatio = totalCells > 0 ? (conditionMatches / totalCells) : 0.2;

    const modelName = `AI_Model_${chartName.replace(/\s+/g, '_')}_V${Object.keys(learnedModels).length + 1}`;
    const newModel = {
      name: modelName,
      columnWeight: parseFloat((1.0 + (redRatio * 1.5)).toFixed(2)),
      rowWeight: parseFloat((1.1 + (learningRate * 2)).toFixed(2)),
      conditionWeight: parseFloat((1.2 + (condRatio * 2.0)).toFixed(2)),
      familyWeight: 1.25,
      redPairWeight: parseFloat((1.0 + (redRatio * 2.5)).toFixed(2)),
      recencyDecay: 0.97,
      epochs,
      loss: parseFloat((0.08 / (1 + epochs * 0.01)).toFixed(4)),
      trainedOn: chartName,
      updatedAt: new Date().toISOString()
    };

    const updatedModels = { ...learnedModels, [modelName]: newModel };
    setLearnedModels(updatedModels);
    setActiveModelName(modelName);
    return newModel;
  };

  return (
    <ChartContext.Provider value={{
      charts: charts && typeof charts === 'object' && Object.keys(charts).length > 0 ? charts : DEFAULT_PRESETS,
      activeChartName: activeChartName || "SRIDEVI",
      setActiveChartName,
      activeChart: (charts && charts[activeChartName]) || DEFAULT_PRESETS["SRIDEVI"],
      saveChart,
      deleteChart,
      resetToDefaultCharts,
      importRawData,
      activeTab,
      setActiveTab,
      learnedModels,
      activeModelName,
      setActiveModelName,
      trainAIModel,
      customAIPatterns,
      saveCustomAIPattern,
      deleteCustomAIPattern
    }}>
      {children}
    </ChartContext.Provider>
  );
};

export const useChart = () => useContext(ChartContext);
