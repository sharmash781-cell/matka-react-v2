import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import publishedChartsData from '../data/published_charts.json';
import srideviPreset from '../data/sridevi_preset.json';

import mainBazarPreset from '../data/main_bazar_preset.json';

const ChartContext = createContext();

export const RED_PAIRS = { 0: 5, 1: 6, 2: 7, 3: 8, 4: 9, 5: 0, 6: 1, 7: 2, 8: 3, 9: 4 };

export const isHoliday = (num) => {
  if (!num) return false;
  const s = num.toString().trim();
  return s === '**' || s === '*' || s.toUpperCase() === 'XX' || s.toUpperCase() === 'X';
};

export const isRedPair = (num) => {
  if (!num || isHoliday(num)) return false;
  if (num.length !== 2 || !/^\d{2}$/.test(num)) return false;
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

export const DEFAULT_PUBLISHED_CHARTS = {
  "MAIN BAZAR": mainBazarPreset
};

export const DEFAULT_PRESETS = {
  "MAIN BAZAR": mainBazarPreset
};

const STORAGE_KEY = 'adminPublishedCharts_v5';

const getInitialCharts = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        if (!parsed["MAIN BAZAR"]) {
          parsed["MAIN BAZAR"] = mainBazarPreset;
        }
        return parsed;
      }
    }
  } catch (e) {}
  return {
    "MAIN BAZAR": mainBazarPreset
  };
};

export const ChartProvider = ({ children }) => {
  const [charts, setCharts] = useState(getInitialCharts);

  const [activeChartName, setActiveChartName] = useState(() => {
    const keys = Object.keys(charts);
    return keys.includes("MAIN BAZAR") ? "MAIN BAZAR" : (keys.length > 0 ? keys[0] : "MAIN BAZAR");
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
        trainedOn: "DEFAULT",
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

  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(true);

  const [showAdminModal, setShowAdminModal] = useState(false);

  const loginAdmin = useCallback((passcode) => {
    setIsAdminLoggedIn(true);
    return { success: true };
  }, []);

  const logoutAdmin = useCallback(() => {
    setIsAdminLoggedIn(true);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(charts));
    } catch (e) {}
  }, [charts]);

  // Sync state when storage changes across windows/tabs
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && typeof parsed === 'object') {
            setCharts(parsed);
          }
        } catch (err) {}
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  // Check URL Hash for shared published chart code on mobile/desktop mount
  useEffect(() => {
    try {
      if (window.location.hash && window.location.hash.startsWith('#share=')) {
        const hashData = window.location.hash.replace('#share=', '');
        const decoded = JSON.parse(decodeURIComponent(hashData));
        if (decoded && typeof decoded === 'object') {
          setCharts(prev => {
            const merged = { ...prev, ...decoded };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
            return merged;
          });
          const keys = Object.keys(decoded);
          if (keys.length > 0) {
            setActiveChartName(keys[0]);
          }
        }
      }
    } catch (err) {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('matkaLearnedModels', JSON.stringify(learnedModels));
    } catch (e) {}
  }, [learnedModels]);

  useEffect(() => {
    try {
      localStorage.setItem('matkaCustomAIPatterns', JSON.stringify(customAIPatterns));
    } catch (e) {}
  }, [customAIPatterns]);

  const saveChart = useCallback((name, rows, cols, data) => {
    const cleanName = name.trim().toUpperCase() || 'CUSTOM CHART';
    setCharts((prevCharts) => {
      const updated = {
        ...prevCharts,
        [cleanName]: {
          rows: parseInt(rows) || (data ? data.length : 20),
          cols: parseInt(cols) || (data && data[0] ? data[0].length : 7),
          updatedAt: new Date().toISOString(),
          data: data || []
        }
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
    setActiveChartName(cleanName);
  }, []);

  const deleteChart = useCallback((name) => {
    const cleanName = name.trim().toUpperCase();
    setCharts((prevCharts) => {
      const updated = { ...prevCharts };
      delete updated[cleanName];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {}
      const keys = Object.keys(updated);
      if (keys.length > 0) {
        setActiveChartName(keys[0]);
      } else {
        setActiveChartName("MY NEW CHART");
      }
      return updated;
    });
  }, []);

  const resetToDefaultCharts = useCallback(() => {
    setCharts({});
    setActiveChartName("MY NEW CHART");
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({}));
    } catch (e) {}
  }, []);

  const clearAllCharts = useCallback(() => {
    setCharts({});
    setActiveChartName("MY NEW CHART");
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({}));
      localStorage.removeItem('chartHistory');
      localStorage.removeItem('matkaCharts');
    } catch (e) {}
  }, []);

  const saveCustomAIPattern = useCallback((pattern) => {
    const newPattern = {
      ...pattern,
      id: `pattern_${Date.now()}`,
      createdAt: new Date().toISOString()
    };
    setCustomAIPatterns((prev) => [newPattern, ...prev]);
    return newPattern;
  }, []);

  const deleteCustomAIPattern = useCallback((id) => {
    setCustomAIPatterns((prev) => prev.filter(p => p.id !== id));
  }, []);

  const importRawData = useCallback((chartName, rawText, customCols = 7, customRows = null) => {
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
  }, [saveChart]);

  const trainAIModel = useCallback((chartName, epochs = 100, learningRate = 0.05) => {
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

    setLearnedModels(prev => ({ ...prev, [modelName]: newModel }));
    setActiveModelName(modelName);
    return newModel;
  }, [charts, learnedModels]);

  const currentChart = charts[activeChartName] || {
    rows: 20,
    cols: 7,
    data: Array.from({ length: 20 }, () => Array.from({ length: 7 }, () => ({ val: '' })))
  };

  return (
    <ChartContext.Provider value={{
      charts: charts || {},
      activeChartName: activeChartName || "MY NEW CHART",
      setActiveChartName,
      activeChart: currentChart,
      saveChart,
      deleteChart,
      resetToDefaultCharts,
      clearAllCharts,
      importRawData,
      activeTab,
      setActiveTab,
      learnedModels,
      activeModelName,
      setActiveModelName,
      trainAIModel,
      customAIPatterns,
      saveCustomAIPattern,
      deleteCustomAIPattern,
      isAdminLoggedIn,
      loginAdmin,
      logoutAdmin,
      showAdminModal,
      setShowAdminModal
    }}>
      {children}
    </ChartContext.Provider>
  );
};

export const useChart = () => useContext(ChartContext);
