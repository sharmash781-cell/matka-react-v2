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
              rawMatches.push(matchResult);
            }
          }
        }
      }
    }
  }

  // Format matches with distinct colors
  const matches = rawMatches.map((m, idx) => ({
    id: `seq_match_${idx + 1}`,
    matchNumber: idx + 1,
    color: MATCH_COLORS[idx % MATCH_COLORS.length],
    direction: m.direction,
    digitTypeLabel: m.digitTypeLabel,
    cells: m.cells,
    summary: `Match #${idx + 1}: ${m.direction} (${m.digitTypeLabel})`
  }));

  return {
    targetSeq,
    targetSeqStr: targetSeq.join(' → '),
    totalMatches: matches.length,
    matches
  };
};
