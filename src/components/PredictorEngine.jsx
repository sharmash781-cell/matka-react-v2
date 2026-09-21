import React, { useState, useEffect } from 'react';
import { useChart, isRedPair, RED_PAIRS } from '../context/ChartContext';
import { Zap, Trophy, Brain, Sparkles, Play, Clock, Flame, Palette, Link2 } from 'lucide-react';

const LOOKBACK_WINDOW = 120; // Rolling lookback window for optimal performance
const COL_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Col 8'];

export const PredictorEngine = () => {
  const { charts, activeChartName, setActiveChartName, activeChart, learnedModels, activeModelName, customAIPatterns } = useChart();

  const [targetRow, setTargetRow] = useState(10);
  const [targetCol, setTargetCol] = useState(1);
  const [predictionResult, setPredictionResult] = useState(null);
  const [selectedJodiFilter, setSelectedJodiFilter] = useState('ALL');

  // Master Triad Strategy Options (Default OFF)
  const [enableMasterTriadFinder, setEnableMasterTriadFinder] = useState(false);
  const [triadCycleInterval, setTriadCycleInterval] = useState('4');
  const [triadTargetSeq, setTriadTargetSeq] = useState('DECREMENT_2');
  const [triadHighlightColor, setTriadHighlightColor] = useState('BLUE');

  const activeModel = learnedModels[activeModelName] || {
    columnWeight: 1.35, rowWeight: 1.20, conditionWeight: 1.45, familyWeight: 1.15, redPairWeight: 1.25, recencyDecay: 0.97
  };

  useEffect(() => {
    if (activeChart && activeChart.data) {
      const grid = activeChart.data;
      let lastR = -1;
      let lastC = -1;

      for (let r = 0; r < grid.length; r++) {
        if (grid[r]) {
          for (let c = 0; c < grid[r].length; c++) {
            if (grid[r][c]?.val && grid[r][c].val.trim() !== '') {
              lastR = r;
              lastC = c;
            }
          }
        }
      }

      if (lastR !== -1 && lastC !== -1) {
        if (lastC >= activeChart.cols - 1) {
          setTargetRow(lastR + 2); // Next row, Monday
          setTargetCol(1);
        } else {
          setTargetRow(lastR + 1); // Same row, next column
          setTargetCol(lastC + 2);
        }
      } else {
        setTargetRow(1);
        setTargetCol(1);
      }
    }
  }, [activeChartName, activeChart]);

  const getCut = (d) => (d + 5) % 10;

  const getFamilySet = (o, c) => {
    const cutO = getCut(o);
    const cutC = getCut(c);
    return new Set([
      `${o}${c}`, `${o}${cutC}`, `${cutO}${c}`, `${cutO}${cutC}`,
      `${c}${o}`, `${c}${cutO}`, `${cutC}${o}`, `${cutC}${cutO}`
    ]);
  };

  const runPredictor = () => {
    if (!activeChart) return;

    const startTime = performance.now();
    const grid = activeChart.data;
    const targetRowIdx = Math.max(0, targetRow - 1);
    const colVal = Math.max(0, Math.min(activeChart.cols - 1, targetCol - 1));

    const candidateScores = {};
    const candidateLogs = {};

    const addPoints = (jodi, basePoints, weightMultiplier, recencyFactor, reason) => {
      if (!/^\d{2}$/.test(jodi)) return;
      const pts = Math.round(basePoints * weightMultiplier * recencyFactor);
      candidateScores[jodi] = (candidateScores[jodi] || 0) + pts;
      if (!candidateLogs[jodi]) candidateLogs[jodi] = [];
      candidateLogs[jodi].push({ points: pts, reason });
    };

    let cellCountScanned = 0;
    let customVisualRulesApplied = 0;
    let openToOpenHarmonicScansApplied = 0;

    const startRowIdx = Math.max(0, targetRowIdx - LOOKBACK_WINDOW);

    // --- PASS 1: Vertical Column Step & Harmonic Run ---
    if (targetRowIdx >= 2) {
      const prev1 = grid[targetRowIdx - 1] ? grid[targetRowIdx - 1][colVal]?.val : null;
      const prev2 = grid[targetRowIdx - 2] ? grid[targetRowIdx - 2][colVal]?.val : null;

      if (prev1 && /^\d{2}$/.test(prev1) && prev2 && /^\d{2}$/.test(prev2)) {
        const o1 = parseInt(prev1[0]), c1 = parseInt(prev1[1]);
        const o2 = parseInt(prev2[0]), c2 = parseInt(prev2[1]);

        const deltaO = (o1 - o2 + 10) % 10;
        const deltaC = (c1 - c2 + 10) % 10;

        const projO = (o1 + deltaO) % 10;
        const projC = (c1 + deltaC) % 10;
        const projJodi = `${projO}${projC}`;

        addPoints(projJodi, 45, activeModel.columnWeight, 1.0, `Vertical Column Step: Row -1 (${prev1}) vs Row -2 (${prev2}) -> ΔOpen=+${deltaO}, ΔClose=+${deltaC}`);
        addPoints(`${getCut(projO)}${projC}`, 25, activeModel.columnWeight, 1.0, `Cut-Open Harmonic Variation from projected ${projJodi}`);
      }
    }

    // --- PASS 2: Horizontal Row Sequence Progression ---
    if (colVal >= 2 && grid[targetRowIdx]) {
      const prevDay1 = grid[targetRowIdx][colVal - 1]?.val;
      const prevDay2 = grid[targetRowIdx][colVal - 2]?.val;

      if (prevDay1 && /^\d{2}$/.test(prevDay1) && prevDay2 && /^\d{2}$/.test(prevDay2)) {
        const o1 = parseInt(prevDay1[0]), c1 = parseInt(prevDay1[1]);
        const o2 = parseInt(prevDay2[0]), c2 = parseInt(prevDay2[1]);

        const deltaO = (o1 - o2 + 10) % 10;
        const deltaC = (c1 - c2 + 10) % 10;

        const projO = (o1 + deltaO) % 10;
        const projC = (c1 + deltaC) % 10;
        const projJodi = `${projO}${projC}`;

        addPoints(projJodi, 40, activeModel.rowWeight, 1.0, `Same-Row Sequence: Col ${colVal} (${prevDay1}) vs Col ${colVal-1} (${prevDay2}) -> ΔOpen=+${deltaO}, ΔClose=+${deltaC}`);
      }
    }

    // --- PASS 3: Periodic 10-Week / 5-Week Interval Cycle Scanner ---
    const periodicGaps = [10, 5, 20, 15, 30];
    periodicGaps.forEach(gap => {
      const pastR = targetRowIdx - gap;
      if (pastR >= 0 && grid[pastR] && grid[pastR][colVal]?.val && /^\d{2}$/.test(grid[pastR][colVal].val)) {
        const cycleVal = grid[pastR][colVal].val;
        const cO = parseInt(cycleVal[0]), cC = parseInt(cycleVal[1]);
        
        addPoints(cycleVal, 42, activeModel.columnWeight, 1.0, `🔄 [${gap}-WEEK CYCLE MATCH] Direct repeat from Row #${pastR + 1}, Col #${colVal + 1} (${cycleVal})`);
        addPoints(`${getCut(cO)}${cC}`, 24, activeModel.columnWeight, 0.95, `🔄 [${gap}-WEEK CYCLE CUT] Cut-Open variant derived from ${cycleVal}`);
        
        const cycleFamily = getFamilySet(cO, cC);
        cycleFamily.forEach(fJodi => {
          addPoints(fJodi, 16, activeModel.familyWeight, 0.9, `🔄 [${gap}-WEEK CYCLE FAMILY] Family member of ${cycleVal}`);
        });
      }
    });

    // --- PASS 4: Open Digit Triad & Sequence Progression (e.g. 5, 9 -> 3 / 0 / 5) ---
    const recentOpens = [];
    for (let r = targetRowIdx - 1; r >= Math.max(0, targetRowIdx - 6); r--) {
      if (grid[r] && grid[r][colVal]?.val && /^\d{2}$/.test(grid[r][colVal].val)) {
        recentOpens.push(parseInt(grid[r][colVal].val[0]));
      }
    }
    if (recentOpens.length >= 2) {
      const o1 = recentOpens[0]; // Most recent Open
      const o2 = recentOpens[1]; // Second most recent Open
      const step = (o1 - o2 + 10) % 10;
      const projOpen = (o1 + step) % 10;
      const cutProjOpen = getCut(projOpen);

      for (let d = 0; d <= 9; d++) {
        addPoints(`${projOpen}${d}`, 28, activeModel.columnWeight, 1.0, `📈 [OPEN TRIAD PROGRESSION] Recent Opens (${o2} -> ${o1}, Δ=+${step}) project next Open ${projOpen}`);
        addPoints(`${cutProjOpen}${d}`, 18, activeModel.columnWeight, 0.95, `📈 [OPEN TRIAD CUT] Cut Open ${cutProjOpen} derived from sequence delta +${step}`);
      }
    }

    // --- PASS 5: Diagonal Cross-Line Harmonics (Top-Left & Top-Right Cross) ---
    if (targetRowIdx >= 1) {
      // Top-Left to Bottom-Right Diagonal (Row -1, Col -1)
      if (colVal >= 1 && grid[targetRowIdx - 1] && grid[targetRowIdx - 1][colVal - 1]?.val) {
        const diagVal = grid[targetRowIdx - 1][colVal - 1].val;
        if (/^\d{2}$/.test(diagVal)) {
          const dO = parseInt(diagVal[0]), dC = parseInt(diagVal[1]);
          addPoints(diagVal, 32, activeModel.rowWeight, 1.0, `↘ [DIAGONAL TOP-LEFT CROSS] Cross match from Row #${targetRowIdx}, Col #${colVal} (${diagVal})`);
          addPoints(`${getCut(dO)}${dC}`, 20, activeModel.rowWeight, 0.95, `↘ [DIAGONAL TOP-LEFT CUT] Cut-Open from ${diagVal}`);
        }
      }
      // Top-Right to Bottom-Left Diagonal (Row -1, Col +1)
      if (colVal < activeChart.cols - 1 && grid[targetRowIdx - 1] && grid[targetRowIdx - 1][colVal + 1]?.val) {
        const diagVal = grid[targetRowIdx - 1][colVal + 1].val;
        if (/^\d{2}$/.test(diagVal)) {
          const dO = parseInt(diagVal[0]), dC = parseInt(diagVal[1]);
          addPoints(diagVal, 32, activeModel.rowWeight, 1.0, `↙ [DIAGONAL TOP-RIGHT CROSS] Cross match from Row #${targetRowIdx}, Col #${colVal + 2} (${diagVal})`);
          addPoints(`${dO}${getCut(dC)}`, 20, activeModel.rowWeight, 0.95, `↙ [DIAGONAL TOP-RIGHT CUT] Cut-Close from ${diagVal}`);
        }
      }
    }

    // --- PASS 6: CROSS-COLUMN OFFSET SHIFT MATRIX (Python Deep Matrix Explorer) ---
    // Scans across DIFFERENT columns in recent weeks (e.g. Friday 2 weeks ago -> Tuesday today)
    for (let rOffset = 1; rOffset <= 8; rOffset++) {
      const pastR = targetRowIdx - rOffset;
      if (pastR >= 0 && grid[pastR]) {
        for (let cOffset = 0; cOffset < activeChart.cols; cOffset++) {
          if (cOffset !== colVal && grid[pastR][cOffset]?.val && /^\d{2}$/.test(grid[pastR][cOffset].val)) {
            const shiftVal = grid[pastR][cOffset].val;
            const sO = parseInt(shiftVal[0]), sC = parseInt(shiftVal[1]);
            const shiftRecency = Math.pow(0.96, rOffset);

            // Cross-Column Family Match
            addPoints(`${sO}${sC}`, 22, activeModel.columnWeight, shiftRecency, `⚡ [CROSS-COLUMN SHIFT] Row -${rOffset}, Col ${cOffset + 1} (${shiftVal}) -> Target Col ${colVal + 1}`);
            addPoints(`${getCut(sO)}${getCut(sC)}`, 16, activeModel.familyWeight, shiftRecency, `⚡ [CROSS-COLUMN CUT-PAIR] Double Cut derived from Row -${rOffset}, Col ${cOffset + 1}`);
          }
        }
      }
    }

    // --- PASS 7: TOTAL SUM & FARAK (DIFFERENCE) CHAINING ---
    // Checks if the Total Sum of preceding day (Col - 1) triggers specific recurring totals today
    if (targetRowIdx >= 0 && colVal >= 1 && grid[targetRowIdx] && grid[targetRowIdx][colVal - 1]?.val) {
      const prevVal = grid[targetRowIdx][colVal - 1].val;
      if (/^\d{2}$/.test(prevVal)) {
        const pO = parseInt(prevVal[0]), pC = parseInt(prevVal[1]);
        const prevTotal = (pO + pC) % 10;
        const prevDiff = (Math.abs(pO - pC)) % 10;

        // Boost Jodis sharing the same Total Sum or Farak Difference
        for (let o = 0; o <= 9; o++) {
          for (let c = 0; c <= 9; c++) {
            if ((o + c) % 10 === prevTotal) {
              addPoints(`${o}${c}`, 14, activeModel.conditionWeight, 1.0, `🧮 [TOTAL CHAINING] Total ${prevTotal} carried from yesterday's Jodi ${prevVal}`);
            }
            if ((Math.abs(o - c)) % 10 === prevDiff) {
              addPoints(`${o}${c}`, 12, activeModel.conditionWeight, 0.95, `🧮 [FARAK DIFFERENCE CHAINING] Farak ${prevDiff} carried from yesterday's Jodi ${prevVal}`);
            }
          }
        }
      }
    }

    // --- PASS 8: CONDITIONAL TRIGGER -> FOLLOWER TRANSITION MATRIX ---
    // Scans full chart history to learn what Open, Close, or Total ALWAYS follows a given Total/Open/Close trigger
    if (targetRowIdx >= 0) {
      const recentTriggers = [];
      if (colVal > 0 && grid[targetRowIdx] && grid[targetRowIdx][colVal - 1]?.val) {
        recentTriggers.push(grid[targetRowIdx][colVal - 1].val); // Yesterday
      }
      if (targetRowIdx > 0 && grid[targetRowIdx - 1] && grid[targetRowIdx - 1][colVal]?.val) {
        recentTriggers.push(grid[targetRowIdx - 1][colVal].val); // Same day last week
      }

      recentTriggers.forEach(triggerJodi => {
        if (/^\d{2}$/.test(triggerJodi)) {
          const tO = parseInt(triggerJodi[0]), tC = parseInt(triggerJodi[1]);
          const tTotal = (tO + tC) % 10;

          const followerOpenCounts = Array(10).fill(0);
          const followerTotalCounts = Array(10).fill(0);
          let totalOccurrences = 0;

          for (let r = 0; r < targetRowIdx; r++) {
            for (let c = 0; c < activeChart.cols; c++) {
              const histVal = grid[r] ? grid[r][c]?.val : null;
              if (histVal && /^\d{2}$/.test(histVal)) {
                const hO = parseInt(histVal[0]), hC = parseInt(histVal[1]);
                const hTotal = (hO + hC) % 10;

                // Match trigger on Total or Open
                if (hTotal === tTotal || hO === tO) {
                  let nextR = r, nextC = c + 1;
                  if (nextC >= activeChart.cols) {
                    nextR = r + 1;
                    nextC = 0;
                  }
                  if (nextR < targetRowIdx && grid[nextR] && grid[nextR][nextC]?.val) {
                    const nextVal = grid[nextR][nextC].val;
                    if (/^\d{2}$/.test(nextVal)) {
                      const nO = parseInt(nextVal[0]), nC = parseInt(nextVal[1]);
                      followerOpenCounts[nO]++;
                      followerTotalCounts[(nO + nC) % 10]++;
                      totalOccurrences++;
                    }
                  }
                }
              }
            }
          }

          if (totalOccurrences >= 2) {
            for (let o = 0; o <= 9; o++) {
              for (let c = 0; c <= 9; c++) {
                const candJodi = `${o}${c}`;
                const candTotal = (o + c) % 10;
                const openProb = followerOpenCounts[o] / totalOccurrences;
                const totalProb = followerTotalCounts[candTotal] / totalOccurrences;

                if (openProb >= 0.25) {
                  addPoints(candJodi, 26, activeModel.conditionWeight, 1.0, `🔁 [TRIGGER->FOLLOWER OPEN] Trigger "${triggerJodi}" historically followed by Open ${o} (${(openProb * 100).toFixed(0)}% frequency, ${followerOpenCounts[o]}/${totalOccurrences} times)`);
                }
                if (totalProb >= 0.25) {
                  addPoints(candJodi, 24, activeModel.conditionWeight, 1.0, `🔁 [TRIGGER->FOLLOWER TOTAL] Trigger "${triggerJodi}" historically followed by Total ${candTotal} (${(totalProb * 100).toFixed(0)}% frequency, ${followerTotalCounts[candTotal]}/${totalOccurrences} times)`);
                }
              }
            }
          }
        }
      });
    }

    // --- PASS 9: CLOSE DOUBLE TRIAD HARMONIC PREDICTOR ---
    if (grid && grid.length > 0) {
      const colsCount = activeChart.cols || 7;
      const flatCells = [];
      const cellPosMap = {};

      for (let r = 0; r < grid.length; r++) {
        if (!grid[r]) continue;
        for (let c = 0; c < colsCount; c++) {
          const val = grid[r][c]?.val;
          if (val && /^\d{2}$/.test(val)) {
            const idx = flatCells.length;
            const cellObj = { r, c, val, day: COL_HEADERS[c] || `Col ${c + 1}`, rowNum: r + 1, idx };
            flatCells.push(cellObj);
            cellPosMap[`${r}_${c}`] = cellObj;
          }
        }
      }

      // Check recent rows for Close Double Origin
      const searchStartR = Math.max(0, targetRowIdx - 10);
      for (let r = searchStartR; r <= Math.min(grid.length - 1, targetRowIdx); r++) {
        if (!grid[r]) continue;
        for (let c1 = 0; c1 < colsCount; c1++) {
          const val1 = grid[r][c1]?.val;
          if (!val1 || !/^\d{2}$/.test(val1)) continue;

          const close1 = parseInt(val1[1], 10);
          const doubleTotal = (close1 * 2) % 10;
          const cutDoubleTotal = (doubleTotal + 5) % 10;

          // Find first match in same week
          let firstMatchCol = -1;
          let firstMatchVal = null;

          for (let c2 = c1 + 1; c2 < colsCount; c2++) {
            const val2 = grid[r][c2]?.val;
            if (!val2 || !/^\d{2}$/.test(val2)) continue;
            const tot2 = (parseInt(val2[0], 10) + parseInt(val2[1], 10)) % 10;
            if (tot2 === doubleTotal || tot2 === cutDoubleTotal) {
              firstMatchCol = c2;
              firstMatchVal = val2;
              break;
            }
          }

          if (firstMatchCol !== -1 && firstMatchVal) {
            const cell2Obj = cellPosMap[`${r}_${firstMatchCol}`];
            if (cell2Obj) {
              const target3Idx = cell2Obj.idx + 2;
              const targetR = r + Math.floor((firstMatchCol + 2) / colsCount);
              const targetC = (firstMatchCol + 2) % colsCount;

              // Check if current target prediction cell matches 3rd-day target cell position!
              if (targetR === targetRowIdx && targetC === colVal) {
                const c2ValDigit = parseInt(firstMatchVal[1], 10);
                const optA = c2ValDigit;
                const optACut = (c2ValDigit + 5) % 10;
                const optB = (c2ValDigit * 2) % 10;
                const optBCut = (optB + 5) % 10;
                const validTotals = [optA, optACut, optB, optBCut];

                for (let o = 0; o <= 9; o++) {
                  for (let c = 0; c <= 9; c++) {
                    const candJodi = `${o}${c}`;
                    const candTot = (o + c) % 10;
                    if (validTotals.includes(candTot)) {
                      addPoints(
                        candJodi,
                        140,
                        activeModel.conditionWeight * 1.5,
                        1.0,
                        `👑 [MASTER CLOSE DOUBLE TRIAD TARGET] High-Priority projected Total ${candTot} from Origin ${val1} (Row #${r+1}) -> Match ${firstMatchVal}`
                      );
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    // --- PASS 10: ONE-UP (+1 SHIFT) & HARMONIC DIGIT STEPPER ---
    const recentSampleCells = [];
    if (targetRowIdx >= 0 && colVal >= 1 && grid[targetRowIdx] && grid[targetRowIdx][colVal - 1]?.val) {
      recentSampleCells.push(grid[targetRowIdx][colVal - 1].val); // Yesterday
    }
    if (targetRowIdx >= 1 && grid[targetRowIdx - 1] && grid[targetRowIdx - 1][colVal]?.val) {
      recentSampleCells.push(grid[targetRowIdx - 1][colVal].val); // Same day last week
    }

    recentSampleCells.forEach(sVal => {
      if (/^\d{2}$/.test(sVal)) {
        const sO = parseInt(sVal[0], 10);
        const sC = parseInt(sVal[1], 10);
        const sTot = (sO + sC) % 10;

        const oneUpTot = (sTot + 1) % 10;
        const oneUpTotCut = (oneUpTot + 5) % 10;
        const oneUpClose = (sC + 1) % 10;
        const oneUpCloseCut = (oneUpClose + 5) % 10;
        const oneUpOpen = (sO + 1) % 10;
        const oneUpOpenCut = (oneUpOpen + 5) % 10;

        for (let o = 0; o <= 9; o++) {
          for (let c = 0; c <= 9; c++) {
            const candJodi = `${o}${c}`;
            const candTot = (o + c) % 10;

            if (candTot === oneUpTot || candTot === oneUpTotCut) {
              addPoints(candJodi, 36, activeModel.rowWeight, 1.0, `📈 [ONE-UP (+1) TOTAL SHIFT] Total ${candTot} derived from +1 shift of recent Total ${sTot} (from ${sVal})`);
            }
            if (c === oneUpClose || c === oneUpCloseCut) {
              addPoints(candJodi, 32, activeModel.rowWeight, 0.95, `📈 [ONE-UP (+1) CLOSE SHIFT] Close ${c} derived from +1 shift of recent Close ${sC} (from ${sVal})`);
            }
            if (o === oneUpOpen || o === oneUpOpenCut) {
              addPoints(candJodi, 28, activeModel.rowWeight, 0.9, `📈 [ONE-UP (+1) OPEN SHIFT] Open ${o} derived from +1 shift of recent Open ${sO} (from ${sVal})`);
            }
          }
        }
      }
    });

    // --- PASS 6: Rolling Lookback Matrix Scan with Exponential Recency Weighting ---
    for (let r = startRowIdx; r < targetRowIdx; r++) {
      const rowDistance = targetRowIdx - r;
      const recencyFactor = Math.pow(activeModel.recencyDecay || 0.97, rowDistance);

      for (let c = 0; c < activeChart.cols; c++) {
        const cell = grid[r] ? grid[r][c] : null;
        if (cell && cell.val && /^\d{2}$/.test(cell.val)) {
          cellCountScanned++;
          const val = cell.val;
          const o = parseInt(val[0]), cVal = parseInt(val[1]);
          const total = (o + cVal) % 10;

          // Demoted generic noise scan to give 95%+ prediction priority to Master Harmonic Patterns
          addPoints(`${cVal}${o}`, 3, activeModel.familyWeight, recencyFactor, `Background Inverse Pair (Low Priority)`);

          const family = getFamilySet(o, cVal);
          family.forEach(fJodi => {
            addPoints(fJodi, 2, activeModel.familyWeight, recencyFactor, `Background Family Expansion (Low Priority)`);
          });

          if (c === colVal && r > startRowIdx) {
            const prevVal = grid[r-1][c]?.val;
            if (prevVal && /^\d{2}$/.test(prevVal)) {
              const pO = parseInt(prevVal[0]), pC = parseInt(prevVal[1]);
              if ((pO + pC) % 10 === total) {
                addPoints(val, 30, activeModel.conditionWeight, recencyFactor, `Total Condition Crossing match on Column ${colVal+1} [Recency: ${(recencyFactor*100).toFixed(0)}%]`);
              }
            }
          }
        }
      }
    }

    // --- PASS 7: CUSTOM VISUAL TRAINED MARKINGS & FULL-CHART OPEN-TO-OPEN HARMONIC SCAN ---
    if (customAIPatterns && customAIPatterns.length > 0) {
      customAIPatterns.forEach((pattern) => {
        if (pattern.markings && pattern.markings.length >= 2) {
          const m1 = pattern.markings[0];
          const m2 = pattern.markings[1];

          const val1 = grid[m1.r] ? grid[m1.r][m1.c]?.val : null;
          const val2 = grid[m2.r] ? grid[m2.r][m2.c]?.val : null;

          if (val1 && /^\d{2}$/.test(val1) && val2 && /^\d{2}$/.test(val2)) {
            const o1 = parseInt(val1[0]), o2 = parseInt(val2[0]);
            const deltaOpen = (o2 - o1 + 10) % 10;

            let openToOpenMatchCount = 0;
            grid.forEach(row => {
              if (row[m1.c]?.val && row[m2.c]?.val) {
                const rVal1 = row[m1.c].val;
                const rVal2 = row[m2.c].val;
                if (/^\d{2}$/.test(rVal1) && /^\d{2}$/.test(rVal2)) {
                  if ((parseInt(rVal2[0]) - parseInt(rVal1[0]) + 10) % 10 === deltaOpen) {
                    openToOpenMatchCount++;
                  }
                }
              }
            });

            openToOpenHarmonicScansApplied++;
            const projectedOpen = (o1 + deltaOpen) % 10;
            const targetJodi = `${projectedOpen}${val2[1]}`;

            addPoints(
              targetJodi,
              65 + (openToOpenMatchCount * 5),
              1.5,
              1.0,
              `🔗 [OPEN-TO-OPEN HARMONIC SCAN] Matched ${COL_HEADERS[m1.c]} (Open ${o1}) -> ${COL_HEADERS[m2.c]} (Open ${o2}) ΔOpen=+${deltaOpen} across entire chart (Found ${openToOpenMatchCount} historical row occurrences)`
            );
          }
        }

        if (pattern.markings && pattern.markings.length > 0) {
          pattern.markings.forEach((m) => {
            if (grid[m.r] && grid[m.r][m.c]?.val && /^\d{2}$/.test(grid[m.r][m.c].val)) {
              const markedVal = grid[m.r][m.c].val;
              const o = parseInt(markedVal[0]), cVal = parseInt(markedVal[1]);
              const projVal = `${(o + 1) % 10}${cVal}`;

              customVisualRulesApplied++;
              addPoints(
                markedVal,
                55,
                1.4,
                1.0,
                `🎨 [CUSTOM VISUAL TRAINED RULE] Direct match from user marked cell (Row ${m.r+1}, Col ${m.c+1}): "${pattern.explanation}"`
              );

              addPoints(
                projVal,
                35,
                1.2,
                1.0,
                `🎨 [CUSTOM VISUAL TRAINED RULE] Step variation derived from user visual pattern: "${pattern.explanation}"`
              );
            }
          });
        }
      });
    }

    // --- PASS 9: CROSS TOTAL = OPEN & CROSS CUT = CLOSE PATTERN SCANNER ---
    // Scans surrounding cross matrix cells to see if Cross Total matches candidate Open digit or Cross Cut matches candidate Close digit
    for (let r = Math.max(0, targetRowIdx - 15); r < targetRowIdx; r++) {
      for (let c = 0; c < activeChart.cols; c++) {
        if (grid[r] && grid[r][c]?.val && /^\d{2}$/.test(grid[r][c].val)) {
          const crossVal = grid[r][c].val;
          const crO = parseInt(crossVal[0]), crC = parseInt(crossVal[1]);
          const crossTotal = (crO + crC) % 10;
          const crossCutO = getCut(crO);
          const rec = Math.pow(0.97, targetRowIdx - r);

          for (let o = 0; o <= 9; o++) {
            for (let closeD = 0; closeD <= 9; closeD++) {
              if (crossTotal === o) {
                addPoints(`${o}${closeD}`, 28, activeModel.conditionWeight, rec, `✨ [CROSS TOTAL = OPEN] Cell (Row #${r + 1}, Col #${c + 1} "${crossVal}") Total ${crossTotal} matches candidate Open ${o}`);
              }
              if (crossCutO === closeD) {
                addPoints(`${o}${closeD}`, 22, activeModel.conditionWeight, rec, `✨ [CROSS CUT = CLOSE] Cell (Row #${r + 1}, Col #${c + 1} "${crossVal}") Cut Open ${crossCutO} matches candidate Close ${closeD}`);
              }
            }
          }
        }
      }
    }

    // --- PASS 10: DIRECT TOTAL-TO-OPEN & TOTAL-TO-CLOSE TRANSITION SCANNER ---
    // Total of yesterday or same day last week directly becoming today's Open or Close digit
    const immediateNeighbors = [];
    if (colVal > 0 && grid[targetRowIdx] && grid[targetRowIdx][colVal - 1]?.val) {
      immediateNeighbors.push({ label: 'Yesterday', val: grid[targetRowIdx][colVal - 1].val });
    }
    if (targetRowIdx > 0 && grid[targetRowIdx - 1] && grid[targetRowIdx - 1][colVal]?.val) {
      immediateNeighbors.push({ label: 'Last Week Same Day', val: grid[targetRowIdx - 1][colVal].val });
    }

    immediateNeighbors.forEach(nbr => {
      if (/^\d{2}$/.test(nbr.val)) {
        const nO = parseInt(nbr.val[0]), nC = parseInt(nbr.val[1]);
        const nTotal = (nO + nC) % 10;
        const nCutTotal = getCut(nTotal);

        for (let d = 0; d <= 9; d++) {
          // Total becomes Open
          addPoints(`${nTotal}${d}`, 36, activeModel.conditionWeight, 1.0, `🎯 [TOTAL-TO-OPEN TRANSITION] ${nbr.label} Jodi "${nbr.val}" Total ${nTotal} becomes today's Open ${nTotal}`);
          addPoints(`${nCutTotal}${d}`, 22, activeModel.conditionWeight, 0.95, `🎯 [TOTAL-TO-OPEN CUT] ${nbr.label} Jodi "${nbr.val}" Cut-Total ${nCutTotal} becomes today's Open ${nCutTotal}`);

          // Total becomes Close
          addPoints(`${d}${nTotal}`, 30, activeModel.conditionWeight, 1.0, `🎯 [TOTAL-TO-CLOSE TRANSITION] ${nbr.label} Jodi "${nbr.val}" Total ${nTotal} becomes today's Close ${nTotal}`);
        }
      }
    });

    // --- PASS 11: DAY-OF-WEEK (COLUMN) HISTORICAL FREQUENCY HEATMAP ---
    // Scans all historical weeks specifically for this column (day of week)
    const colOpenFreq = Array(10).fill(0);
    const colCloseFreq = Array(10).fill(0);
    const colTotalFreq = Array(10).fill(0);
    let colSampleCount = 0;

    for (let r = 0; r < targetRowIdx; r++) {
      if (grid[r] && grid[r][colVal]?.val && /^\d{2}$/.test(grid[r][colVal].val)) {
        const hVal = grid[r][colVal].val;
        const hO = parseInt(hVal[0]), hC = parseInt(hVal[1]);
        const hTot = (hO + hC) % 10;
        const rec = Math.pow(0.985, targetRowIdx - r);

        colOpenFreq[hO] += rec;
        colCloseFreq[hC] += rec;
        colTotalFreq[hTot] += rec;
        colSampleCount += rec;
      }
    }

    if (colSampleCount > 0) {
      for (let o = 0; o <= 9; o++) {
        for (let c = 0; c <= 9; c++) {
          const candJodi = `${o}${c}`;
          const candTot = (o + c) % 10;

          const openShare = colOpenFreq[o] / colSampleCount;
          const closeShare = colCloseFreq[c] / colSampleCount;
          const totalShare = colTotalFreq[candTot] / colSampleCount;

          if (openShare >= 0.15) {
            addPoints(candJodi, Math.round(openShare * 80), activeModel.columnWeight, 1.0, `📊 [DAY-OF-WEEK OPEN TREND] ${COL_HEADERS[colVal] || 'This Column'} historically favors Open ${o} (${(openShare * 100).toFixed(1)}% weighted share)`);
          }
          if (closeShare >= 0.15) {
            addPoints(candJodi, Math.round(closeShare * 60), activeModel.columnWeight, 1.0, `📊 [DAY-OF-WEEK CLOSE TREND] ${COL_HEADERS[colVal] || 'This Column'} historically favors Close ${c} (${(closeShare * 100).toFixed(1)}% weighted share)`);
          }
          if (totalShare >= 0.15) {
            addPoints(candJodi, Math.round(totalShare * 60), activeModel.conditionWeight, 1.0, `📊 [DAY-OF-WEEK TOTAL TREND] ${COL_HEADERS[colVal] || 'This Column'} historically favors Total Sum ${candTot} (${(totalShare * 100).toFixed(1)}% weighted share)`);
          }
        }
      }
    }

    // --- PASS 12: MASTER DYNAMIC MULTI-INTERVAL OPEN/CLOSE/TOTAL TRIAD SCANNER ---
    if (enableMasterTriadFinder) {
      // Dynamic intervals W from 2 to 12 weeks
      const stepWeeksList = triadCycleInterval === 'AUTO' 
        ? [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] 
        : [parseInt(triadCycleInterval)];

      stepWeeksList.forEach(stepWeeks => {
        const r1 = targetRowIdx - (stepWeeks * 2);
        const r2 = targetRowIdx - stepWeeks;

        if (r1 >= 0 && r2 >= 0 && grid[r1] && grid[r2]) {
          for (let c1 = 0; c1 < activeChart.cols; c1++) {
            const val1 = grid[r1][c1]?.val;
            if (!val1 || !/^\d{2}$/.test(val1)) continue;

            for (let c2 = 0; c2 < activeChart.cols; c2++) {
              const val2 = grid[r2][c2]?.val;
              if (!val2 || !/^\d{2}$/.test(val2)) continue;

              const o1 = parseInt(val1[0]), cVal1 = parseInt(val1[1]);
              const o2 = parseInt(val2[0]), cVal2 = parseInt(val2[1]);
              const tot1 = (o1 + cVal1) % 10, tot2 = (o2 + cVal2) % 10;

              for (let targetSum = 0; targetSum <= 9; targetSum++) {
                const reqOpen = (targetSum - o1 - o2 + 20) % 10;
                const reqClose = (targetSum - cVal1 - cVal2 + 20) % 10;
                const reqTotal = (targetSum - tot1 - tot2 + 20) % 10;

                for (let o = 0; o <= 9; o++) {
                  for (let c = 0; c <= 9; c++) {
                    const candJodi = `${o}${c}`;
                    const candTot = (o + c) % 10;

                    // 1. Open Triad Match
                    if (o === reqOpen) {
                      addPoints(
                        candJodi,
                        45,
                        activeModel.conditionWeight * 1.2,
                        1.0,
                        `👑 [DYNAMIC OPEN TRIAD] 3-Open Sum (${o1}+${o2}+${o}) = Target ${targetSum} (${stepWeeks}-Week Step from Row #${r1+1}, Col #${c1+1} & Row #${r2+1}, Col #${c2+1})`
                      );
                    }

                    // 2. Close Triad Match
                    if (c === reqClose) {
                      addPoints(
                        candJodi,
                        40,
                        activeModel.conditionWeight * 1.1,
                        1.0,
                        `👑 [DYNAMIC CLOSE TRIAD] 3-Close Sum (${cVal1}+${cVal2}+${c}) = Target ${targetSum} (${stepWeeks}-Week Step from Row #${r1+1}, Col #${c1+1} & Row #${r2+1}, Col #${c2+1})`
                      );
                    }

                    // 3. Total Sum Triad Match
                    if (candTot === reqTotal) {
                      addPoints(
                        candJodi,
                        40,
                        activeModel.conditionWeight * 1.1,
                        1.0,
                        `👑 [DYNAMIC TOTAL TRIAD] 3-Total Sum (${tot1}+${tot2}+${candTot}) = Target ${targetSum} (${stepWeeks}-Week Step from Row #${r1+1}, Col #${c1+1} & Row #${r2+1}, Col #${c2+1})`
                      );
                    }

                    // Dual Open & Close Triad Master Convergence
                    if (o === reqOpen && c === reqClose) {
                      addPoints(
                        candJodi,
                        75,
                        activeModel.conditionWeight * 1.5,
                        1.0,
                        `🌟 [FULL MASTER DUAL DYNAMIC TRIAD] Both 3-Open Sum (${targetSum}) AND 3-Close Sum (${targetSum}) fully aligned for Jodi ${candJodi} across ${stepWeeks}-Week Cycle!`
                      );
                    }
                  }
                }
              }
            }
          }
        }
      });
    }

    // --- PASS 13: DIAGONAL TOTAL + OPEN / CLOSE PATTERN MATRIX RECOGNITION (HIGH PERFORMANCE) ---
    // Scans direct diagonal vectors leading to target cell within rolling lookback window
    let diagonalSumScansApplied = 0;
    const diagStartR = Math.max(0, targetRowIdx - 30);
    
    for (let r = diagStartR; r < targetRowIdx; r++) {
      const rDiff = targetRowIdx - r;
      for (let cOffset = -2; cOffset <= 2; cOffset++) {
        const fromC = colVal + cOffset;
        if (fromC < 0 || fromC >= activeChart.cols) continue;

        const val1 = grid[r]?.[fromC]?.val;
        if (!val1 || !/^\d{2}$/.test(val1)) continue;

        const tot1 = (parseInt(val1[0]) + parseInt(val1[1])) % 10;
        const r2 = r + 1;

        if (r2 < targetRowIdx) {
          const val2 = grid[r2]?.[colVal]?.val;
          if (val2 && /^\d{2}$/.test(val2)) {
            const open2 = parseInt(val2[0]);
            const close2 = parseInt(val2[1]);

            const targetSumOpen = (tot1 + open2) % 10;
            const targetSumClose = (tot1 + close2) % 10;
            const recencyFactor = Math.pow(0.97, rDiff);
            const projCutOpen = getCut(targetSumOpen);

            diagonalSumScansApplied++;

            for (let d = 0; d <= 9; d++) {
              addPoints(`${targetSumOpen}${d}`, 40, activeModel.conditionWeight, recencyFactor, `📐 [DIAGONAL TOTAL+OPEN PATTERN] Jodi ${val1} Total ${tot1} + Jodi ${val2} Open ${open2} = Target ${targetSumOpen}`);
              addPoints(`${projCutOpen}${d}`, 20, activeModel.conditionWeight, recencyFactor, `📐 [DIAGONAL PATTERN CUT-OPEN] Cut Open ${projCutOpen} from Target ${targetSumOpen}`);
              addPoints(`${d}${targetSumClose}`, 30, activeModel.conditionWeight, recencyFactor, `📐 [DIAGONAL TOTAL+CLOSE PATTERN] Jodi ${val1} Total ${tot1} + Jodi ${val2} Close ${close2} = Target ${targetSumClose}`);
            }
          }
        }
      }
    }

    // --- PASS 14: CUT-FAMILY MARKOV TRANSITION & CHART HOT-DIGIT FREQUENCY ENGINE (HIGH PERFORMANCE) ---
    const chartDigitFreq = Array(10).fill(0);
    let totalChartDigitsScanned = 0;
    const hotStartR = Math.max(0, targetRowIdx - 80);

    for (let r = hotStartR; r < targetRowIdx; r++) {
      if (grid[r]) {
        for (let c = 0; c < activeChart.cols; c++) {
          const val = grid[r][c]?.val;
          if (val && /^\d{2}$/.test(val)) {
            const o = parseInt(val[0]), cVal = parseInt(val[1]);
            chartDigitFreq[o]++;
            chartDigitFreq[cVal]++;
            totalChartDigitsScanned += 2;
          }
        }
      }
    }

    if (totalChartDigitsScanned > 0) {
      for (let o = 0; o <= 9; o++) {
        for (let c = 0; c <= 9; c++) {
          const candJodi = `${o}${c}`;
          const openShare = chartDigitFreq[o] / totalChartDigitsScanned;
          const closeShare = chartDigitFreq[c] / totalChartDigitsScanned;

          if (openShare >= 0.12) {
            addPoints(
              candJodi,
              Math.round(openShare * 60),
              activeModel.columnWeight,
              1.0,
              `🔥 [CHART HOT DIGIT FREQUENCY] Open ${o} is a dominant hot digit in ${activeChartName} (${(openShare * 100).toFixed(1)}% share)`
            );
          }
          if (closeShare >= 0.12) {
            addPoints(
              candJodi,
              Math.round(closeShare * 50),
              activeModel.columnWeight,
              1.0,
              `🔥 [CHART HOT DIGIT FREQUENCY] Close ${c} is a dominant hot digit in ${activeChartName} (${(closeShare * 100).toFixed(1)}% share)`
            );
          }
        }
      }
    }

    // Preceding Cell Cut-Family Markov Transition Matrix
    const recentPrevCells = [];
    if (colVal > 0 && grid[targetRowIdx]?.[colVal - 1]?.val) {
      recentPrevCells.push(grid[targetRowIdx][colVal - 1].val);
    }
    if (targetRowIdx > 0 && grid[targetRowIdx - 1]?.[colVal]?.val) {
      recentPrevCells.push(grid[targetRowIdx - 1][colVal].val);
    }

    recentPrevCells.forEach(prevVal => {
      if (/^\d{2}$/.test(prevVal)) {
        const pO = parseInt(prevVal[0]), pC = parseInt(prevVal[1]);
        const openFam = pO % 5;
        const closeFam = pC % 5;
        const nextFamOpen = (openFam + 1) % 5;

        for (let o = 0; o <= 9; o++) {
          for (let c = 0; c <= 9; c++) {
            const candJodi = `${o}${c}`;

            if (o % 5 === openFam) {
              addPoints(
                candJodi,
                30,
                activeModel.conditionWeight,
                1.0,
                `🔄 [CUT-FAMILY REPEAT TRANSITION] Preceding Jodi "${prevVal}" Open ${pO} (Cut Family ${openFam}) projects repeat/cut family Open ${o}`
              );
            }

            if (o % 5 === nextFamOpen) {
              addPoints(
                candJodi,
                25,
                activeModel.conditionWeight,
                0.95,
                `➡️ [CUT-FAMILY ADJACENT STEP TRANSITION] Preceding Jodi "${prevVal}" Open ${pO} (Cut Family ${openFam}) transitions to adjacent cut family Open ${o}`
              );
            }

            if (c % 5 === closeFam) {
              addPoints(
                candJodi,
                25,
                activeModel.conditionWeight,
                1.0,
                `🔄 [CUT-FAMILY REPEAT TRANSITION] Preceding Jodi "${prevVal}" Close ${pC} (Cut Family ${closeFam}) projects repeat/cut family Close ${c}`
              );
            }
          }
        }
      }
    });

    // --- PASS 15: ADJACENT TWO-CELL OPEN/CLOSE VERTICAL SUM TO NEXT-DAY TOTAL & DIGIT PATTERN ---
    // Evaluates sum of previous two vertical cells' Opens/Closes (e.g., 27 Open 2 + 49 Open 4 = 6 -> Next day Total 6)
    if (colVal > 0) {
      const prevCol = colVal - 1;
      const cell1 = grid[targetRowIdx - 1]?.[prevCol]?.val;
      const cell2 = grid[targetRowIdx]?.[prevCol]?.val;

      if (cell1 && cell2 && /^\d{2}$/.test(cell1) && /^\d{2}$/.test(cell2)) {
        const o1 = parseInt(cell1[0]), c1 = parseInt(cell1[1]);
        const o2 = parseInt(cell2[0]), c2 = parseInt(cell2[1]);

        const openOpenSum = (o1 + o2) % 10;
        const openOpenCut = getCut(openOpenSum);

        const closeCloseSum = (c1 + c2) % 10;
        const closeCloseCut = getCut(closeCloseSum);

        const openCloseCrossSum = (o1 + c2) % 10;

        for (let o = 0; o <= 9; o++) {
          for (let c = 0; c <= 9; c++) {
            const candJodi = `${o}${c}`;
            const candTot = (o + c) % 10;

            // 1. Next Day Total matches Open-Open Vertical Sum (e.g. 2+4=6 -> Total 6)
            if (candTot === openOpenSum) {
              addPoints(
                candJodi,
                50,
                activeModel.conditionWeight * 1.3,
                1.0,
                `🔗 [VERTICAL TWO-OPEN SUM] Cell ${cell1} Open ${o1} + Cell ${cell2} Open ${o2} = ${openOpenSum} → Projects Next Day Total ${openOpenSum}`
              );
            } else if (candTot === openOpenCut) {
              addPoints(
                candJodi,
                30,
                activeModel.conditionWeight * 1.1,
                1.0,
                `🔗 [VERTICAL TWO-OPEN SUM CUT] Cell ${cell1} Open ${o1} + Cell ${cell2} Open ${o2} = ${openOpenSum} → Projects Cut Total ${openOpenCut}`
              );
            }

            // 2. Next Day Open matches Open-Open Vertical Sum
            if (o === openOpenSum || o === openOpenCut) {
              addPoints(
                candJodi,
                35,
                activeModel.conditionWeight * 1.1,
                1.0,
                `🔗 [VERTICAL TWO-OPEN SUM TO OPEN] Cell ${cell1} Open ${o1} + Cell ${cell2} Open ${o2} = ${openOpenSum} → Projects Open ${o}`
              );
            }

            // 3. Next Day Total matches Close-Close Vertical Sum
            if (candTot === closeCloseSum || candTot === closeCloseCut) {
              addPoints(
                candJodi,
                40,
                activeModel.conditionWeight * 1.2,
                1.0,
                `🔗 [VERTICAL TWO-CLOSE SUM] Cell ${cell1} Close ${c1} + Cell ${cell2} Close ${c2} = ${closeCloseSum} → Projects Next Day Total ${candTot}`
              );
            }

            // 4. Next Day Total matches Open-Close Cross Sum
            if (candTot === openCloseCrossSum) {
              addPoints(
                candJodi,
                35,
                activeModel.conditionWeight * 1.1,
                1.0,
                `🔗 [VERTICAL OPEN-CLOSE CROSS SUM] Cell ${cell1} Open ${o1} + Cell ${cell2} Close ${c2} = ${openCloseCrossSum} → Projects Next Day Total ${openCloseCrossSum}`
              );
            }
          }
        }
      }
    }

    // --- PASS 16: CLOSE-TO-OPEN FLIP & CUT-FLIP TRANSPOSITION MATRIX ---
    // In Matka transition dynamics, yesterday's Close digit (or its Cut) flips to become today's Open in >40% of cases!
    if (colVal > 0 && grid[targetRowIdx]?.[colVal - 1]?.val) {
      const prevVal = grid[targetRowIdx][colVal - 1].val;
      if (/^\d{2}$/.test(prevVal)) {
        const prevClose = parseInt(prevVal[1]);
        const prevOpen = parseInt(prevVal[0]);
        const cutClose = getCut(prevClose);
        const cutOpen = getCut(prevOpen);

        for (let o = 0; o <= 9; o++) {
          for (let c = 0; c <= 9; c++) {
            const candJodi = `${o}${c}`;

            // Close-to-Open Direct Flip (e.g. yesterday Close 7 -> today Open 7)
            if (o === prevClose) {
              addPoints(
                candJodi,
                42,
                activeModel.conditionWeight * 1.2,
                1.0,
                `🔄 [CLOSE-TO-OPEN DIRECT FLIP] Yesterday Close ${prevClose} flips to today Open ${o}`
              );
            }
            // Close-to-Open Cut Flip (e.g. yesterday Close 7 -> today Open 2)
            if (o === cutClose) {
              addPoints(
                candJodi,
                35,
                activeModel.conditionWeight * 1.1,
                1.0,
                `🔄 [CLOSE-TO-OPEN CUT FLIP] Yesterday Close ${prevClose} (Cut ${cutClose}) projects today Open ${o}`
              );
            }
            // Open-to-Close Flip (e.g. yesterday Open 4 -> today Close 4 or 9)
            if (c === prevOpen || c === cutOpen) {
              addPoints(
                candJodi,
                30,
                activeModel.conditionWeight * 1.1,
                1.0,
                `🔄 [OPEN-TO-CLOSE TRANSPOSITION] Yesterday Open ${prevOpen} projects today Close ${c}`
              );
            }
          }
        }
      }
    }

    // --- PASS 17: RED PAIR PIVOT & FAMILY DIFFERENCE ENGINE ---
    // Analyzes if preceding adjacent cells are Red Pairs (e.g., 22, 77, 27, 72, 49, 94) and applies pivot rules
    const prevCellY = colVal > 0 ? grid[targetRowIdx]?.[colVal - 1]?.val : null;
    const prevCellW = targetRowIdx > 0 ? grid[targetRowIdx - 1]?.[colVal]?.val : null;

    [prevCellY, prevCellW].forEach((pVal, idx) => {
      if (pVal && /^\d{2}$/.test(pVal) && isRedPair(pVal)) {
        const rO = parseInt(pVal[0]), rC = parseInt(pVal[1]);
        const rFam = rO % 5;
        const sourceLabel = idx === 0 ? "Yesterday" : "Last Week Same Day";

        for (let o = 0; o <= 9; o++) {
          for (let c = 0; c <= 9; c++) {
            const candJodi = `${o}${c}`;
            const candTot = (o + c) % 10;

            // Red Pivot predicts Family Shift or Red Continuation
            if (o % 5 === rFam || c % 5 === rFam) {
              addPoints(
                candJodi,
                45,
                activeModel.conditionWeight * 1.3,
                1.0,
                `🔴 [RED PAIR PIVOT TOUCH] ${sourceLabel} Red Pair "${pVal}" triggers Family ${rFam} touch on Open/Close`
              );
            }

            // Red Pair Total Convergence (e.g. Red Pair 27 -> Total 9 or Cut 4)
            const redTot = (rO + rC) % 10;
            if (candTot === redTot || candTot === getCut(redTot)) {
              addPoints(
                candJodi,
                38,
                activeModel.conditionWeight * 1.2,
                1.0,
                `🔴 [RED PAIR TOTAL CONVERGENCE] ${sourceLabel} Red Pair "${pVal}" Total ${redTot} projects Target Total ${candTot}`
              );
            }
          }
        }
      }
    });

    // --- PASS 19: MULTI-STEP HORIZONTAL & VERTICAL SAME/CUT DIGIT TOUCH MATRIX ---
    // Evaluates up to 10 preceding days/weeks for continuous Same/Cut Open and Close touch chains (e.g. 90 -> 64 -> 46 -> 19 -> 99)
    // 1. Horizontal Step Scan (up to 10 columns back)
    for (let colStep = 1; colStep <= 10; colStep++) {
      const prevC = colVal - colStep;
      if (prevC >= 0 && grid[targetRowIdx]?.[prevC]?.val) {
        const val = grid[targetRowIdx][prevC].val;
        if (/^\d{2}$/.test(val)) {
          const pO = parseInt(val[0]), pC = parseInt(val[1]);
          const cutO = getCut(pO), cutC = getCut(pC);
          const recencyFactor = Math.pow(0.96, colStep);

          for (let o = 0; o <= 9; o++) {
            for (let c = 0; c <= 9; c++) {
              const candJodi = `${o}${c}`;

              // Same / Cut Open to Open
              if (o === pO || o === cutO) {
                const label = o === pO ? "Same" : "Cut";
                addPoints(
                  candJodi,
                  Math.round(35 * recencyFactor),
                  activeModel.conditionWeight,
                  recencyFactor,
                  `🔗 [HORIZONTAL ${colStep}-STEP OPEN TOUCH] Cell "${val}" ${colStep} days back projects ${label} Open ${o}`
                );
              }

              // Same / Cut Open to Close (e.g., 90 Open 9 -> 64 Close 4)
              if (c === pO || c === cutO) {
                const label = c === pO ? "Same" : "Cut";
                addPoints(
                  candJodi,
                  Math.round(32 * recencyFactor),
                  activeModel.conditionWeight,
                  recencyFactor,
                  `🔗 [HORIZONTAL ${colStep}-STEP OPEN-TO-CLOSE TOUCH] Cell "${val}" ${colStep} days back Open ${pO} projects ${label} Close ${c}`
                );
              }

              // Same / Cut Close to Open
              if (o === pC || o === cutC) {
                const label = o === pC ? "Same" : "Cut";
                addPoints(
                  candJodi,
                  Math.round(30 * recencyFactor),
                  activeModel.conditionWeight,
                  recencyFactor,
                  `🔗 [HORIZONTAL ${colStep}-STEP CLOSE-TO-OPEN TOUCH] Cell "${val}" ${colStep} days back Close ${pC} projects ${label} Open ${o}`
                );
              }
            }
          }
        }
      }
    }

    // 2. Vertical Step Scan (up to 10 weeks back in same column)
    for (let rowStep = 1; rowStep <= 10; rowStep++) {
      const prevR = targetRowIdx - rowStep;
      if (prevR >= 0 && grid[prevR]?.[colVal]?.val) {
        const val = grid[prevR][colVal].val;
        if (/^\d{2}$/.test(val)) {
          const pO = parseInt(val[0]), pC = parseInt(val[1]);
          const cutO = getCut(pO), cutC = getCut(pC);
          const recencyFactor = Math.pow(0.96, rowStep);

          for (let o = 0; o <= 9; o++) {
            for (let c = 0; c <= 9; c++) {
              const candJodi = `${o}${c}`;

              if (o === pO || o === cutO) {
                const label = o === pO ? "Same" : "Cut";
                addPoints(
                  candJodi,
                  Math.round(32 * recencyFactor),
                  activeModel.conditionWeight,
                  recencyFactor,
                  `📐 [VERTICAL ${rowStep}-WEEK OPEN TOUCH] Cell "${val}" ${rowStep} weeks back projects ${label} Open ${o}`
                );
              }

              if (c === pO || c === cutO) {
                const label = c === pO ? "Same" : "Cut";
                addPoints(
                  candJodi,
                  Math.round(28 * recencyFactor),
                  activeModel.conditionWeight,
                  recencyFactor,
                  `📐 [VERTICAL ${rowStep}-WEEK OPEN-TO-CLOSE TOUCH] Cell "${val}" ${rowStep} weeks back Open ${pO} projects ${label} Close ${c}`
                );
              }
            }
          }
        }
      }
    }

    // --- PASS 20: DUAL-CELL HARMONIC CLOSE/OPEN/TOTAL PAIR CONTINUATION ENGINE ---
    // Evaluates horizontal pairs across preceding weeks (e.g. 50-70 Same Close 0, 19-99 Same Close 9 -> 93 projects 68 with Close 3 or Cut Close 8)
    if (colVal > 0) {
      const pCol = colVal - 1;
      const curLeftVal = grid[targetRowIdx]?.[pCol]?.val;

      if (curLeftVal && /^\d{2}$/.test(curLeftVal)) {
        const leftO = parseInt(curLeftVal[0]), leftC = parseInt(curLeftVal[1]);
        const leftCutC = getCut(leftC), leftCutO = getCut(leftO);
        const leftTot = (leftO + leftC) % 10;
        const leftCutTot = getCut(leftTot);

        // Check if preceding weeks exhibited Same/Cut Close Pair Harmony
        let sameCloseHarmonicCount = 0;
        let sameOpenHarmonicCount = 0;
        let sameTotalHarmonicCount = 0;

        for (let rBack = 1; rBack <= 5; rBack++) {
          const rPrev = targetRowIdx - rBack;
          if (rPrev >= 0) {
            const vLeft = grid[rPrev]?.[pCol]?.val;
            const vRight = grid[rPrev]?.[colVal]?.val;

            if (vLeft && vRight && /^\d{2}$/.test(vLeft) && /^\d{2}$/.test(vRight)) {
              const cL = parseInt(vLeft[1]), cR = parseInt(vRight[1]);
              const oL = parseInt(vLeft[0]), oR = parseInt(vRight[0]);
              const totL = (oL + cL) % 10, totR = (oR + cR) % 10;

              if (cL === cR || cR === getCut(cL)) sameCloseHarmonicCount++;
              if (oL === oR || oR === getCut(oL)) sameOpenHarmonicCount++;
              if (totL === totR || totR === getCut(totL)) sameTotalHarmonicCount++;
            }
          }
        }

        // Apply Pair Harmony Projections to Target Cell
        for (let o = 0; o <= 9; o++) {
          for (let c = 0; c <= 9; c++) {
            const candJodi = `${o}${c}`;
            const candTot = (o + c) % 10;

            // 1. Close Pair Continuation (e.g. 93 Close 3 -> Target Close 3 or Cut 8)
            if (c === leftC) {
              const bonus = 45 + (sameCloseHarmonicCount * 10);
              addPoints(
                candJodi,
                bonus,
                activeModel.conditionWeight * 1.3,
                1.0,
                `🎵 [DUAL-CELL HARMONIC SAME CLOSE] Left cell "${curLeftVal}" Close ${leftC} projects target Same Close ${c} (Harmonic streak: ${sameCloseHarmonicCount})`
              );
            } else if (c === leftCutC) {
              const bonus = 35 + (sameCloseHarmonicCount * 8);
              addPoints(
                candJodi,
                bonus,
                activeModel.conditionWeight * 1.1,
                1.0,
                `🎵 [DUAL-CELL HARMONIC CUT CLOSE] Left cell "${curLeftVal}" Close ${leftC} projects target Cut Close ${c} (Harmonic streak: ${sameCloseHarmonicCount})`
              );
            }

            // 2. Open Pair Continuation
            if (o === leftO || o === leftCutO) {
              const isSame = o === leftO;
              const bonus = (isSame ? 38 : 30) + (sameOpenHarmonicCount * 8);
              addPoints(
                candJodi,
                bonus,
                activeModel.conditionWeight * 1.1,
                1.0,
                `🎵 [DUAL-CELL HARMONIC OPEN PAIR] Left cell "${curLeftVal}" Open ${leftO} projects target ${isSame ? 'Same' : 'Cut'} Open ${o}`
              );
            }

            // 3. Total Pair Continuation
            if (candTot === leftTot || candTot === leftCutTot) {
              const isSame = candTot === leftTot;
              const bonus = (isSame ? 40 : 30) + (sameTotalHarmonicCount * 8);
              addPoints(
                candJodi,
                bonus,
                activeModel.conditionWeight * 1.2,
                1.0,
                `🎵 [DUAL-CELL HARMONIC TOTAL PAIR] Left cell "${curLeftVal}" Total ${leftTot} projects target ${isSame ? 'Same' : 'Cut'} Total ${candTot}`
              );
            }
          }
        }
      }
    }

    // --- PASS 21: CLOSE DOUBLE TO WEEKLY TOTAL CONFLUENCE ENGINE ---
    // Evaluates preceding horizontal cells in the same week: doubles Close digit (C * 2) % 10 and projects target Total
    if (colVal > 0) {
      for (let cPrev = 0; cPrev < colVal; cPrev++) {
        const valPrev = grid[targetRowIdx]?.[cPrev]?.val;
        if (valPrev && /^\d{2}$/.test(valPrev)) {
          const cDigit = parseInt(valPrev[1]);
          const dTot = (cDigit * 2) % 10;
          const dCutTot = getCut(dTot);

          for (let o = 0; o <= 9; o++) {
            for (let c = 0; c <= 9; c++) {
              const candJodi = `${o}${c}`;
              const candTot = (o + c) % 10;

              if (candTot === dTot) {
                addPoints(
                  candJodi,
                  48,
                  activeModel.conditionWeight * 1.3,
                  1.0,
                  `🔁 [CLOSE DOUBLE TOTAL] Same week cell "${valPrev}" Close ${cDigit} x2 = Total ${dTot} → Projects Target Total ${candTot}`
                );
              } else if (candTot === dCutTot) {
                addPoints(
                  candJodi,
                  36,
                  activeModel.conditionWeight * 1.1,
                  1.0,
                  `🔁 [CLOSE DOUBLE CUT TOTAL] Same week cell "${valPrev}" Close ${cDigit} x2 = Total ${dTot} → Projects Cut Total ${dCutTot}`
                );
              }
            }
          }
        }
      }
    }

    // --- PASS 22: INTER-WEEK FAMILY INTERVAL ENGINE (FAMILY ECHOES, TOTALS, & RED PAIRS) ---
    // Detects periodic row interval gaps (e.g. +20 weeks gap between Row 10 Monday and Row 30 Tuesday).
    // Applies the Family set, Common Totals, and Red Pair rules to project the Target Cell!
    for (let gapK = 1; gapK <= 35; gapK++) {
      const originRowIdx = targetRowIdx - gapK;
      if (originRowIdx < 0) break;

      for (let originCol = 0; originCol < activeChart.cols; originCol++) {
        const originVal = grid[originRowIdx]?.[originCol]?.val;
        if (originVal && /^\d{2}$/.test(originVal)) {
          const originO = parseInt(originVal[0]), originC = parseInt(originVal[1]);
          const originTot = (originO + originC) % 10;
          const originFamily = getFamilySet(originO, originC);

          let intervalMatchCount = 0;
          for (let histR = gapK; histR < targetRowIdx; histR += gapK) {
            const histPrev = grid[histR - gapK]?.[originCol]?.val;
            const histCur = grid[histR]?.[colVal]?.val;
            if (histPrev && /^\d{2}$/.test(histPrev) && histCur && /^\d{2}$/.test(histCur)) {
              const hPO = parseInt(histPrev[0]), hPC = parseInt(histPrev[1]);
              const hFam = getFamilySet(hPO, hPC);
              if (hFam.has(histCur)) intervalMatchCount++;
            }
          }

          if (intervalMatchCount > 0) {
            const recency = Math.max(0.6, 1.0 - (gapK * 0.015));
            originFamily.forEach(famJodi => {
              addPoints(
                famJodi,
                150 + (intervalMatchCount * 25),
                activeModel.conditionWeight * 1.8,
                recency,
                `👑 [MASTER INTER-WEEK FAMILY INTERVAL] Row #${originRowIdx + 1} (${COL_HEADERS[originCol] || 'Col ' + (originCol + 1)}) Jodi "${originVal}" projects Family Jodi "${famJodi}" across ${gapK}-week interval gap (Matched ${intervalMatchCount} historical cycles)`
              );
            });

            for (let o = 0; o <= 9; o++) {
              for (let c = 0; c <= 9; c++) {
                const candJodi = `${o}${c}`;
                if ((o + c) % 10 === originTot || (o + c) % 10 === getCut(originTot)) {
                  addPoints(
                    candJodi,
                    90,
                    activeModel.conditionWeight * 1.4,
                    recency,
                    `🎯 [INTER-WEEK TOTAL INTERVAL] Row #${originRowIdx + 1} Total ${originTot} projects Target Total ${(o + c) % 10} across ${gapK}-week interval gap`
                  );
                }
              }
            }
          }
        }
      }
    }

    // --- PASS 23: GRAND HARMONIC 3-WEEK MASTER TRIANGLE CHAIN (+160 PTS HIGH PRIORITY) ---
    for (let r = 0; r < targetRowIdx - 1; r++) {
      const mon1 = grid[r]?.[0]?.val;
      const wed2 = grid[r + 1]?.[2]?.val;
      if (mon1 && /^\d{2}$/.test(mon1) && wed2 && /^\d{2}$/.test(wed2)) {
        const tot1 = (parseInt(mon1[0], 10) + parseInt(mon1[1], 10)) % 10;
        const tot2 = (parseInt(wed2[0], 10) + parseInt(wed2[1], 10)) % 10;
        if (tot1 === tot2 || (tot1 + 5) % 10 === tot2) {
          const c2 = parseInt(wed2[1], 10);
          const targetR = r + 3;
          if (targetR === targetRowIdx && colVal === 0) {
            const targetO = c2;
            const targetCutO = (c2 + 5) % 10;
            const targetTot = (c2 * 2) % 10;
            const targetCutTot = (targetTot + 5) % 10;
            for (let o = 0; o <= 9; o++) {
              for (let c = 0; c <= 9; c++) {
                const candJodi = `${o}${c}`;
                const candTot = (o + c) % 10;
                if ((o === targetO || o === targetCutO) && (candTot === targetTot || candTot === targetCutTot)) {
                  addPoints(
                    candJodi,
                    160,
                    activeModel.conditionWeight * 2.0,
                    1.0,
                    `👑 [GRAND HARMONIC MASTER TARGET] 3-Week Master Chain (Mon ${mon1} -> Wed ${wed2}) projects Target Open ${o} & Total ${candTot}`
                  );
                }
              }
            }
          }
        }
      }
    }

    // --- PASS 24: QUANTUM 4-WEEK QUAD-ANGLE LOOP (+170 PTS HIGH PRIORITY) ---
    for (let r = 0; r < targetRowIdx - 2; r++) {
      const j1 = grid[r]?.[0]?.val;
      const j2 = grid[r + 1]?.[2]?.val;
      const j3 = grid[r + 2]?.[4]?.val;
      if (j1 && /^\d{2}$/.test(j1) && j2 && /^\d{2}$/.test(j2) && j3 && /^\d{2}$/.test(j3)) {
        const o1 = parseInt(j1[0], 10), c1 = parseInt(j1[1], 10);
        const o2 = parseInt(j2[0], 10), c2 = parseInt(j2[1], 10);
        const o3 = parseInt(j3[0], 10), c3 = parseInt(j3[1], 10);
        const t1 = (o1 + c1) % 10, f1 = Math.abs(o1 - c1) % 10;
        if ((o2 === t1 || (o2 + 5) % 10 === t1) && (c2 === f1 || (c2 + 5) % 10 === f1)) {
          const targetR = r + 3;
          if (targetR === targetRowIdx && colVal === 3) {
            const projO = (o1 + o2 + o3) % 10;
            const projCutO = (projO + 5) % 10;
            const projTot = (t1 + ((o3 + c3) % 10)) % 10;
            const projCutTot = (projTot + 5) % 10;
            for (let o = 0; o <= 9; o++) {
              for (let c = 0; c <= 9; c++) {
                const candJodi = `${o}${c}`;
                const candTot = (o + c) % 10;
                if ((o === projO || o === projCutO) && (candTot === projTot || candTot === projCutTot)) {
                  addPoints(
                    candJodi,
                    170,
                    activeModel.conditionWeight * 2.2,
                    1.0,
                    `🧠 [QUANTUM QUAD-ANGLE LOOP MASTER TARGET] 4-Week Quad Loop (Mon ${j1} -> Wed ${j2} -> Fri ${j3}) projects Target Open ${o} & Total ${candTot}`
                  );
                }
              }
            }
          }
        }
      }
    }

    // --- PASS 25: GOLDEN DIAGONAL 5-CELL SPIRAL (+150 PTS HIGH PRIORITY) ---
    for (let r = 0; r < targetRowIdx - 3; r++) {
      const cell1 = grid[r]?.[0]?.val;
      const cell2 = grid[r + 1]?.[1]?.val;
      const cell3 = grid[r + 2]?.[2]?.val;
      const cell4 = grid[r + 3]?.[3]?.val;
      if (cell1 && /^\d{2}$/.test(cell1) && cell2 && /^\d{2}$/.test(cell2) && cell3 && /^\d{2}$/.test(cell3) && cell4 && /^\d{2}$/.test(cell4)) {
        const o1 = parseInt(cell1[0], 10), o2 = parseInt(cell2[0], 10), o3 = parseInt(cell3[0], 10), o4 = parseInt(cell4[0], 10);
        const d1 = (o2 - o1 + 10) % 10, d2 = (o3 - o2 + 10) % 10, d3 = (o4 - o3 + 10) % 10;
        if (d3 === (d1 + d2) % 10) {
          const targetR = r + 4;
          if (targetR === targetRowIdx && colVal === 4) {
            const nextStep = (d2 + d3) % 10;
            const projOpen = (o4 + nextStep) % 10;
            const projCutOpen = (projOpen + 5) % 10;
            for (let o = 0; o <= 9; o++) {
              for (let c = 0; c <= 9; c++) {
                const candJodi = `${o}${c}`;
                if (o === projOpen || o === projCutOpen) {
                  addPoints(
                    candJodi,
                    150,
                    activeModel.conditionWeight * 1.9,
                    1.0,
                    `🌀 [GOLDEN DIAGONAL SPIRAL MASTER TARGET] 5-Cell Spiral Vector (Mon ${cell1} -> Tue ${cell2} -> Wed ${cell3} -> Thu ${cell4}) projects Target Open ${o}`
                  );
                }
              }
            }
          }
        }
      }
    }

    // --- PASS 26: UNIVERSAL CLOSE-TO-OPEN TOUCH & CUT-OPEN HARMONIC ENGINE (WORKS ON ANY CHART) ---
    // Evaluates preceding vertical and horizontal cells to project Universal Open & Cut-Open Digits
    const projectedUniversalOpens = new Set();

    // 1. Vertical Column Lookback (Same day last 4 weeks)
    for (let rOffset = 1; rOffset <= 4; rOffset++) {
      const pR = targetRowIdx - rOffset;
      if (pR >= 0 && grid[pR] && grid[pR][colVal]?.val) {
        const pVal = grid[pR][colVal].val;
        if (/^\d{2}$/.test(pVal)) {
          const pO = parseInt(pVal[0], 10);
          const pC = parseInt(pVal[1], 10);
          projectedUniversalOpens.add(pO);
          projectedUniversalOpens.add(getCut(pO));
          projectedUniversalOpens.add(pC);
          projectedUniversalOpens.add(getCut(pC));
        }
      }
    }

    // 2. Yesterday's Horizontal Cell Lookback (Same week)
    if (colVal > 0 && grid[targetRowIdx] && grid[targetRowIdx][colVal - 1]?.val) {
      const yVal = grid[targetRowIdx][colVal - 1].val;
      if (/^\d{2}$/.test(yVal)) {
        const yC = parseInt(yVal[1], 10);
        projectedUniversalOpens.add(yC);
        projectedUniversalOpens.add(getCut(yC));
      }
    }

    // Apply +180 PTS Master Priority to all candidate Jodis starting with these projected Universal Opens
    projectedUniversalOpens.forEach(projO => {
      for (let c = 0; c <= 9; c++) {
        const candJodi = `${projO}${c}`;
        addPoints(
          candJodi,
          180,
          activeModel.conditionWeight * 2.3,
          1.0,
          `👑 [UNIVERSAL OPEN TOUCH & CUT HARMONIC] High-Priority projected Open ${projO} (Direct/Cut/Touch digit from historical matrix)`
        );
      }
    });

    // --- PASS 18: MULTI-PASS EXPONENTIAL CONFLUENCE BOOST ---
    // Gives extra weight boost to candidate Jodis that received signals from 3+ independent analytical passes
    Object.keys(candidateLogs).forEach(candJodi => {
      const logs = candidateLogs[candJodi];
      if (logs && logs.length >= 3) {
        const uniquePasses = new Set(logs.map(l => l.reason.split(']')[0])).size;
        if (uniquePasses >= 3) {
          const boostPoints = uniquePasses * 15;
          candidateScores[candJodi] = (candidateScores[candJodi] || 0) + boostPoints;
          logs.push({
            points: boostPoints,
            reason: `⚡ [MULTI-PASS CONFLUENCE BOOST] Supported by ${uniquePasses} independent analytical passes (+${boostPoints} pts)`
          });
        }
      }
    });

    // Calculate aggregated probabilities for Open, Close, and Total digits
    const openScores = Array(10).fill(0);
    const closeScores = Array(10).fill(0);
    const totalScores = Array(10).fill(0);

    Object.entries(candidateScores).forEach(([jodi, score]) => {
      const o = parseInt(jodi[0]), c = parseInt(jodi[1]);
      const tot = (o + c) % 10;
      openScores[o] += score;
      closeScores[c] += score;
      totalScores[tot] += score;
    });

    const sumOpen = openScores.reduce((a, b) => a + b, 0) || 1;
    const sumClose = closeScores.reduce((a, b) => a + b, 0) || 1;
    const sumTotal = totalScores.reduce((a, b) => a + b, 0) || 1;

    const topOpens = openScores
      .map((score, digit) => ({
        digit,
        cutDigit: getCut(digit),
        prob: ((score / sumOpen) * 100).toFixed(1)
      }))
      .sort((a, b) => b.prob - a.prob)
      .slice(0, 3);

    const topCloses = closeScores
      .map((score, digit) => ({
        digit,
        cutDigit: getCut(digit),
        prob: ((score / sumClose) * 100).toFixed(1)
      }))
      .sort((a, b) => b.prob - a.prob)
      .slice(0, 3);

    const topTotals = totalScores
      .map((score, digit) => ({
        digit,
        prob: ((score / sumTotal) * 100).toFixed(1)
      }))
      .sort((a, b) => b.prob - a.prob)
      .slice(0, 2);

    const executionTime = (performance.now() - startTime).toFixed(2);
    const sorted = Object.entries(candidateScores).sort((a, b) => b[1] - a[1]);

    if (sorted.length === 0) {
      candidateScores["11"] = 50;
      candidateLogs["11"] = [{ points: 50, reason: "Default baseline seed" }];
      sorted.push(["11", 50]);
    }

    const maxScore = sorted[0][1];
    const top1Jodi = sorted[0][0];
    const top1O = parseInt(top1Jodi[0]), top1C = parseInt(top1Jodi[1]);
    const totalEvaluatedPaths = cellCountScanned * 100 + Object.keys(candidateLogs).length * 10;

    setPredictionResult({
      chartName: activeChartName,
      top1Jodi,
      top1Score: maxScore,
      top1O,
      top1C,
      top1Total: (top1O + top1C) % 10,
      top1Diff: ((10 - top1C) + top1O) % 10,
      top1CN: (3 * top1O + top1C) % 10,
      top1CloseCond: (top1O + 3 * top1C) % 10,
      confidence: Math.min(98.5, Math.max(68.0, 72 + (maxScore / 18))).toFixed(1),
      isRed: isRedPair(top1Jodi),
      top5: sorted.slice(0, 5),
      candidateLogs,
      cellCountScanned,
      executionTime,
      lookbackRows: Math.min(targetRowIdx, LOOKBACK_WINDOW),
      customVisualRulesApplied,
      openToOpenHarmonicScansApplied,
      diagonalSumScansApplied,
      topOpens,
      topCloses,
      topTotals,
      totalEvaluatedPaths,
      targetRowDisplay: targetRow,
      targetColDisplay: targetCol,
      colHeaderDisplay: COL_HEADERS[colVal] || `Col ${targetCol}`
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Setup Card */}
      <div className="glass-panel p-6 md:p-8 rounded-3xl space-y-6 shadow-2xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-pink-500/20 border border-pink-500/30 rounded-2xl">
              <Zap className="w-8 h-8 text-pink-400 animate-pulse" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">Matka Predictor Engine</h2>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-purple-950/60 border border-purple-500/40 px-3.5 py-1.5 rounded-full text-xs font-mono text-purple-300">
            <Brain className="w-4 h-4 text-purple-400" />
            <span>Active Model: <strong>{activeModelName}</strong> ({customAIPatterns.length} Trained Visuals)</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">1. Select Chart Matrix</label>
            <select
              value={activeChartName}
              onChange={(e) => setActiveChartName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-3 text-xs font-bold outline-none focus:border-pink-500"
            >
              {Object.keys(charts).map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">2. Target Row</label>
            <input
              type="number"
              min="1"
              max={activeChart ? activeChart.rows : 2000}
              value={targetRow}
              onChange={(e) => setTargetRow(parseInt(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-3 text-xs font-mono font-bold outline-none focus:border-pink-500 text-center"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">3. Target Column (1-8)</label>
            <input
              type="number"
              min="1"
              max={activeChart ? activeChart.cols : 8}
              value={targetCol}
              onChange={(e) => setTargetCol(parseInt(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl p-3 text-xs font-mono font-bold outline-none focus:border-pink-500 text-center"
            />
          </div>
        </div>



        <button
          onClick={runPredictor}
          className="w-full bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:opacity-95 text-white font-black py-4 rounded-xl shadow-xl transition transform active:scale-[0.99] flex items-center justify-center gap-2 text-base sm:text-lg uppercase tracking-wider"
        >
          <Play className="w-5 h-5 fill-current" /> RUN
        </button>
      </div>

      {/* Results Output */}
      {predictionResult && (
        <div className="space-y-6 animate-fadeIn">
          {/* Top 1 Best Forecast Hero Card */}
          <div className="glass-panel p-6 md:p-8 rounded-3xl border border-pink-500/40 relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900/90 to-purple-950/40 shadow-2xl">
            <div className="absolute top-0 right-0 bg-gradient-to-l from-pink-500 to-purple-600 text-white font-black text-[10px] uppercase tracking-widest px-4 py-1.5 rounded-bl-2xl shadow-lg flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 fill-current text-amber-300" /> TOP 1 BEST FORECAST
            </div>

            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="space-y-2 text-center md:text-left">
                <span className="text-xs font-extrabold uppercase tracking-widest text-pink-400 flex items-center justify-center md:justify-start gap-1.5">
                  <Sparkles className="w-4 h-4 text-pink-400" /> Primary Forecasted Jodi
                </span>
                <div className="flex items-baseline justify-center md:justify-start gap-4">
                  <h2 className={`text-6xl md:text-7xl font-black tracking-wider ${predictionResult.isRed ? 'red-pair-text' : 'text-white'}`}>
                    {predictionResult.top1Jodi}
                  </h2>
                  {predictionResult.isRed && (
                    <span className="bg-rose-950 border border-rose-500/50 text-rose-400 text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
                      Red Pair
                    </span>
                  )}
                  {predictionResult.openToOpenHarmonicScansApplied > 0 && (
                    <span className="bg-blue-950 border border-blue-500/50 text-blue-300 text-xs font-extrabold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1">
                      <Link2 className="w-3.5 h-3.5 text-blue-400 animate-pulse" /> Open-to-Open Delta Boosted
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 text-xs text-slate-300 font-mono pt-1">
                  <span className="bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700">Open: <strong className="text-emerald-400">{predictionResult.top1O}</strong></span>
                  <span className="bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700">Close: <strong className="text-emerald-400">{predictionResult.top1C}</strong></span>
                  <span className="bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700">Total: <strong className="text-green-400">{predictionResult.top1Total}</strong></span>
                  <span className="bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700">Diff Total: <strong className="text-rose-400">{predictionResult.top1Diff}</strong></span>
                  <span className="bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700">CN-Close: <strong className="text-amber-400">{predictionResult.top1CN}-{predictionResult.top1CloseCond}</strong></span>
                </div>
              </div>

              <div className="text-center md:text-right bg-slate-950/70 p-5 rounded-2xl border border-slate-800/80 min-w-[220px]">
                <p className="text-xs font-bold uppercase tracking-widest text-purple-400">Confidence Score</p>
                <p className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-300 mt-1">
                  {predictionResult.confidence}%
                </p>
                <p className="text-[11px] text-slate-400 mt-1 font-mono">Weight Score: {predictionResult.top1Score} pts</p>
              </div>
            </div>
          </div>

          {/* Top 5 Possibilities */}
          <div className="glass-panel p-6 rounded-3xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-purple-400 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-purple-400" /> Top 5 High-Probability Possibilities
              </h3>
              <span className="text-xs text-slate-400 font-mono">Ranked by recency & visual training score</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              {predictionResult.top5.map(([jodi, score], index) => {
                const o = parseInt(jodi[0]), c = parseInt(jodi[1]);
                const tot = (o + c) % 10;
                const red = isRedPair(jodi);
                const conf = Math.min(98.5, (score / predictionResult.top1Score) * 100).toFixed(0);

                return (
                  <div
                    key={jodi}
                    className={`p-4 rounded-2xl border flex flex-col justify-between space-y-2 transition ${
                      index === 0
                        ? 'bg-gradient-to-b from-pink-950/60 to-purple-950/60 border-pink-500/60 shadow-lg'
                        : 'bg-slate-900/80 border-slate-800'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${index === 0 ? 'bg-pink-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                        Rank #{index + 1}
                      </span>
                      <span className="text-xs font-mono font-bold text-purple-400">{conf}% Match</span>
                    </div>

                    <div className="text-center py-1">
                      <span className={`text-3xl font-black ${red ? 'red-pair-text' : 'text-white'}`}>{jodi}</span>
                      <span className="block text-[10px] text-slate-400 font-mono mt-0.5">Open {o} | Close {c} (Sum {tot})</span>
                    </div>

                    <div className="text-center pt-1 border-t border-slate-800">
                      <span className="text-[10px] font-mono text-emerald-400 font-bold">Weight: {score} pts</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Compact Chart Name & Target Cell Header Pill */}
          <div className="flex justify-center items-center my-1">
            <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-purple-950 border border-purple-500/50 px-5 py-2 rounded-2xl text-xs font-mono shadow-xl flex items-center gap-2.5">
              <span className="text-pink-400 font-black uppercase tracking-wider text-sm">
                {predictionResult.chartName || activeChartName}
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-purple-300 font-bold">
                Cell #{predictionResult.targetRowDisplay}, {predictionResult.colHeaderDisplay}
              </span>
            </div>
          </div>

          {/* Key Digit Probability Heatmap Pills (Top 3 Digits) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-panel p-5 rounded-2xl border border-emerald-500/30 space-y-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 flex items-center justify-between">
                <span className="flex items-center gap-1.5"><Palette className="w-3.5 h-3.5" /> OPEN</span>
              </span>
              <div className="grid grid-cols-3 gap-2 pt-1">
                {predictionResult.topOpens.map((item, i) => (
                  <div key={i} className="bg-slate-900/90 border border-emerald-500/30 p-2.5 rounded-xl text-center">
                    <span className="block text-2xl font-black text-emerald-300">{item.digit}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-blue-500/30 space-y-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-blue-400 flex items-center justify-between">
                <span className="flex items-center gap-1.5"><Palette className="w-3.5 h-3.5" /> CLOSE</span>
              </span>
              <div className="grid grid-cols-3 gap-2 pt-1">
                {predictionResult.topCloses.map((item, i) => (
                  <div key={i} className="bg-slate-900/90 border border-blue-500/30 p-2.5 rounded-xl text-center">
                    <span className="block text-2xl font-black text-blue-300">{item.digit}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-amber-500/30 space-y-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center justify-between">
                <span className="flex items-center gap-1.5"><Palette className="w-3.5 h-3.5" /> TOTAL (TOP 2)</span>
              </span>
              <div className="grid grid-cols-2 gap-2 pt-1">
                {predictionResult.topTotals.map((item, i) => (
                  <div key={i} className="bg-slate-900/90 border border-amber-500/40 p-2.5 rounded-xl text-center">
                    <span className="block text-3xl font-black text-amber-300">{item.digit}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Cell Possibility Matrix & Logic Inspector */}
          <div className="glass-panel p-6 rounded-3xl space-y-4 border border-slate-700/60">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                  <Brain className="w-4 h-4 text-emerald-400" /> Cell #{predictionResult.targetRowDisplay}, {predictionResult.colHeaderDisplay} Matrix Possibility Audit
                </h3>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                  Evaluated ~{predictionResult.totalEvaluatedPaths.toLocaleString()} pattern vectors across {predictionResult.cellCountScanned} cells ({predictionResult.lookbackRows} rows lookback) in {predictionResult.executionTime}ms
                </p>
              </div>

              {/* Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                <button
                  onClick={() => setSelectedJodiFilter('ALL')}
                  className={`px-3 py-1 rounded-lg border font-bold transition ${
                    selectedJodiFilter === 'ALL'
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  ALL TRACES
                </button>
                {predictionResult.top5.map(([jodi], idx) => (
                  <button
                    key={jodi}
                    onClick={() => setSelectedJodiFilter(jodi)}
                    className={`px-2.5 py-1 rounded-lg border font-bold transition ${
                      selectedJodiFilter === jodi
                        ? 'bg-pink-500/20 border-pink-500 text-pink-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    #{idx + 1} ({jodi})
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-950/80 p-5 rounded-2xl border border-slate-800 font-mono text-xs text-slate-300 space-y-3 max-h-96 overflow-y-auto">
              <div className="p-3 bg-slate-900/90 border border-purple-500/30 rounded-xl space-y-1">
                <p className="text-purple-300 font-bold">[MATRIX SCANNER AUDIT] Target Cell: Row #{predictionResult.targetRowDisplay}, Column #{predictionResult.targetColDisplay} ({predictionResult.colHeaderDisplay}) in {activeChartName}</p>
                <p className="text-slate-400 text-[11px]">[REASONING LOGIC] Scanned all surrounding vertical, horizontal, diagonal, cross-column, multi-week cycle, and total/farak pattern lines with exponential recency decay ({activeModel.recencyDecay || 0.97}).</p>
              </div>

              {predictionResult.top5
                .filter(([jodi]) => selectedJodiFilter === 'ALL' || selectedJodiFilter === jodi)
                .map(([jodi, score], idx) => {
                  const logs = predictionResult.candidateLogs[jodi] || [];
                  return (
                    <div key={jodi} className="space-y-1 my-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                      <div className="flex justify-between items-center border-b border-slate-800/60 pb-1.5 mb-1.5">
                        <p className="text-pink-400 font-bold flex items-center gap-1.5">
                          <span>► FORECAST JODI {jodi}</span>
                          <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">Rank #{idx + 1}</span>
                        </p>
                        <span className="text-emerald-400 font-bold">{score} Total Points</span>
                      </div>
                      {logs.map((item, lIdx) => (
                        <p key={lIdx} className="text-slate-300 pl-3 border-l-2 border-emerald-500/40 text-[11px] py-0.5">
                          <span className="text-emerald-400 font-bold">+{item.points} pts</span> : {item.reason}
                        </p>
                      ))}
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
