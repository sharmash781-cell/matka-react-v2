import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useChart, isRedPair, calculateCN, calculateCloseCond, calculateTotal, calculateDiffTotal } from '../context/ChartContext';
import { findSequenceMatches, MATCH_COLORS, parseSequenceInput } from '../ai/sequenceEngine';
import { Brain, Sparkles, Search, ChevronUp, ChevronDown, ArrowDown, Filter, Layers, Settings2, Eye, EyeOff, MapPin, Play, X, RefreshCw, BarChart2 } from 'lucide-react';

const COL_HEADERS = ['Mo', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Col 8'];
const DAY_NAMES_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Helper to calculate digit relation up/down/same/opposite
const matchDigitRelation = (d1, d2, relType, step) => {
  if (d1 === undefined || d2 === undefined || isNaN(d1) || isNaN(d2)) return false;
  if (relType === 'SAME') return d1 === d2;
  if (relType === 'OPPOSITE') return d2 === (d1 + 5) % 10;
  if (relType === 'UP') return d2 === (d1 + step) % 10;
  if (relType === 'DOWN') return d2 === (d1 - step + 10) % 10;
  return false;
};

// Compute jodi total
const getJodiTotal = (val) => {
  if (!val || !/^\d{2}$/.test(val)) return null;
  return (parseInt(val[0]) + parseInt(val[1])) % 10;
};

// Helper to compute all 8 family jodis (cut, reverse, cut-reverse, etc.)
const getJodiFamily = (jodiStr) => {
  if (!jodiStr || !/^\d{2}$/.test(jodiStr)) return new Set();
  const o = parseInt(jodiStr[0], 10);
  const c = parseInt(jodiStr[1], 10);
  const cut = (d) => (d + 5) % 10;

  return new Set([
    `${o}${c}`,
    `${cut(o)}${c}`,
    `${o}${cut(c)}`,
    `${cut(o)}${cut(c)}`,
    `${c}${o}`,
    `${cut(c)}${o}`,
    `${c}${cut(o)}`,
    `${cut(c)}${cut(o)}`
  ]);
};

export const AILearningEngine = () => {
  const { charts = {}, activeChartName, setActiveChartName, setActiveTab, saveChart } = useChart();

  const [selectedChart, setSelectedChart] = useState(activeChartName || Object.keys(charts)[0] || 'SRIDEVI');

  // FORWARD SEQUENCE SEARCH INPUT
  const [sequenceInput, setSequenceInput] = useState('');
  const [activeMatchFilter, setActiveMatchFilter] = useState('all');

  // CONTROLS & TABLE UI OPTIONS
  const [showControls, setShowControls] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showOpenFinder, setShowOpenFinder] = useState(false);
  const [isCompact, setIsCompact] = useState(true);
  const [showLocationList, setShowLocationList] = useState(true);

  // ── AUTONOMOUS CROSS-DAY PATTERN SCANNER STATE ─────────────────────────────
  const [scanFromDay, setScanFromDay] = useState(0); // 0 = Mon
  const [scanToDay, setScanToDay] = useState(1);   // 1 = Tue
  const [scanWeekGap, setScanWeekGap] = useState('auto'); // auto, same_week, next_week (+1), plus_2_weeks (+2)
  
  const [rel1Type, setRel1Type] = useState('open_to_open');
  const [rel1Action, setRel1Action] = useState('UP'); // UP, DOWN, SAME, OPPOSITE
  const [rel1Step, setRel1Step] = useState(1);
  
  const [rel2Type, setRel2Type] = useState('close_to_close');
  const [rel2Action, setRel2Action] = useState('UP');
  const [rel2Step, setRel2Step] = useState(1);

  // Follow-up expectation scanner
  const [followUpTargetDay, setFollowUpTargetDay] = useState('next_day'); // next_day, 4 (Fri), 3 (Thu), etc.
  const [followUpDigitType, setFollowUpDigitType] = useState('any'); // any, open, close, total

  // Active removable rules (Pattern chips + Discovered Outcome chips)
  const [activeRules, setActiveRules] = useState([]);
  const [scanSummary, setScanSummary] = useState(null);

  // Virtualization Scroll State
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef(null);

  const activeChartObj = charts[selectedChart] || null;
  const grid = activeChartObj ? activeChartObj.data : [];
  const colsInput = activeChartObj ? activeChartObj.cols : 7;
  const rowHeight = showStats ? 54 : 38;

  const displayGrid = useMemo(() => {
    if (!grid) return [];
    
    let lastFilledIdx = -1;
    for (let r = grid.length - 1; r >= 0; r--) {
      if (grid[r] && grid[r].some(cell => cell && cell.val && cell.val.trim() !== '')) {
        lastFilledIdx = r;
        break;
      }
    }

    const minEmptyBelow = 15;
    const requiredRows = Math.max(
      grid.length + minEmptyBelow,
      lastFilledIdx + 1 + minEmptyBelow,
      35
    );

    const padded = grid.map(row => [...row]);
    while (padded.length < requiredRows) {
      padded.push(Array.from({ length: colsInput }, () => ({ val: '' })));
    }
    return padded;
  }, [grid, colsInput]);

  const handleAICellChange = (rIdx, cIdx, value) => {
    if (!activeChartObj) return;
    
    let currentGrid = [...grid];
    while (currentGrid.length <= rIdx) {
      currentGrid.push(Array.from({ length: colsInput }, () => ({ val: '' })));
    }

    let newGrid = currentGrid.map((row, r) =>
      row.map((cell, c) => (r === rIdx && c === cIdx) ? { val: value } : cell)
    );

    const valUpper = value.toUpperCase();
    if (value.length >= 2 || value === '*' || valUpper === 'X') {
      let nextR = rIdx, nextC = cIdx + 1;
      if (nextC >= colsInput) {
        nextC = 0;
        nextR++;
      }

      while (nextR >= newGrid.length) {
        const emptyRow = Array.from({ length: colsInput }, () => ({ val: '' }));
        newGrid.push(emptyRow);
      }

      if (saveChart) {
        saveChart(selectedChart, newGrid.length, colsInput, newGrid);
      }

      setTimeout(() => {
        const nextInput = document.getElementById(`ai-cell-${nextR}-${nextC}`);
        if (nextInput) {
          nextInput.focus();
          if (nextInput.select) nextInput.select();
        }
      }, 15);
    } else {
      if (saveChart) {
        saveChart(selectedChart, newGrid.length, colsInput, newGrid);
      }
    }
  };

  useEffect(() => {
    if (activeChartName && charts[activeChartName]) {
      setSelectedChart(activeChartName);
    }
  }, [activeChartName, charts]);

  // RUN UNIVERSAL SEQUENCE SCANNING ENGINE
  const sequenceResults = useMemo(() => {
    if (!showOpenFinder) return { targetSeq: [], totalMatches: 0, matches: [], partialSetups: [], predictions: {} };
    return findSequenceMatches(grid, sequenceInput);
  }, [grid, sequenceInput, showOpenFinder]);

  const visibleMatches = useMemo(() => {
    if (!sequenceResults || !sequenceResults.matches) return [];
    if (activeMatchFilter === 'all') return sequenceResults.matches;
    if (activeMatchFilter === 'short_range') return sequenceResults.matches.filter(m => m.isShortRangeGap);
    return sequenceResults.matches.filter(m => m.id === activeMatchFilter);
  }, [sequenceResults, activeMatchFilter]);

  const cellMatchMap = useMemo(() => {
    const map = {};
    visibleMatches.forEach((match) => {
      match.cells.forEach((cell, stepIdx) => {
        const key = `${cell.r}_${cell.c}`;
        if (!map[key]) map[key] = [];
        map[key].push({
          matchId: match.id,
          matchNumber: match.matchNumber,
          color: match.color,
          digit: cell.digit,
          digitType: cell.digitType,
          stepIdx: stepIdx + 1,
          totalSteps: match.cells.length,
          direction: match.direction
        });
      });
    });
    return map;
  }, [visibleMatches]);

  const emptyCellMap = useMemo(() => {
    const map = {};
    if (!sequenceResults || !sequenceResults.partialSetups) return map;
    sequenceResults.partialSetups.forEach((setup) => {
      const { emptyCell, cells, direction } = setup;
      const key = `${emptyCell.r}_${emptyCell.c}`;
      if (!map[key]) map[key] = [];
      map[key].push({
        setupId: setup.id,
        predictedDigit: emptyCell.predictedDigit,
        cutDigit: emptyCell.cutDigit,
        predictedDigitType: emptyCell.predictedDigitType,
        direction,
        cells
      });
    });
    return map;
  }, [sequenceResults]);

  // ── AUTONOMOUS PATTERN & OUTCOME SCANNER ALGORITHM ─────────────────────────
  const runAutonomousPatternScan = useCallback(() => {
    if (!grid || grid.length === 0) return;

    const occurrences = [];
    const fromCol = scanFromDay;
    const toCol = scanToDay;

    for (let r = 0; r < grid.length; r++) {
      const val1 = grid[r]?.[fromCol]?.val || '';
      
      let r2 = r;
      if (scanWeekGap === 'auto') {
        r2 = fromCol <= toCol ? r : r + 1;
      } else if (scanWeekGap === 'same_week' || scanWeekGap === '0') {
        r2 = r;
      } else if (scanWeekGap === 'next_week' || scanWeekGap === '1') {
        r2 = r + 1;
      } else if (scanWeekGap === 'plus_2_weeks' || scanWeekGap === '2') {
        r2 = r + 2;
      } else if (scanWeekGap === 'plus_3_weeks' || scanWeekGap === '3') {
        r2 = r + 3;
      } else if (scanWeekGap === 'plus_4_weeks' || scanWeekGap === '4') {
        r2 = r + 4;
      } else if (scanWeekGap === 'plus_5_weeks' || scanWeekGap === '5') {
        r2 = r + 5;
      } else {
        const gapNum = parseInt(scanWeekGap, 10);
        r2 = r + (isNaN(gapNum) ? (fromCol <= toCol ? 0 : 1) : gapNum);
      }

      if (r2 >= grid.length) continue;

      const val2 = grid[r2]?.[toCol]?.val || '';
      if (!val1 || !val2 || !/^\d{2}$/.test(val1) || !/^\d{2}$/.test(val2)) continue;

      const o1 = parseInt(val1[0]), c1 = parseInt(val1[1]), tot1 = (o1 + c1) % 10;
      const o2 = parseInt(val2[0]), c2 = parseInt(val2[1]), tot2 = (o2 + c2) % 10;

      let d1_rel1, d2_rel1;
      if (rel1Type === 'open_to_open') { d1_rel1 = o1; d2_rel1 = o2; }
      else if (rel1Type === 'open_to_close') { d1_rel1 = o1; d2_rel1 = c2; }
      else if (rel1Type === 'close_to_open') { d1_rel1 = c1; d2_rel1 = o2; }
      else if (rel1Type === 'close_to_close') { d1_rel1 = c1; d2_rel1 = c2; }
      else if (rel1Type === 'total_to_open_same') { d1_rel1 = tot1; d2_rel1 = o2; }
      else if (rel1Type === 'total_to_open_opposite') { d1_rel1 = tot1; d2_rel1 = (o2 + 5) % 10; }
      else if (rel1Type === 'total_to_close_same') { d1_rel1 = tot1; d2_rel1 = c2; }
      else if (rel1Type === 'total_to_close_opposite') { d1_rel1 = tot1; d2_rel1 = (c2 + 5) % 10; }

      const passRel1 = rel1Type.startsWith('total_to_')
        ? (d1_rel1 === d2_rel1)
        : matchDigitRelation(d1_rel1, d2_rel1, rel1Action, rel1Step);

      let passRel2 = true;
      if (rel2Type !== 'none') {
        let d1_rel2, d2_rel2;
        if (rel2Type === 'open_to_open') { d1_rel2 = o1; d2_rel2 = o2; }
        else if (rel2Type === 'open_to_close') { d1_rel2 = o1; d2_rel2 = c2; }
        else if (rel2Type === 'close_to_open') { d1_rel2 = c1; d2_rel2 = o2; }
        else if (rel2Type === 'close_to_close') { d1_rel2 = c1; d2_rel2 = c2; }
        else if (rel2Type === 'total_to_open_same') { d1_rel2 = tot1; d2_rel2 = o2; }
        else if (rel2Type === 'total_to_open_opposite') { d1_rel2 = tot1; d2_rel2 = (o2 + 5) % 10; }
        else if (rel2Type === 'total_to_close_same') { d1_rel2 = tot1; d2_rel2 = c2; }
        else if (rel2Type === 'total_to_close_opposite') { d1_rel2 = tot1; d2_rel2 = (c2 + 5) % 10; }

        passRel2 = rel2Type.startsWith('total_to_')
          ? (d1_rel2 === d2_rel2)
          : matchDigitRelation(d1_rel2, d2_rel2, rel2Action, rel2Step);
      }

      if (passRel1 && passRel2) {
        occurrences.push({
          row1: r,
          col1: fromCol,
          val1,
          row2: r2,
          col2: toCol,
          val2,
        });
      }
    }

    if (occurrences.length === 0) {
      setScanSummary({ count: 0, label: 'No matches found for specified pattern.' });
      return;
    }

    const outcomeCounts = {};
    occurrences.forEach(occ => {
      // 1. Single cell absolute outcomes across weeks 1..6
      for (let w = 1; w <= 6; w++) {
        const targetR = occ.row2 + w;
        if (targetR < grid.length) {
          for (let c = 0; c < colsInput; c++) {
            const cellVal = grid[targetR]?.[c]?.val;
            if (!cellVal || !/^\d{2}$/.test(cellVal)) continue;

            const tot = getJodiTotal(cellVal);
            const red = isRedPair(cellVal);

            if (tot !== null) {
              const kTot = `total_${w}_${c}_${tot}`;
              if (!outcomeCounts[kTot]) outcomeCounts[kTot] = { type: 'total', week: w, col: c, val: `${tot} Total`, count: 0, cells: [] };
              outcomeCounts[kTot].count++;
              outcomeCounts[kTot].cells.push({ r: targetR, c });
            }

            if (red) {
              const kRed = `red_${w}_${c}`;
              if (!outcomeCounts[kRed]) outcomeCounts[kRed] = { type: 'red', week: w, col: c, val: 'Red Pair', count: 0, cells: [] };
              outcomeCounts[kRed].count++;
              outcomeCounts[kRed].cells.push({ r: targetR, c });
            }
          }
        }
      }

      // 2. Relational Outcomes between 0Wk (occ.row2) and wWk (occ.row2 + w)
      for (let w = 1; w <= 4; w++) {
        const r0 = occ.row2;
        const rW = occ.row2 + w;
        if (rW < grid.length) {
          for (let c = 0; c < colsInput; c++) {
            const val0 = grid[r0]?.[c]?.val;
            const valW = grid[rW]?.[c]?.val;
            if (!val0 || !valW || !/^\d{2}$/.test(val0) || !/^\d{2}$/.test(valW)) continue;

            const tot0 = getJodiTotal(val0);
            const totW = getJodiTotal(valW);

            // Same Total Pair (e.g. Fri 51 & 88 [tot 6], 31 & 59 [tot 4], 81 & 90 [tot 9])
            if (tot0 !== null && totW !== null && tot0 === totW) {
              // General Same Total Pair for this column & week gap
              const kRelTot = `rel_same_total_${w}_${c}`;
              if (!outcomeCounts[kRelTot]) {
                outcomeCounts[kRelTot] = {
                  type: 'rel_total',
                  week: w,
                  col: c,
                  val: 'Same Total',
                  count: 0,
                  cells: []
                };
              }
              outcomeCounts[kRelTot].count++;
              // Both cells in the pair get the exact SAME common total digit!
              outcomeCounts[kRelTot].cells.push({ r: r0, c, badgeVal: `${tot0}` });
              outcomeCounts[kRelTot].cells.push({ r: rW, c, badgeVal: `${tot0}` });

              // Specific Total Value Pair (e.g. 4 Total -> 4 Total, 6 Total -> 6 Total, 3 Total -> 3 Total)
              const kRelTotVal = `rel_same_tot_val_${tot0}_${w}_${c}`;
              if (!outcomeCounts[kRelTotVal]) {
                outcomeCounts[kRelTotVal] = {
                  type: 'rel_total_val',
                  week: w,
                  col: c,
                  val: `${tot0} Total`,
                  count: 0,
                  cells: []
                };
              }
              outcomeCounts[kRelTotVal].count++;
              outcomeCounts[kRelTotVal].cells.push({ r: r0, c, badgeVal: `${tot0}` });
              outcomeCounts[kRelTotVal].cells.push({ r: rW, c, badgeVal: `${tot0}` });
            }

            // Same Open Pair (e.g. Open 3 -> Open 3)
            if (val0[0] === valW[0]) {
              const kRelOpen = `rel_same_open_${w}_${c}`;
              if (!outcomeCounts[kRelOpen]) {
                outcomeCounts[kRelOpen] = {
                  type: 'rel_open',
                  week: w,
                  col: c,
                  val: 'Same Open',
                  count: 0,
                  cells: []
                };
              }
              outcomeCounts[kRelOpen].count++;
              outcomeCounts[kRelOpen].cells.push({ r: r0, c, badgeVal: `${tot0}` });
              outcomeCounts[kRelOpen].cells.push({ r: rW, c, badgeVal: `${totW}` });
            }

            // Same Close Pair (e.g. Close 0 -> Close 0)
            if (val0[1] === valW[1]) {
              const kRelClose = `rel_same_close_${w}_${c}`;
              if (!outcomeCounts[kRelClose]) {
                outcomeCounts[kRelClose] = {
                  type: 'rel_close',
                  week: w,
                  col: c,
                  val: 'Same Close',
                  count: 0,
                  cells: []
                };
              }
              outcomeCounts[kRelClose].count++;
              outcomeCounts[kRelClose].cells.push({ r: r0, c, badgeVal: `${tot0}` });
              outcomeCounts[kRelClose].cells.push({ r: rW, c, badgeVal: `${totW}` });
            }

            // Repeat Jodi Pair
            if (val0 === valW) {
              const kRepJodi = `rel_repeat_jodi_${w}_${c}`;
              if (!outcomeCounts[kRepJodi]) {
                outcomeCounts[kRepJodi] = {
                  type: 'rel_repeat_jodi',
                  week: w,
                  col: c,
                  val: 'Repeat Jodi',
                  count: 0,
                  cells: []
                };
              }
              outcomeCounts[kRepJodi].count++;
              outcomeCounts[kRepJodi].cells.push({ r: r0, c });
              outcomeCounts[kRepJodi].cells.push({ r: rW, c });
            }
          }
        }
      }
    });

    const commonOutcomes = Object.values(outcomeCounts)
      .filter(item => item.count >= Math.min(2, occurrences.length))
      .sort((a, b) => b.count - a.count);

    const formatRelLabel = (type, action, step) => {
      const tName = type.replace(/_/g, ' ');
      if (action === 'SAME') return `${tName} same`;
      if (action === 'OPPOSITE') return `${tName} cut`;
      return `${tName} ${step} ${action.toLowerCase()}`;
    };

    const rel1Label = formatRelLabel(rel1Type, rel1Action, rel1Step);
    const rel2Label = rel2Type !== 'none' ? ` & ${formatRelLabel(rel2Type, rel2Action, rel2Step)}` : '';
    const gapNum = parseInt(scanWeekGap, 10);
    const gapLabel = scanWeekGap === 'auto'
      ? ''
      : (scanWeekGap === 'same_week' || scanWeekGap === '0'
          ? ' (Same Wk)'
          : ` (+${isNaN(gapNum) ? scanWeekGap : gapNum} Wk)`);
    const patternTitle = `${COL_HEADERS[fromCol]}→${COL_HEADERS[toCol]}${gapLabel} ${rel1Label}${rel2Label}`;

    const primaryPatternCells = [];
    const repeatJodiCells = [];

    occurrences.forEach(occ => {
      // 1. Highlight the pattern occurrence pair cells (val1 and val2)
      primaryPatternCells.push({ r: occ.row1, c: occ.col1 });
      primaryPatternCells.push({ r: occ.row2, c: occ.col2 });

      // 2. Scan forward cell-by-cell after (row2, col2) for the VERY FIRST / NEAREST exact re-appearance of val2 (e.g. 76)
      const targetVal = occ.val2;
      if (targetVal && /^\d{2}$/.test(targetVal)) {
        let found = false;
        for (let r = occ.row2; r < grid.length && !found; r++) {
          const startC = (r === occ.row2) ? occ.col2 + 1 : 0;
          for (let c = startC; c < colsInput; c++) {
            if (grid[r]?.[c]?.val === targetVal) {
              repeatJodiCells.push({ r, c });
              found = true;
              break;
            }
          }
        }
      }
    });

    const patternRule = {
      id: `pattern_${Date.now()}`,
      label: `🟢 Pattern: ${patternTitle} (${occurrences.length}x)`,
      color: '#10b981',
      borderColor: '#059669',
      bg: 'bg-emerald-950',
      text: 'text-emerald-300',
      cells: primaryPatternCells
    };

    const outcomeRules = commonOutcomes.slice(0, 6).map((out, idx) => {
      const isRed = out.type === 'red';
      const isRel = out.type.startsWith('rel_');
      const dayName = COL_HEADERS[out.col];
      const icon = isRed ? '🔴' : isRel ? '🔮' : '🟡';
      const color = isRed ? '#ef4444' : isRel ? '#a855f7' : '#f59e0b';
      const borderColor = isRed ? '#dc2626' : isRel ? '#9333ea' : '#d97706';
      const bg = isRed ? 'bg-red-950' : isRel ? 'bg-purple-950' : 'bg-amber-950';
      const text = isRed ? 'text-red-300' : isRel ? 'text-purple-300' : 'text-amber-300';

      return {
        id: `outcome_${idx}_${Date.now()}`,
        label: `${icon} ${out.week === 0 ? '' : `${out.week}Wk `}${dayName}: ${out.val} (${out.count}x)`,
        color,
        borderColor,
        bg,
        text,
        cells: out.cells
      };
    });

    const generatedRules = [patternRule];

    if (repeatJodiCells.length > 0) {
      const sampleRepeatVal = occurrences[0]?.val2 || '';
      generatedRules.push({
        id: `repeat_jodi_${Date.now()}`,
        label: `🔁 Nearest Repeat Jodi (${sampleRepeatVal}) (${repeatJodiCells.length}x)`,
        color: '#34d399',
        borderColor: '#10b981',
        bg: 'bg-teal-950',
        text: 'text-teal-300',
        cells: repeatJodiCells
      });
    }

    generatedRules.push(...outcomeRules);
    setActiveRules(generatedRules);
    setScanSummary({ count: occurrences.length, label: patternTitle, occurrences, commonOutcomes });
  }, [grid, scanFromDay, scanToDay, scanWeekGap, rel1Type, rel1Action, rel1Step, rel2Type, rel2Action, rel2Step, colsInput]);

  const removeRule = (ruleId) => {
    setActiveRules(prev => prev.filter(r => r.id !== ruleId));
  };

  const clearAllRules = () => {
    setActiveRules([]);
    setScanSummary(null);
  };

  const scanCellHighlightMap = useMemo(() => {
    const map = {};
    activeRules.forEach(rule => {
      rule.cells.forEach(cell => {
        const key = `${cell.r}_${cell.c}`;
        if (!map[key]) {
          map[key] = { rule, badgeVal: cell.badgeVal || null };
        }
      });
    });
    return map;
  }, [activeRules]);

  // ───────────────────────────────────────────────────────────────────────────

  const lastFilledRowIndex = useMemo(() => {
    for (let r = grid.length - 1; r >= 0; r--) {
      if (grid[r] && grid[r].some(cell => cell.val && cell.val !== '')) {
        return r;
      }
    }
    return Math.max(0, grid.length - 1);
  }, [grid]);

  const scrollToRowIndex = (rIdx) => {
    if (containerRef.current) {
      const targetScroll = Math.max(0, rIdx * rowHeight - 60);
      containerRef.current.scrollTo({
        top: targetScroll,
        behavior: 'smooth'
      });
    }
  };

  const totalRows = displayGrid.length;

  const handleScroll = (e) => {
    setScrollTop(e.target.scrollTop);
  };

  const { startRow, endRow, topPadding, bottomPadding } = useMemo(() => {
    if (totalRows <= 1000) {
      return { startRow: 0, endRow: totalRows, topPadding: 0, bottomPadding: 0 };
    }
    const chunkSize = 50;
    const currentChunk = Math.floor(scrollTop / (chunkSize * rowHeight));
    const startIndex = Math.max(0, (currentChunk - 2) * chunkSize);
    const endIndex = Math.min(totalRows, (currentChunk + 4) * chunkSize);
    const topPad = startIndex * rowHeight;
    const bottomPad = (totalRows - endIndex) * rowHeight;
    return { startRow: startIndex, endRow: endIndex, topPadding: topPad, bottomPadding: bottomPad };
  }, [scrollTop, totalRows, rowHeight]);

  const visibleRows = useMemo(() => {
    return displayGrid.slice(startRow, endRow);
  }, [displayGrid, startRow, endRow]);

  const chartKeys = Object.keys(charts);

  return (
    <div className="min-h-screen bg-[#f7e3c4] text-slate-950 font-poppins selection:bg-pink-500 selection:text-white pb-20">
      
      <div className="max-w-3xl mx-auto px-1 sm:px-3 space-y-2 pt-2">
        
        {/* 1. TOP HEADER PANEL WITH CONTROLS */}
        <div className="bg-slate-950 text-slate-100 border border-slate-800 rounded-2xl p-3 shadow-xl space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Brain className="w-5 h-5 text-purple-400 animate-pulse" />
                <select
                  value={selectedChart}
                  onChange={(e) => {
                    setSelectedChart(e.target.value);
                    setActiveChartName(e.target.value);
                  }}
                  className="bg-slate-900 text-amber-400 text-base sm:text-xl font-black uppercase tracking-wide rounded-xl px-2.5 py-1 outline-none border border-slate-700 cursor-pointer"
                >
                  {chartKeys.length === 0 ? (
                    <option value="NO CHARTS">NO CHARTS SAVED</option>
                  ) : (
                    chartKeys.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))
                  )}
                </select>
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span>AI Pattern Engine | {grid.length} Rows × {colsInput} Cols</span>
                <span className="bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-black text-[9px] border border-emerald-500/30">v2.6 • Clean Engine</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setShowOpenFinder(v => !v)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-black shadow transition-all active:scale-95 border ${
                  showOpenFinder ? 'bg-cyan-950 border-cyan-500 text-cyan-300' : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}
              >
                <Search className="w-3.5 h-3.5 text-cyan-400" />
                <span>Open Finder: {showOpenFinder ? 'ON' : 'OFF'}</span>
              </button>

              <button
                onClick={() => setShowStats(v => !v)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-black shadow transition-all active:scale-95 border ${
                  showStats ? 'bg-emerald-950 border-emerald-500 text-emerald-300' : 'bg-slate-900 border-slate-700 text-slate-400'
                }`}
              >
                {showStats ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-500" />}
                <span>Stats: {showStats ? 'ON' : 'OFF'}</span>
              </button>

              <button
                onClick={() => scrollToRowIndex(lastFilledRowIndex)}
                className="flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white px-2.5 py-1.5 rounded-xl text-xs font-black shadow transition-all active:scale-95"
              >
                <ArrowDown className="w-3.5 h-3.5" /> Bottom
              </button>

              <button
                onClick={() => setShowControls(v => !v)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-black shadow transition-all active:scale-95 border ${
                  showControls ? 'bg-rose-600 border-rose-500 text-white' : 'bg-slate-900 border-slate-700 text-amber-300'
                }`}
              >
                <Settings2 className="w-3.5 h-3.5" />
                {showControls ? 'Close' : 'Controls'}
              </button>
            </div>
          </div>

          {showControls && (
            <div className="pt-2 border-t border-slate-800 space-y-2 animate-fadeIn">
              <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                <span>Display Options:</span>
                <button onClick={() => setShowControls(false)} className="text-slate-400 hover:text-white">Close ✕</button>
              </div>
              <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
                <button
                  onClick={() => setShowOpenFinder(v => !v)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    showOpenFinder ? 'bg-cyan-950 border-cyan-500 text-cyan-300' : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  🔍 Open Finder (5,8,0): {showOpenFinder ? 'ENABLED' : 'DISABLED'}
                </button>
                <button
                  onClick={() => setShowStats(v => !v)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    showStats ? 'bg-emerald-950 border-emerald-500 text-emerald-300' : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  Stats (Sum / CN / Cond): {showStats ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* OPEN FINDER CONTROL PANEL */}
        {showOpenFinder && (
          <div className="bg-slate-950 border-2 border-cyan-500/80 text-white rounded-2xl p-3 shadow-2xl space-y-2.5 animate-fadeIn">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <div className="bg-gradient-to-tr from-cyan-600 to-blue-600 p-1.5 rounded-xl text-white">
                  <Search className="w-4 h-4 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-cyan-300">
                    Open / Close Sequence Finder (3-Step Scanner)
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Enter 3 digits e.g. <strong className="text-cyan-400">5, 8, 0</strong> to highlight sequence runs on the chart
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowOpenFinder(false)}
                className="text-[10px] font-bold text-slate-400 hover:text-white bg-slate-900 border border-slate-700 px-2 py-1 rounded-lg"
              >
                Close ✕
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <label className="text-[9px] text-cyan-400 font-bold block mb-1 uppercase tracking-wider">
                  Digits Input (Past Sequence):
                </label>
                <input
                  type="text"
                  value={sequenceInput}
                  onChange={(e) => setSequenceInput(e.target.value)}
                  placeholder="e.g. 5, 8, 0"
                  className="w-full bg-slate-900 border-2 border-cyan-500/80 focus:border-cyan-400 text-white text-xs sm:text-sm font-mono font-black px-3 py-1.5 rounded-xl outline-none shadow-inner"
                />
              </div>

              <div className="flex items-center gap-1 pt-3 flex-wrap">
                <span className="text-[9px] text-slate-400 font-bold">Quick:</span>
                {['5, 8, 0', '1, 2, 3', '0, 5, 0', '7, 8, 9'].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setSequenceInput(preset)}
                    className={`text-[9px] font-mono font-bold px-2 py-1 rounded-lg border transition ${
                      sequenceInput === preset
                        ? 'bg-cyan-600 text-white border-cyan-400 shadow-md'
                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {sequenceResults && sequenceResults.totalMatches > 0 && (
              <div className="flex items-center justify-between flex-wrap gap-2 text-xs font-mono bg-slate-900/90 border border-slate-800 p-2 rounded-xl">
                <span className="font-bold text-cyan-300">
                  Found <strong className="text-cyan-400 text-sm">{sequenceResults.totalMatches}</strong> sequence match(es) for &quot;{sequenceResults.targetSeqStr}&quot;
                </span>
                <div className="flex items-center gap-1.5 overflow-x-auto">
                  {sequenceResults.matches.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => scrollToRowIndex(m.startRow)}
                      style={{ backgroundColor: m.color, color: '#020617' }}
                      className="text-[9px] font-black font-mono px-2 py-0.5 rounded-md shadow-sm border border-black/80 shrink-0 hover:opacity-90"
                    >
                      #{m.matchNumber}: R{m.startRow + 1} ({m.direction})
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. AUTONOMOUS CROSS-DAY PATTERN & FOLLOW-UP OUTCOME SCANNER */}
        <div className="bg-slate-950 border-2 border-purple-500/80 text-white rounded-2xl p-3 shadow-2xl space-y-2.5">
          
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <div className="bg-gradient-to-tr from-purple-600 to-pink-600 p-1.5 rounded-xl text-white">
                <BarChart2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-base font-black uppercase tracking-wider text-purple-300">
                  RUN
                </h3>
              </div>
            </div>

            <button
              onClick={runAutonomousPatternScan}
              className="flex items-center gap-1.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white px-4 py-1.5 rounded-xl text-xs sm:text-sm font-black shadow-lg hover:shadow-purple-500/30 transition-all active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>RUN</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
            
            {/* FROM DAY -> TO DAY & WEEK GAP SELECTORS */}
            <div className="bg-slate-900 border border-slate-800 p-2 rounded-xl space-y-1.5">
              <div className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">1. Select Days &amp; Row Gap</div>
              <div className="flex items-center gap-1.5">
                <div className="flex-1">
                  <label className="text-[9px] text-slate-400 block">From Day:</label>
                  <select
                    value={scanFromDay}
                    onChange={(e) => setScanFromDay(parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 text-cyan-300 font-bold p-1 rounded-lg text-xs"
                  >
                    {DAY_NAMES_FULL.map((d, i) => (
                      <option key={i} value={i}>{d} ({COL_HEADERS[i]})</option>
                    ))}
                  </select>
                </div>

                <span className="text-purple-400 font-black text-sm mt-3">→</span>

                <div className="flex-1">
                  <label className="text-[9px] text-slate-400 block">To Day:</label>
                  <select
                    value={scanToDay}
                    onChange={(e) => setScanToDay(parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-700 text-cyan-300 font-bold p-1 rounded-lg text-xs"
                  >
                    {DAY_NAMES_FULL.map((d, i) => (
                      <option key={i} value={i}>{d} ({COL_HEADERS[i]})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Week Gap Selection: Interactive Stepper (- / +) & Dropdown */}
              <div>
                <label className="text-[9px] text-slate-400 block mb-1">
                  Row / Week Gap <span className="text-amber-400 font-bold">(Use - / + to adjust weeks)</span>:
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    onClick={() => setScanWeekGap('auto')}
                    className={`px-2 py-1 rounded-lg text-xs font-bold font-mono transition border ${
                      scanWeekGap === 'auto'
                        ? 'bg-purple-600 text-white border-purple-400 shadow-md'
                        : 'bg-slate-950 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    Auto
                  </button>

                  <div className="flex items-center bg-slate-950 border border-slate-700 rounded-lg p-0.5">
                    <button
                      onClick={() => {
                        const cur = scanWeekGap === 'auto'
                          ? (scanFromDay <= scanToDay ? 0 : 1)
                          : (scanWeekGap === 'same_week' ? 0 : scanWeekGap === 'next_week' ? 1 : parseInt(scanWeekGap, 10) || 0);
                        const prev = Math.max(0, cur - 1);
                        setScanWeekGap(prev.toString());
                      }}
                      className="w-6 h-6 bg-slate-900 hover:bg-slate-800 text-amber-300 font-black rounded flex items-center justify-center transition border border-slate-700 text-sm active:scale-95"
                      title="Decrease Week Gap (-1)"
                    >
                      -
                    </button>

                    <span className="px-2.5 text-xs font-mono font-black text-amber-300 min-w-[76px] text-center">
                      {scanWeekGap === 'auto'
                        ? 'Auto Gap'
                        : (scanWeekGap === '0' || scanWeekGap === 'same_week'
                            ? 'Same Wk'
                            : `+${scanWeekGap === 'next_week' ? 1 : scanWeekGap.replace(/\D/g, '') || scanWeekGap} Wk`)}
                    </span>

                    <button
                      onClick={() => {
                        const cur = scanWeekGap === 'auto'
                          ? (scanFromDay <= scanToDay ? 0 : 1)
                          : (scanWeekGap === 'same_week' ? 0 : scanWeekGap === 'next_week' ? 1 : parseInt(scanWeekGap, 10) || 0);
                        const next = cur + 1;
                        setScanWeekGap(next.toString());
                      }}
                      className="w-6 h-6 bg-slate-900 hover:bg-slate-800 text-amber-300 font-black rounded flex items-center justify-center transition border border-slate-700 text-sm active:scale-95"
                      title="Increase Week Gap (+1)"
                    >
                      +
                    </button>
                  </div>

                  <select
                    value={scanWeekGap}
                    onChange={(e) => setScanWeekGap(e.target.value)}
                    className="bg-slate-950 border border-slate-700 text-amber-300 font-bold p-1 rounded-lg text-xs flex-1 min-w-[110px]"
                  >
                    <option value="auto">Auto Gap</option>
                    <option value="0">Same Wk (+0 Row)</option>
                    <option value="1">+1 Wk (+1 Row)</option>
                    <option value="2">+2 Wks (+2 Rows)</option>
                    <option value="3">+3 Wks (+3 Rows)</option>
                    <option value="4">+4 Wks (+4 Rows)</option>
                    <option value="5">+5 Wks (+5 Rows)</option>
                    <option value="6">+6 Wks (+6 Rows)</option>
                    <option value="7">+7 Wks (+7 Rows)</option>
                    <option value="8">+8 Wks (+8 Rows)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* RELATION 1 SELECTOR */}
            <div className="bg-slate-900 border border-slate-800 p-2 rounded-xl space-y-1.5">
              <div className="text-[10px] text-pink-400 font-bold uppercase tracking-wider">2. Relation 1 (e.g. Total → Close Opp)</div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <select
                  value={rel1Type}
                  onChange={(e) => setRel1Type(e.target.value)}
                  className="bg-slate-950 border border-slate-700 text-pink-300 font-bold p-1 rounded-lg text-xs flex-1 min-w-[120px] max-w-[62%] sm:max-w-none truncate"
                >
                  <option value="open_to_open">Open → Open</option>
                  <option value="open_to_close">Open → Close</option>
                  <option value="close_to_open">Close → Open</option>
                  <option value="close_to_close">Close → Close</option>
                  <option value="total_to_open_same">Total → Open (Same)</option>
                  <option value="total_to_open_opposite">Total → Open (Cut/Opp)</option>
                  <option value="total_to_close_same">Total → Close (Same)</option>
                  <option value="total_to_close_opposite">Total → Close (Cut/Opp)</option>
                </select>

                {!rel1Type.startsWith('total_to_') && (
                  <>
                    <select
                      value={rel1Action}
                      onChange={(e) => setRel1Action(e.target.value)}
                      className="bg-slate-950 border border-slate-700 text-amber-300 font-bold p-1 rounded-lg text-xs shrink-0"
                    >
                      <option value="SAME">Same</option>
                      <option value="OPPOSITE">Cut / Opp</option>
                      <option value="UP">Up</option>
                      <option value="DOWN">Down</option>
                    </select>

                    {(rel1Action === 'UP' || rel1Action === 'DOWN') && (
                      <select
                        value={rel1Step}
                        onChange={(e) => setRel1Step(parseInt(e.target.value))}
                        className="bg-slate-950 border border-slate-700 text-emerald-300 font-bold p-1 rounded-lg text-xs shrink-0"
                      >
                        {[1, 2, 3, 4, 5].map(n => (
                          <option key={n} value={n}>{n} Step</option>
                        ))}
                      </select>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* RELATION 2 SELECTOR (COMPOUND CONDITION) */}
            <div className="bg-slate-900 border border-slate-800 p-2 rounded-xl space-y-1.5 sm:col-span-2">
              <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">3. Relation 2 (e.g. Close to Close 1 Up)</div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <select
                  value={rel2Type}
                  onChange={(e) => setRel2Type(e.target.value)}
                  className="bg-slate-950 border border-slate-700 text-emerald-300 font-bold p-1 rounded-lg text-xs flex-1 min-w-[120px] max-w-[62%] sm:max-w-none truncate"
                >
                  <option value="none">None (Single Clause)</option>
                  <option value="close_to_close">Close → Close</option>
                  <option value="open_to_open">Open → Open</option>
                  <option value="open_to_close">Open → Close</option>
                  <option value="close_to_open">Close → Open</option>
                  <option value="total_to_open_same">Total → Open (Same)</option>
                  <option value="total_to_open_opposite">Total → Open (Cut/Opp)</option>
                  <option value="total_to_close_same">Total → Close (Same)</option>
                  <option value="total_to_close_opposite">Total → Close (Cut/Opp)</option>
                </select>

                {rel2Type !== 'none' && !rel2Type.startsWith('total_to_') && (
                  <>
                    <select
                      value={rel2Action}
                      onChange={(e) => setRel2Action(e.target.value)}
                      className="bg-slate-950 border border-slate-700 text-amber-300 font-bold p-1 rounded-lg text-xs"
                    >
                      <option value="UP">Up</option>
                      <option value="DOWN">Down</option>
                      <option value="SAME">Same</option>
                      <option value="OPPOSITE">Cut / Opp</option>
                    </select>

                    {(rel2Action === 'UP' || rel2Action === 'DOWN') && (
                      <select
                        value={rel2Step}
                        onChange={(e) => setRel2Step(parseInt(e.target.value))}
                        className="bg-slate-950 border border-slate-700 text-cyan-300 font-bold p-1 rounded-lg text-xs"
                      >
                        {[1, 2, 3, 4, 5].map(n => (
                          <option key={n} value={n}>{n} Step</option>
                        ))}
                      </select>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>

          {activeRules.length > 0 && (
            <div className="flex items-center justify-between flex-wrap bg-slate-900 border border-slate-800 rounded-xl p-2 gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  ACTIVE RULES ({activeRules.length}):
                </span>
                {activeRules.map((rule) => (
                  <div
                    key={rule.id}
                    className={`flex items-center gap-1.5 border ${rule.bg} ${rule.text} text-xs font-black font-mono px-2.5 py-1 rounded-lg shadow-sm`}
                    style={{ borderColor: rule.borderColor }}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full inline-block border border-black/40"
                      style={{ backgroundColor: rule.color, boxShadow: `0 0 6px ${rule.color}` }}
                    />
                    <span>{rule.label}</span>
                    <button
                      onClick={() => removeRule(rule.id)}
                      className="ml-1 text-slate-300 hover:text-white hover:bg-black/40 rounded-full p-0.5 transition"
                      title="Remove filter"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={clearAllRules}
                className="text-[10px] font-bold text-red-400 hover:text-red-300 bg-red-950/60 border border-red-800/80 px-2 py-0.5 rounded-md transition"
              >
                Clear All
              </button>
            </div>
          )}

          {scanSummary && (
            <div className="bg-slate-900 border border-purple-500/50 p-2.5 rounded-xl space-y-2 font-mono text-xs text-white shadow-xl">
              <div className="flex items-center justify-between flex-wrap">
                <span className="font-extrabold text-slate-200 flex items-center gap-1.5 text-sm sm:text-base">
                  🎯 Found <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono tracking-tight px-1.5 py-0.5 bg-emerald-950/80 border border-emerald-500/50 rounded-lg shadow-inner">{scanSummary.count}</span>
                </span>
              </div>
              {scanSummary.occurrences && scanSummary.occurrences.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto py-1">
                  {scanSummary.occurrences.map((occ, idx) => {
                    const BADGE_COLORS = [
                      'bg-cyan-500 text-slate-950 border-cyan-300',
                      'bg-purple-500 text-white border-purple-300',
                      'bg-emerald-500 text-slate-950 border-emerald-300',
                      'bg-amber-500 text-slate-950 border-amber-300',
                      'bg-pink-500 text-white border-pink-300',
                      'bg-indigo-500 text-white border-indigo-300'
                    ];
                    const badgeClass = BADGE_COLORS[idx % BADGE_COLORS.length];

                    return (
                      <button
                        key={idx}
                        onClick={() => scrollToRowIndex(occ.row1)}
                        className="flex items-center gap-1.5 bg-slate-950 border border-slate-700/80 hover:border-pink-500/60 text-purple-200 text-xs font-bold px-2.5 py-1 rounded-xl shrink-0 transition hover:scale-105 shadow-sm"
                      >
                        <span className={`w-5 h-5 rounded-lg flex items-center justify-center text-xs font-black font-mono shadow-md border ${badgeClass}`}>
                          {idx + 1}
                        </span>
                        <span className="font-mono text-slate-200">
                          #{occ.row1 + 1} ({occ.val1}) → #{occ.row2 + 1} ({occ.val2})
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. MATKA GRID - EXPANDED HEIGHT TO SEE MORE WEEKS WITHOUT WHITE SCREEN GAPS */}
        <div className="bg-slate-950 p-1 rounded-2xl shadow-2xl space-y-2 border border-slate-800">
          <div
            ref={containerRef}
            onScroll={handleScroll}
            className="smooth-scroll-container overflow-y-auto overflow-x-auto min-h-[60vh] max-h-[82vh] border border-slate-800 rounded-xl bg-white shadow-2xl"
          >
            <div className="w-full min-w-full">
              <table className="w-full table-fixed white-chart-table">
                <thead className="sticky top-0 z-20 shadow-md bg-slate-200">
                  <tr>
                    <th className="w-7 sm:w-10 text-center border border-slate-950 bg-slate-200 p-0.5">
                      <button
                        onClick={() => scrollToRowIndex(lastFilledRowIndex)}
                        title={`Jump to row #${lastFilledRowIndex + 1}`}
                        className="w-full py-0.5 text-slate-950 font-black flex items-center justify-center text-[10px] sm:text-xs"
                      >
                        #
                      </button>
                    </th>
                    {Array.from({ length: colsInput }).map((_, c) => (
                      <th key={c} className="text-center border border-slate-950 text-slate-950 font-black text-xs sm:text-base py-0.5">
                        {COL_HEADERS[c] || `C${c + 1}`}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {topPadding > 0 && (
                    <tr>
                      <td colSpan={colsInput + 1} style={{ height: `${topPadding}px`, padding: 0, border: 'none' }} />
                    </tr>
                  )}

                  {visibleRows.map((row, relativeRIdx) => {
                    const rIdx = startRow + relativeRIdx;
                    return (
                      <tr key={rIdx} style={{ height: `${rowHeight}px` }}>
                        <td className="text-center font-black text-slate-950 text-[10px] sm:text-base bg-slate-100 border border-slate-950 align-middle px-0.5">
                          {rIdx + 1}
                        </td>

                        {row.map((cell, cIdx) => {
                          const val = cell.val || '';
                          const total = calculateTotal(val);
                          const diffTotal = calculateDiffTotal(val);
                          const cn = calculateCN(val);
                          const closeCond = calculateCloseCond(val);
                          const red = isRedPair(val);

                          const cellMatches = cellMatchMap[`${rIdx}_${cIdx}`] || [];
                          const primaryMatch = cellMatches[0] || null;

                          const emptyCellPredictions = emptyCellMap[`${rIdx}_${cIdx}`] || [];
                          const primaryEmptyPred = emptyCellPredictions[0] || null;

                          const scanHighlightData = scanCellHighlightMap[`${rIdx}_${cIdx}`] || null;
                          const scanHighlightRule = scanHighlightData ? scanHighlightData.rule : null;
                          const scanCellBadge = scanHighlightData ? scanHighlightData.badgeVal : null;

                          let bgStyle = 'white';
                          let borderStyle = '#020617';
                          let borderWidthStyle = '1px';
                          let shadowStyle = 'none';

                          if (primaryMatch) {
                            bgStyle = `${primaryMatch.color}35`;
                            borderStyle = primaryMatch.color;
                            borderWidthStyle = '3.5px';
                            shadowStyle = `0 0 12px ${primaryMatch.color}90 inset`;
                          } else if (scanHighlightRule) {
                            bgStyle = `${scanHighlightRule.color}40`;
                            borderStyle = scanHighlightRule.color;
                            borderWidthStyle = '3px';
                            shadowStyle = `0 0 10px ${scanHighlightRule.color}bb inset`;
                          } else if (primaryEmptyPred) {
                            bgStyle = '#fce7f3';
                            borderStyle = '#ec4899';
                            borderWidthStyle = '3.5px';
                            shadowStyle = '0 0 12px #ec489980 inset';
                          }

                          return (
                            <td
                              key={cIdx}
                              style={{
                                backgroundColor: bgStyle,
                                borderColor: borderStyle,
                                borderWidth: borderWidthStyle,
                                boxShadow: shadowStyle
                              }}
                              className={`relative p-0 text-center align-middle ${
                                primaryMatch || scanHighlightRule ? 'z-10' : (primaryEmptyPred ? 'z-10 bg-pink-100/60' : '')
                              }`}
                            >
                              <div className={`flex flex-col justify-between items-center h-full w-full ${showStats ? 'py-0.5 px-0.5' : 'justify-center'}`}>
                                {/* TOP RIGHT EDGE: Small Common Total / Number Badge */}
                                {scanCellBadge && (
                                  <div className="absolute top-0 right-0 z-20 pointer-events-none">
                                    <span className="text-[9px] sm:text-[11px] font-black font-mono text-purple-950 bg-amber-300 border-b border-l border-amber-500 rounded-bl px-1 py-0.2 shadow-sm leading-none inline-block">
                                      {scanCellBadge}
                                    </span>
                                  </div>
                                )}

                                {/* TOP: Total (emerald left) + Diff Total (red right) */}
                                {showStats && (
                                  <div className="flex justify-between items-center w-full px-1 leading-none pt-0.5 pointer-events-none">
                                    <span className="text-emerald-700 font-extrabold text-[9px] sm:text-xs font-mono">
                                      {total !== null ? total : ''}
                                    </span>
                                    <span className="text-red-700 font-extrabold text-[9px] sm:text-xs font-mono">
                                      {diffTotal !== null ? diffTotal : ''}
                                    </span>
                                  </div>
                                )}

                                {/* MIDDLE: Jodi Input */}
                                <div className="flex items-center justify-center w-full my-auto relative z-10">
                                  <input
                                    id={`ai-cell-${rIdx}-${cIdx}`}
                                    type="text"
                                    value={val}
                                    onChange={(e) => handleAICellChange(rIdx, cIdx, e.target.value)}
                                    onFocus={(e) => e.target.select()}
                                    maxLength={2}
                                    placeholder=""
                                    className={`w-full text-center text-base xs:text-lg sm:text-xl font-black font-mono tracking-tighter sm:tracking-wider leading-none bg-transparent border-none outline-none focus:ring-1 focus:ring-cyan-400 rounded ${
                                      primaryMatch || scanHighlightRule
                                        ? (red ? 'red-pair-text font-black drop-shadow-md' : 'text-slate-950 font-black drop-shadow-md')
                                        : (red ? 'red-pair-text' : 'text-slate-950 font-black')
                                    }`}
                                  />
                                </div>

                                {primaryEmptyPred && !val && (
                                  <div className="absolute inset-0 flex flex-col items-center justify-center z-20 pointer-events-none bg-pink-100/90 rounded border-2 border-pink-500 shadow-md p-0.5">
                                    <span className="text-[7px] sm:text-[9px] font-mono font-black text-pink-700 tracking-tighter uppercase leading-none">
                                      🔮 {primaryEmptyPred.predictedDigitType.toUpperCase()} NEEDED
                                    </span>
                                    <span className="text-sm sm:text-2xl font-black font-mono text-pink-950 leading-none mt-0.5">
                                      {primaryEmptyPred.predictedDigit} <span className="text-[9px] text-pink-700 font-bold">({primaryEmptyPred.cutDigit})</span>
                                    </span>
                                  </div>
                                )}

                                {cellMatches.length > 0 && (
                                  <div className="absolute top-0.5 left-0.5 flex flex-col items-start gap-0.5 z-20 pointer-events-none">
                                    {cellMatches.map((m, idx) => (
                                      <span
                                        key={idx}
                                        style={{ backgroundColor: m.color, color: '#020617' }}
                                        className="text-[7px] font-black font-mono px-1 py-0.2 rounded-full shadow-sm leading-none border border-black/90 uppercase tracking-tighter"
                                        title={`Match #${m.matchNumber}: Step ${m.stepIdx} of ${m.totalSteps}`}
                                      >
                                        #{m.matchNumber}:S{m.stepIdx}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {/* BOTTOM: Open-Close Condition Pair */}
                                {showStats && (
                                  <div className="w-full text-center leading-none pb-0.5 pointer-events-none">
                                    {cn !== null && closeCond !== null ? (
                                      <span className="inline-block text-[9px] sm:text-xs font-black font-mono text-slate-950 bg-slate-200/90 border border-slate-300 rounded px-1 shadow-xs">
                                        {`${cn}-${closeCond}`}
                                      </span>
                                    ) : (
                                      <span className="text-[9px] opacity-0">-</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}

                  {bottomPadding > 0 && (
                    <tr>
                      <td colSpan={colsInput + 1} style={{ height: `${bottomPadding}px`, padding: 0, border: 'none' }} />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* TABLE FOOTER ACTION BUTTONS */}
          <div className="flex items-center justify-between flex-wrap gap-2 p-2 bg-slate-900 rounded-xl border border-slate-800 text-xs font-mono">
            <span className="text-slate-400 font-bold">
              Showing <strong className="text-amber-400">{displayGrid.length} Weeks</strong>
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => scrollToRowIndex(0)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-2.5 py-1.5 rounded-xl border border-slate-700"
              >
                Top ⬆
              </button>
              <button
                onClick={() => scrollToRowIndex(lastFilledRowIndex)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold px-2.5 py-1.5 rounded-xl border border-slate-700"
              >
                Bottom ⬇
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
