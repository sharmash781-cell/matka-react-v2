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
/**
 * Main sequence finder function
 * @param {Array} grid 2D array of cells [{val: "53"}, ...]
 * @param {String|Array} sequenceInput User input e.g. "5, 3, 2" or "1, 4, 5"
 * @param {Object} options Options for filtering (digitTypeFilter, directionFilter, selectedGap, matchMode)
 * @returns {Object} { targetSeq: ['5', '3', '2'], totalMatches: N, matches: [...] }
 */
export const findSequenceMatches = (grid, sequenceInput, options = {}) => {
  const targetSeq = Array.isArray(sequenceInput) 
    ? sequenceInput.map(String) 
    : parseSequenceInput(sequenceInput);

  if (!grid || !Array.isArray(grid) || grid.length === 0 || targetSeq.length < 2) {
    return { targetSeq: [], totalMatches: 0, matches: [] };
  }

  const {
    digitTypeFilter = 'all', // 'all', 'opens_only', 'closes_only'
    directionFilter = 'all', // 'all', 'horizontal', 'vertical', 'diagonal'
    selectedGap = 'all',      // 'all' (gaps 0..5), or '0', '1', '2', '3', '4', '5'
    matchMode = 'all'        // 'all' (exact or cut), 'exact_only', 'cut_only'
  } = options;

  const rows = grid.length;
  const cols = grid[0] ? grid[0].length : 7;
  const seqLen = targetSeq.length;
  const rawMatches = [];

  // Direction vectors
  const allDirections = [
    [0, 1, 'Horizontal (Same Row)', 'horizontal'],
    [1, 0, 'Vertical (Same Column)', 'vertical'],
    [1, 1, 'Diagonal Down-Right', 'diagonal'],
    [1, -1, 'Diagonal Down-Left', 'diagonal']
  ];

  const directions = allDirections.filter(([,, , category]) => {
    if (directionFilter === 'all') return true;
    if (directionFilter === 'horizontal') return category === 'horizontal';
    if (directionFilter === 'vertical') return category === 'vertical';
    if (directionFilter === 'diagonal') return category === 'diagonal';
    return true;
  });

  // Gap step multipliers (Gap 0 = dist 1, Gap 1 = dist 2, ..., Gap 5 = dist 6)
  let gapsToTest = [0, 1, 2, 3, 4, 5];
  if (selectedGap !== 'all' && selectedGap !== undefined && selectedGap !== null) {
    const parsedG = parseInt(selectedGap, 10);
    if (!isNaN(parsedG) && parsedG >= 0 && parsedG <= 5) {
      gapsToTest = [parsedG];
    }
  }

  // Helper to extract digit from cell ('open' = index 0, 'close' = index 1)
  const getCellDigit = (r, c, digitType) => {
    if (r < 0 || r >= rows || c < 0 || c >= cols) return null;
    const val = grid[r][c]?.val;
    if (!val || val === '**' || !/^\d{2}$/.test(val)) return null;
    return digitType === 'open' ? val[0] : val[1];
  };

  // Helper to check if a specific step combination matches targetSeq
  const checkSequenceAlongPath = (rStart, cStart, dr, dc, gap, digitTypeCombo, dirName) => {
    const matchedCells = [];
    let isCutMatch = false;
    const stepDist = gap + 1; // Gap 0 => stepDist 1

    for (let i = 0; i < seqLen; i++) {
      const r = rStart + i * dr * stepDist;
      const c = cStart + i * dc * stepDist;

      if (r < 0 || r >= rows || c < 0 || c >= cols) return null;

      const digitType = digitTypeCombo[i];
      const digit = getCellDigit(r, c, digitType);
      if (digit === null) return null;

      const targetD = targetSeq[i];
      const cutD = String((parseInt(targetD, 10) + 5) % 10);

      if (digit === targetD) {
        if (matchMode === 'cut_only') return null;
      } else if (digit === cutD) {
        if (matchMode === 'exact_only') return null;
        isCutMatch = true;
      } else {
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

    const gapLabel = gap === 0 ? 'Gap 0' : `Gap ${gap}`;
    return {
      direction: `${dirName} (${gapLabel})`,
      gap,
      digitTypeLabel: digitTypeCombo.map(d => d.toUpperCase()).join(' → ') + (isCutMatch ? ' (Cut/Equal)' : ' (Exact)'),
      cells: matchedCells
    };
  };

  // Helper to check partial setups (e.g. 2 digits filled + 3rd step lands on EMPTY cell)
  const checkPartialSequenceAlongPath = (rStart, cStart, dr, dc, gap, digitTypeCombo, dirName) => {
    if (seqLen < 3) return null;

    const matchedCells = [];
    let isCutMatch = false;
    const stepDist = gap + 1;

    for (let i = 0; i < seqLen - 1; i++) {
      const r = rStart + i * dr * stepDist;
      const c = cStart + i * dc * stepDist;
      if (r < 0 || r >= rows || c < 0 || c >= cols) return null;

      const digitType = digitTypeCombo[i];
      const digit = getCellDigit(r, c, digitType);
      if (digit === null) return null;

      const targetD = targetSeq[i];
      const cutD = String((parseInt(targetD, 10) + 5) % 10);

      if (digit === targetD) {
        if (matchMode === 'cut_only') return null;
      } else if (digit === cutD) {
        if (matchMode === 'exact_only') return null;
        isCutMatch = true;
      } else {
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
    const targetR = rStart + (seqLen - 1) * dr * stepDist;
    const targetC = cStart + (seqLen - 1) * dc * stepDist;
    if (targetR < 0 || targetR >= rows || targetC < 0 || targetC >= cols) return null;

    const targetVal = grid[targetR][targetC]?.val || '';
    if (targetVal !== '' && targetVal !== null) return null; // Must be EMPTY!

    const predictedDigit = targetSeq[seqLen - 1];
    const cutDigit = String((parseInt(predictedDigit) + 5) % 10);
    const predictedDigitType = digitTypeCombo[seqLen - 1];

    const gapLabel = gap === 0 ? 'Gap 0' : `Gap ${gap}`;
    return {
      direction: `${dirName} (${gapLabel})`,
      gap,
      digitTypeLabel: digitTypeCombo.map(d => d.toUpperCase()).join(' → ') + (isCutMatch ? ' (Cut/Equal)' : ' (Exact)'),
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

  // Digit type combinations based on filter
  let digitCombos = [];
  if (digitTypeFilter === 'opens_only') {
    digitCombos = [Array(seqLen).fill('open')];
  } else if (digitTypeFilter === 'closes_only') {
    digitCombos = [Array(seqLen).fill('close')];
  } else {
    // Generate all open & close combinations
    const numCombos = Math.pow(2, seqLen);
    for (let i = 0; i < numCombos; i++) {
      const combo = [];
      for (let j = 0; j < seqLen; j++) {
        combo.push((i & (1 << j)) ? 'close' : 'open');
      }
      digitCombos.push(combo);
    }
  }

  // Deduplication tracker
  const seenPaths = new Set();
  const rawPartialSetups = [];

  // Scan entire grid
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      for (const [dr, dc, dirName] of directions) {
        for (const gap of gapsToTest) {
          for (const combo of digitCombos) {
            const matchResult = checkSequenceAlongPath(r, c, dr, dc, gap, combo, dirName);
            if (matchResult) {
              const pathKey = matchResult.cells.map(cell => `${cell.r}:${cell.c}:${cell.digitType}`).join('|');
              if (!seenPaths.has(pathKey)) {
                seenPaths.add(pathKey);
                
                const lastCell = matchResult.cells[matchResult.cells.length - 1];
                let nextR = lastCell.r + (dirName.includes('Vertical') || dirName.includes('Diagonal') ? (gap + 1) : 0);
                let nextC = lastCell.c + (dirName.includes('Horizontal') || dirName.includes('Diagonal') ? (gap + 1) : 0);
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
              const partialResult = checkPartialSequenceAlongPath(r, c, dr, dc, gap, combo, dirName);
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
