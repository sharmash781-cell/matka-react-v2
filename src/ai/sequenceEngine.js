/**
 * Visual Sequence Highlighting Engine for Matka Chart Platform
 * -------------------------------------------------------------
 * Scans 2-digit Jodi chart grids across all directions (Horizontal, Vertical, Diagonals)
 * for forward 3-step digit sequences across Open, Close, or Mixed digits.
 */

// Distinct neon color palette for match instances
export const MATCH_COLORS = [
  '#00f0ff', // Electric Cyan
  '#ff007f', // Neon Pink
  '#00ff88', // Emerald Green
  '#ffd700', // Bright Gold
  '#a855f7', // Electric Purple
  '#ff5722', // Deep Orange
  '#3b82f6', // Vivid Blue
  '#e11d48', // Rose Red
  '#14b8a6', // Teal
  '#f43f5e'  // Crimson
];

/**
 * Parses user input string like "5, 3, 2" or "532" or "5 3 2" into array of digit strings ['5', '3', '2']
 */
export const parseSequenceInput = (input) => {
  if (!input) return [];
  const digits = input.replace(/[^0-9]/g, '').split('');
  return digits.length >= 2 ? digits : [];
};

/**
 * Main sequence finder function
 * @param {Array} grid 2D array of cells [{val: "53"}, ...]
 * @param {String|Array} sequenceInput User input e.g. "5, 3, 2"
 * @returns {Object} { targetSeq: ['5', '3', '2'], totalMatches: N, matches: [...] }
 */
export const findSequenceMatches = (grid, sequenceInput) => {
  const targetSeq = Array.isArray(sequenceInput) 
    ? sequenceInput.map(String) 
    : parseSequenceInput(sequenceInput);

  if (!grid || !Array.isArray(grid) || grid.length === 0 || targetSeq.length < 2) {
    return { targetSeq: [], totalMatches: 0, matches: [] };
  }

  const rows = grid.length;
  const cols = grid[0] ? grid[0].length : 7;
  const seqLen = targetSeq.length;
  const rawMatches = [];

  // Direction vectors strictly restricted to adjacent cells:
  // 1. Horizontal (Same Row, consecutive columns: Col 1 -> Col 2 -> Col 3)
  // 2. Vertical (Same Column, consecutive rows: Row 3 -> Row 4 -> Row 5)
  const directions = [
    [0, 1, 'Horizontal (Same Row)'],
    [1, 0, 'Vertical (Same Column)']
  ];

  // Helper to extract digit from cell ('open' = index 0, 'close' = index 1)
  const getCellDigit = (r, c, digitType) => {
    if (r < 0 || r >= rows || c < 0 || c >= cols) return null;
    const val = grid[r][c]?.val;
    if (!val || val === '**' || !/^\d{2}$/.test(val)) return null;
    return digitType === 'open' ? val[0] : val[1];
  };

  // Helper to check if a specific step combination matches targetSeq
  const checkSequenceAlongPath = (rStart, cStart, rStep, cStep, digitTypeCombo, dirName) => {
    const matchedCells = [];

    for (let i = 0; i < seqLen; i++) {
      const r = rStart + i * rStep;
      const c = cStart + i * cStep;

      if (r < 0 || r >= rows || c < 0 || c >= cols) return null;

      const digitType = digitTypeCombo[i];
      const digit = getCellDigit(r, c, digitType);

      if (digit === null || digit !== targetSeq[i]) {
        return null; // Sequence broken
      }

      matchedCells.push({
        r,
        c,
        digit,
        digitType,
        val: grid[r][c].val
      });
    }

    return {
      direction: dirName,
      digitTypeLabel: digitTypeCombo.map(d => d.toUpperCase()).join(' → '),
      cells: matchedCells
    };
  };

  // Helper to check partial setups (e.g. 2 digits filled + 3rd step lands on EMPTY cell)
  const checkPartialSequenceAlongPath = (rStart, cStart, rStep, cStep, digitTypeCombo, dirName) => {
    if (seqLen < 3) return null;

    const matchedCells = [];

    // Check first (seqLen - 1) steps match targetSeq
    for (let i = 0; i < seqLen - 1; i++) {
      const r = rStart + i * rStep;
      const c = cStart + i * cStep;
      if (r < 0 || r >= rows || c < 0 || c >= cols) return null;

      const digitType = digitTypeCombo[i];
      const digit = getCellDigit(r, c, digitType);
      if (digit === null || digit !== targetSeq[i]) {
        return null;
      }
      matchedCells.push({
        r,
        c,
        digit,
        digitType,
        val: grid[r][c].val
      });
    }

    // Step (seqLen - 1) must land on an EMPTY cell (unfilled)
    const targetR = rStart + (seqLen - 1) * rStep;
    const targetC = cStart + (seqLen - 1) * cStep;
    if (targetR < 0 || targetR >= rows || targetC < 0 || targetC >= cols) return null;

    const targetVal = grid[targetR][targetC]?.val || '';
    if (targetVal !== '' && targetVal !== null) return null; // Must be EMPTY!

    const predictedDigit = targetSeq[seqLen - 1];
    const cutDigit = String((parseInt(predictedDigit) + 5) % 10);
    const predictedDigitType = digitTypeCombo[seqLen - 1];

    return {
      direction: dirName,
      digitTypeLabel: digitTypeCombo.map(d => d.toUpperCase()).join(' → '),
      cells: matchedCells,
      isPartialSetup: true,
      emptyCell: {
        r: targetR,
        c: targetC,
        predictedDigit,
        cutDigit,
        predictedDigitType
      }
    };
  };

  // Digit type combinations to evaluate:
  // Strictly ALL OPEN digits (Open -> Open -> Open) OR ALL CLOSE digits (Close -> Close -> Close)
  const digitCombos = [
    Array(seqLen).fill('open'),
    Array(seqLen).fill('close')
  ];

  // Deduplication tracker
  const seenPaths = new Set();
  const rawPartialSetups = [];

  // Scan entire grid
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      for (const [rStep, cStep, dirName] of directions) {
        for (const combo of digitCombos) {
          const matchResult = checkSequenceAlongPath(r, c, rStep, cStep, combo, dirName);
          if (matchResult) {
            // Path key for deduplication
            const pathKey = matchResult.cells.map(cell => `${cell.r}:${cell.c}:${cell.digitType}`).join('|');
            if (!seenPaths.has(pathKey)) {
              seenPaths.add(pathKey);
              
              // Calculate immediate subsequent cell (the outcome cell after pattern completes)
              const lastCell = matchResult.cells[matchResult.cells.length - 1];
              let nextR = lastCell.r + (dirName.includes('Vertical') ? 1 : 0);
              let nextC = lastCell.c + (dirName.includes('Horizontal') ? 1 : 0);
              if (dirName.includes('Horizontal') && nextC >= cols) {
                nextC = 0;
                nextR = lastCell.r + 1;
              }

              let subsequentOutcome = null;
              if (nextR >= 0 && nextR < rows && nextC >= 0 && nextC < cols) {
                const nextVal = grid[nextR][nextC]?.val || '';
                if (nextVal && nextVal !== '**' && /^\d{2}$/.test(nextVal)) {
                  subsequentOutcome = {
                    nextR,
                    nextC,
                    nextVal,
                    nextOpen: nextVal[0],
                    nextClose: nextVal[1]
                  };
                }
              }

              rawMatches.push({
                ...matchResult,
                startRow: matchResult.cells[0].r,
                endRow: lastCell.r,
                subsequentOutcome
              });
            }
          } else {
            // Check for partial setup (2 digits completed + 3rd empty cell)
            const partialResult = checkPartialSequenceAlongPath(r, c, rStep, cStep, combo, dirName);
            if (partialResult) {
              const partialKey = `${partialResult.emptyCell.r}:${partialResult.emptyCell.c}:${partialResult.emptyCell.predictedDigitType}`;
              if (!seenPaths.has(partialKey)) {
                seenPaths.add(partialKey);
                rawPartialSetups.push(partialResult);
              }
            }
          }
        }
      }
    }
  }

  // Format matches with distinct colors and compute short-range row gaps (5 to 12 rows)
  const matches = rawMatches.map((m, idx) => {
    // Check gap from previous match
    const prevMatch = idx > 0 ? rawMatches[idx - 1] : null;
    const rowGap = prevMatch ? Math.abs(m.startRow - prevMatch.startRow) : null;
    const isShortRangeGap = rowGap !== null && rowGap >= 5 && rowGap <= 12;

    return {
      id: `seq_match_${idx + 1}`,
      matchNumber: idx + 1,
      color: MATCH_COLORS[idx % MATCH_COLORS.length],
      direction: m.direction,
      digitTypeLabel: m.digitTypeLabel,
      cells: m.cells,
      startRow: m.startRow,
      endRow: m.endRow,
      rowGap,
      isShortRangeGap,
      subsequentOutcome: m.subsequentOutcome,
      summary: `Match #${idx + 1}: ${m.direction} (${m.digitTypeLabel})${rowGap !== null ? ` | Gap: ${rowGap} Rows` : ''}`
    };
  });

  const partialSetups = rawPartialSetups.map((p, idx) => ({
    id: `partial_setup_${idx + 1}`,
    setupNumber: idx + 1,
    color: '#ec4899', // Bright Hot Pink for Active Unfilled Predictions
    direction: p.direction,
    digitTypeLabel: p.digitTypeLabel,
    cells: p.cells,
    emptyCell: p.emptyCell,
    summary: `Partial Setup #${idx + 1}: ${p.cells.map(c => c.digit).join('➔')} ➔ Requires ${p.emptyCell.predictedDigit} (Cut: ${p.emptyCell.cutDigit}) at Row #${p.emptyCell.r + 1}`
  }));

  // Calculate Subsequent Predictions and Analytics
  const predictions = calculateOutcomePredictions(matches);

  return {
    targetSeq,
    targetSeqStr: targetSeq.join(' → '),
    totalMatches: matches.length,
    shortRangeMatchesCount: matches.filter(m => m.isShortRangeGap).length,
    partialSetupsCount: partialSetups.length,
    matches,
    partialSetups,
    predictions
  };
};

/**
 * Calculates subsequent outcome statistics (Predicted Open, Close, Jodi)
 */
export const calculateOutcomePredictions = (matches) => {
  const openCounts = {};
  const closeCounts = {};
  const jodiCounts = {};
  
  const shortOpenCounts = {};
  const shortCloseCounts = {};

  let totalOutcomes = 0;
  let totalShortOutcomes = 0;

  matches.forEach((m) => {
    if (m.subsequentOutcome) {
      const { nextOpen, nextClose, nextVal } = m.subsequentOutcome;
      totalOutcomes++;
      openCounts[nextOpen] = (openCounts[nextOpen] || 0) + 1;
      closeCounts[nextClose] = (closeCounts[nextClose] || 0) + 1;
      jodiCounts[nextVal] = (jodiCounts[nextVal] || 0) + 1;

      if (m.isShortRangeGap) {
        totalShortOutcomes++;
        shortOpenCounts[nextOpen] = (shortOpenCounts[nextOpen] || 0) + 1;
        shortCloseCounts[nextClose] = (shortCloseCounts[nextClose] || 0) + 1;
      }
    }
  });

  const getTopItems = (countsObj, total) => {
    return Object.entries(countsObj)
      .map(([key, count]) => ({
        val: key,
        count,
        percentage: total > 0 ? Math.round((count / total) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count);
  };

  const topOpen = getTopItems(openCounts, totalOutcomes);
  const topClose = getTopItems(closeCounts, totalOutcomes);
  const topJodis = getTopItems(jodiCounts, totalOutcomes);

  const topShortOpen = getTopItems(shortOpenCounts, totalShortOutcomes);
  const topShortClose = getTopItems(shortCloseCounts, totalShortOutcomes);

  return {
    totalOutcomes,
    totalShortOutcomes,
    topOpen,
    topClose,
    topJodis,
    topShortOpen,
    topShortClose,
    // Suggested primary predictions
    bestOpen: topShortOpen.length > 0 ? topShortOpen[0].val : (topOpen.length > 0 ? topOpen[0].val : '-'),
    bestClose: topShortClose.length > 0 ? topShortClose[0].val : (topClose.length > 0 ? topClose[0].val : '-'),
    cutOpen: topShortOpen.length > 0 ? (parseInt(topShortOpen[0].val) + 5) % 10 : (topOpen.length > 0 ? (parseInt(topOpen[0].val) + 5) % 10 : '-')
  };
};

/**
 * Tail-End 12-Week Lookback & Prediction Engine
 * 1. Analyzes the last 2 to 3 active rows leading up to current/empty row.
 * 2. Scans backwards through chart within strict 12-row windows to find exact historical matches.
 * 3. Calculates historical follow-up probabilities for the next empty cell per column!
 */
export const analyzeTailEnd12WeekLookback = (grid, cols = 7) => {
  if (!grid || grid.length < 3) return null;

  const rows = grid.length;

  // Find last filled row index
  let lastFilledR = -1;
  for (let r = rows - 1; r >= 0; r--) {
    if (grid[r] && grid[r].some(c => c.val && c.val !== '')) {
      lastFilledR = r;
      break;
    }
  }

  if (lastFilledR < 1) return null;

  const pendingRowR = lastFilledR + 1 < rows ? lastFilledR + 1 : lastFilledR;
  const colPredictions = [];

  const getDigit = (r, c, type) => {
    const v = grid[r]?.[c]?.val;
    if (!v || v === '**' || !/^\d{2}$/.test(v)) return null;
    return type === 'open' ? v[0] : v[1];
  };

  const colHeaders = ['Mo', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Col 8'];

  for (let c = 0; c < cols; c++) {
    const r1 = lastFilledR - 1;
    const r2 = lastFilledR;

    ['open', 'close'].forEach(digitType => {
      const d1 = getDigit(r1, c, digitType);
      const d2 = getDigit(r2, c, digitType);

      if (d1 !== null && d2 !== null) {
        const tailPatternStr = `${d1} ➔ ${d2}`;
        const lookbackMinR = Math.max(0, lastFilledR - 12);
        const matchesIn12Week = [];
        const nextOpenCounts = {};
        const nextCloseCounts = {};
        const nextJodiCounts = {};
        let totalMatches = 0;

        for (let histR = lastFilledR - 2; histR >= lookbackMinR; histR--) {
          const hd1 = getDigit(histR, c, digitType);
          const hd2 = getDigit(histR + 1, c, digitType);

          if (hd1 === d1 && hd2 === d2) {
            const followR = histR + 2;
            if (followR < rows) {
              const followVal = grid[followR]?.[c]?.val;
              if (followVal && followVal !== '**' && /^\d{2}$/.test(followVal)) {
                totalMatches++;
                const fOpen = followVal[0];
                const fClose = followVal[1];
                nextOpenCounts[fOpen] = (nextOpenCounts[fOpen] || 0) + 1;
                nextCloseCounts[fClose] = (nextCloseCounts[fClose] || 0) + 1;
                nextJodiCounts[followVal] = (nextJodiCounts[followVal] || 0) + 1;

                matchesIn12Week.push({
                  histR,
                  followR,
                  followVal,
                  fOpen,
                  fClose
                });
              }
            }
          }
        }

        if (totalMatches > 0) {
          const getTop = (obj) => Object.entries(obj)
            .map(([val, count]) => ({
              val,
              count,
              percentage: Math.round((count / totalMatches) * 100),
              cutVal: String((parseInt(val) + 5) % 10)
            }))
            .sort((a, b) => b.count - a.count);

          colPredictions.push({
            id: `tail_pred_${c}_${digitType}`,
            col: c,
            colName: colHeaders[c] || `C${c + 1}`,
            pendingRowR,
            digitType,
            tailPatternStr,
            tailDigits: [d1, d2],
            totalMatches,
            lookbackMinRow: lookbackMinR + 1,
            lookbackMaxRow: lastFilledR + 1,
            matchesIn12Week,
            topOpen: getTop(nextOpenCounts),
            topClose: getTop(nextCloseCounts),
            topJodi: getTop(nextJodiCounts)
          });
        }
      }
    });
  }

  return {
    lastFilledRowIndex: lastFilledR,
    pendingRowIndex: pendingRowR,
    lookbackWindowRows: 12,
    colPredictions
  };
};
