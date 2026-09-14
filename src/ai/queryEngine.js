/**
 * Natural Language Query Engine for Matka Chart
 * Parses English sentences like:
 * - "find 56 in Mon"
 * - "Tuesday total 2"
 * - "find same red number on Tuesday in consecutive rows like 11 11 or 11 66"
 * - "find red pairs in Thursday"
 * - "find 88"
 * - "same digit in Tue and Wed"
 */
import { isRedPair, calculateTotal, calculateDiffTotal } from '../context/ChartContext';

const DAY_MAP = {
  mon: 0, monday: 0, mo: 0,
  tue: 1, tuesday: 1, tu: 1,
  wed: 2, wednesday: 2, we: 2,
  thu: 3, thursday: 3, th: 3,
  fri: 4, friday: 4, fr: 4,
  sat: 5, saturday: 5, sa: 5,
  sun: 6, sunday: 6, su: 6
};

const DAY_NAMES = ['Mo', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const parseAndSearchChart = (queryStr, grid, cols = 7) => {
  if (!queryStr || !grid || grid.length === 0) {
    return { matches: [], summary: 'Type a query in simple English to search the chart.', matchMap: {} };
  }

  const q = queryStr.toLowerCase().trim();
  const matches = [];
  const matchMap = {}; // key: "r_c", value: match item

  // Check target day/column mentioned
  let targetCol = null;
  Object.keys(DAY_MAP).forEach(dayKey => {
    if (q.includes(dayKey)) {
      targetCol = DAY_MAP[dayKey];
    }
  });

  // Extract explicit 2-digit numbers (e.g. 56, 88, 66, 11)
  const explicitNumberMatches = q.match(/\b\d{2}\b/g) || [];

  // Extract single digits (e.g. total 2, digit 5)
  const totalMatch = q.match(/(?:total|sum)\s*(\d)/);
  const targetTotal = totalMatch ? parseInt(totalMatch[1]) : null;

  const diffMatch = q.match(/(?:diff|difference)\s*(\d)/);
  const targetDiff = diffMatch ? parseInt(diffMatch[1]) : null;

  const isRedQuery = q.includes('red') || q.includes('red pair') || q.includes('red number');
  const isConsecutiveQuery = q.includes('consecutive') || q.includes('next row') || q.includes('n+1') || q.includes('same row') || q.includes('same col') || q.includes('same column');
  const isSameDigitQuery = q.includes('same digit') || q.includes('repeat') || q.includes('same number');

  // HIGHLIGHT COLORS
  const HIGHLIGHT_COLOR = '#f59e0b'; // Amber
  const RED_MATCH_COLOR = '#ef4444'; // Red
  const BLUE_MATCH_COLOR = '#06b6d4'; // Cyan/Blue
  const PURPLE_MATCH_COLOR = '#a855f7'; // Purple

  // 1. Explicit 2-digit Number Search (e.g. "find 56 in Monday" or "88")
  if (explicitNumberMatches.length > 0) {
    const numToFind = explicitNumberMatches[0];
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < (grid[r]?.length || cols); c++) {
        if (targetCol !== null && c !== targetCol) continue;
        const val = grid[r][c]?.val || '';
        if (val === numToFind) {
          const matchItem = {
            r, c,
            day: DAY_NAMES[c] || `Col ${c+1}`,
            rowNum: r + 1,
            val,
            reason: `Found exact number ${val} on ${DAY_NAMES[c] || `Col ${c+1}`} (Row #${r+1})`,
            color: isRedPair(val) ? RED_MATCH_COLOR : HIGHLIGHT_COLOR
          };
          matches.push(matchItem);
          matchMap[`${r}_${c}`] = matchItem;
        }
      }
    }
  }

  // 2. Consecutive Red Numbers (e.g. "Tuesday nth row and tuesday n+1 row have same red number like 11 11 or 11 66")
  else if (isRedQuery && (isConsecutiveQuery || isSameDigitQuery || q.includes('row') || q.includes('col') || targetCol !== null)) {
    // Vertical consecutive search
    for (let c = 0; c < cols; c++) {
      if (targetCol !== null && c !== targetCol) continue;
      for (let r = 0; r < grid.length - 1; r++) {
        const val1 = grid[r]?.[c]?.val || '';
        const val2 = grid[r + 1]?.[c]?.val || '';
        if (isRedPair(val1) && isRedPair(val2)) {
          const m1 = {
            r, c,
            day: DAY_NAMES[c],
            rowNum: r + 1,
            val: val1,
            reason: `Consecutive Red Pair ${val1} (Row #${r+1}) ➔ ${val2} (Row #${r+2}) on ${DAY_NAMES[c]}`,
            color: RED_MATCH_COLOR
          };
          const m2 = {
            r: r + 1, c,
            day: DAY_NAMES[c],
            rowNum: r + 2,
            val: val2,
            reason: `Consecutive Red Pair ${val1} (Row #${r+1}) ➔ ${val2} (Row #${r+2}) on ${DAY_NAMES[c]}`,
            color: RED_MATCH_COLOR
          };
          matches.push(m1, m2);
          matchMap[`${r}_${c}`] = m1;
          matchMap[`${r+1}_${c}`] = m2;
        }
      }
    }

    // Horizontal red pair search in same row if requested
    if (matches.length === 0 || q.includes('same row')) {
      for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < cols - 1; c++) {
          if (targetCol !== null && c !== targetCol) continue;
          const val1 = grid[r]?.[c]?.val || '';
          const val2 = grid[r]?.[c + 1]?.val || '';
          if (isRedPair(val1) && isRedPair(val2)) {
            const m1 = { r, c, day: DAY_NAMES[c], rowNum: r + 1, val: val1, reason: `Row #${r+1} Same Row Red Pairs: ${val1} & ${val2}`, color: RED_MATCH_COLOR };
            const m2 = { r, c: c+1, day: DAY_NAMES[c+1], rowNum: r + 1, val: val2, reason: `Row #${r+1} Same Row Red Pairs: ${val1} & ${val2}`, color: RED_MATCH_COLOR };
            matches.push(m1, m2);
            matchMap[`${r}_${c}`] = m1;
            matchMap[`${r}_${c+1}`] = m2;
          }
        }
      }
    }
  }

  // 3. General Red Pair Query ("red pairs", "red number")
  else if (isRedQuery) {
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < cols; c++) {
        if (targetCol !== null && c !== targetCol) continue;
        const val = grid[r]?.[c]?.val || '';
        if (isRedPair(val)) {
          const matchItem = {
            r, c,
            day: DAY_NAMES[c],
            rowNum: r + 1,
            val,
            reason: `Red Pair ${val} on ${DAY_NAMES[c]} (Row #${r+1})`,
            color: RED_MATCH_COLOR
          };
          matches.push(matchItem);
          matchMap[`${r}_${c}`] = matchItem;
        }
      }
    }
  }

  // 4. Target Total/Sum Query (e.g. "tuesday 2 total", "total 5")
  else if (targetTotal !== null) {
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < cols; c++) {
        if (targetCol !== null && c !== targetCol) continue;
        const val = grid[r]?.[c]?.val || '';
        const tot = calculateTotal(val);
        if (tot === targetTotal) {
          const matchItem = {
            r, c,
            day: DAY_NAMES[c],
            rowNum: r + 1,
            val,
            reason: `Total = ${tot} (${val}) on ${DAY_NAMES[c]} (Row #${r+1})`,
            color: BLUE_MATCH_COLOR
          };
          matches.push(matchItem);
          matchMap[`${r}_${c}`] = matchItem;
        }
      }
    }
  }

  // 5. Target Difference Query (e.g. "diff 3")
  else if (targetDiff !== null) {
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < cols; c++) {
        if (targetCol !== null && c !== targetCol) continue;
        const val = grid[r]?.[c]?.val || '';
        const diff = calculateDiffTotal(val);
        if (diff === targetDiff) {
          const matchItem = {
            r, c,
            day: DAY_NAMES[c],
            rowNum: r + 1,
            val,
            reason: `Difference = ${diff} (${val}) on ${DAY_NAMES[c]} (Row #${r+1})`,
            color: PURPLE_MATCH_COLOR
          };
          matches.push(matchItem);
          matchMap[`${r}_${c}`] = matchItem;
        }
      }
    }
  }

  // 6. Same Digit Repeating Search (e.g. "same digit", "mon 56 same digit")
  else if (isSameDigitQuery || q.includes('digit')) {
    const digitMatch = q.match(/\b\d\b/);
    const targetSingleDigit = digitMatch ? digitMatch[0] : null;

    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < cols; c++) {
        if (targetCol !== null && c !== targetCol) continue;
        const val = grid[r]?.[c]?.val || '';
        if (val && /^\d{2}$/.test(val)) {
          if (targetSingleDigit) {
            if (val[0] === targetSingleDigit || val[1] === targetSingleDigit) {
              const matchItem = {
                r, c,
                day: DAY_NAMES[c],
                rowNum: r + 1,
                val,
                reason: `Contains digit ${targetSingleDigit} (${val}) on ${DAY_NAMES[c]} (Row #${r+1})`,
                color: HIGHLIGHT_COLOR
              };
              matches.push(matchItem);
              matchMap[`${r}_${c}`] = matchItem;
            }
          } else if (val[0] === val[1]) {
            const matchItem = {
              r, c,
              day: DAY_NAMES[c],
              rowNum: r + 1,
              val,
              reason: `Same Open/Close digit ${val} on ${DAY_NAMES[c]} (Row #${r+1})`,
              color: HIGHLIGHT_COLOR
            };
            matches.push(matchItem);
            matchMap[`${r}_${c}`] = matchItem;
          }
        }
      }
    }
  }

  // 7. Fallback: Search any matching substring or value
  else {
    const searchVal = q.replace(/find|search|where|is|the|number|in|of/g, '').trim();
    if (searchVal.length > 0) {
      for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < cols; c++) {
          if (targetCol !== null && c !== targetCol) continue;
          const val = grid[r]?.[c]?.val || '';
          if (val && val.toLowerCase().includes(searchVal)) {
            const matchItem = {
              r, c,
              day: DAY_NAMES[c],
              rowNum: r + 1,
              val,
              reason: `Matched "${searchVal}" (${val}) on ${DAY_NAMES[c]} (Row #${r+1})`,
              color: isRedPair(val) ? RED_MATCH_COLOR : HIGHLIGHT_COLOR
            };
            matches.push(matchItem);
            matchMap[`${r}_${c}`] = matchItem;
          }
        }
      }
    }
  }

  const summary = matches.length > 0
    ? `Found ${matches.length} matching cell${matches.length > 1 ? 's' : ''} for "${queryStr}"`
    : `No matches found for "${queryStr}". Try e.g. "find 56 in Mon", "Tuesday total 2", or "red pairs in Tuesday".`;

  return { matches, summary, matchMap };
};
