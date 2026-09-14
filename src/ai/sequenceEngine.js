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

  // Digit type combinations to evaluate:
  // Strictly ALL OPEN digits (Open -> Open -> Open) OR ALL CLOSE digits (Close -> Close -> Close)
  const digitCombos = [
    Array(seqLen).fill('open'),
    Array(seqLen).fill('close')
  ];

  // Deduplication tracker
  const seenPaths = new Set();

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

  // Calculate Subsequent Predictions and Analytics
  const predictions = calculateOutcomePredictions(matches);

  return {
    targetSeq,
    targetSeqStr: targetSeq.join(' → '),
    totalMatches: matches.length,
    shortRangeMatchesCount: matches.filter(m => m.isShortRangeGap).length,
    matches,
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
