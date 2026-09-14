/**
 * Ultra-Advanced Matka Natural Language Query Engine
 * Parses multi-number sequence instructions, opens/closes, red pairs, totals, and relational queries like:
 * - "find 91 in tues and next tues 92"
 * - "open 9 in mon and close 2 in tue"
 * - "Tuesday total 2"
 * - "find 56 in Mon and next 88"
 * - "consecutive red numbers on Tuesday"
 */
import { isRedPair, calculateTotal, calculateDiffTotal, calculateCN, calculateCloseCond } from '../context/ChartContext';

const DAY_MAP = {
  mon: 0, monday: 0, mo: 0,
  tue: 1, tuesday: 1, tu: 1, tues: 1,
  wed: 2, wednesday: 2, we: 2,
  thu: 3, thursday: 3, th: 3, thur: 3, thurs: 3,
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
  const matchMap = {};

  const HIGHLIGHT_COLOR = '#f59e0b'; // Amber
  const RED_MATCH_COLOR = '#ef4444'; // Red
  const BLUE_MATCH_COLOR = '#06b6d4'; // Cyan/Blue
  const PURPLE_MATCH_COLOR = '#a855f7'; // Purple
  const GREEN_MATCH_COLOR = '#10b981'; // Emerald Green

  // Extract all 2-digit numbers in the query sentence
  const explicitNumberMatches = q.match(/\b\d{2}\b/g) || [];

  // Detect days mentioned in query
  const foundDays = [];
  Object.keys(DAY_MAP).forEach(dayKey => {
    if (q.includes(dayKey)) {
      foundDays.push({ key: dayKey, col: DAY_MAP[dayKey] });
    }
  });

  const isNextMentioned = q.includes('next') || q.includes('then') || q.includes('after') || q.includes('n+1') || q.includes('consecutive') || q.includes('following');

  // -------------------------------------------------------------
  // RULE 1: MULTI-NUMBER / RELATIONAL SEQUENCE QUERY
  // Example: "find 91 in tues and next tues 92" or "91 in tuesday and next 92"
  // -------------------------------------------------------------
  if (explicitNumberMatches.length >= 2) {
    const num1 = explicitNumberMatches[0];
    const num2 = explicitNumberMatches[1];

    // Determine target columns if mentioned
    const day1Col = foundDays.length > 0 ? foundDays[0].col : null;
    const day2Col = foundDays.length > 1 ? foundDays[1].col : (day1Col !== null ? day1Col : null);

    // Search for sequence chain: num1 at Row r (col1), num2 at Row r+1 (col2)
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < cols; c++) {
        if (day1Col !== null && c !== day1Col) continue;
        const val1 = grid[r]?.[c]?.val || '';

        if (val1 === num1) {
          // Check next row or relative offset for num2
          const targetR = r + 1; // Check next row
          const targetC = day2Col !== null ? day2Col : c;

          if (targetR < grid.length) {
            const val2 = grid[targetR]?.[targetC]?.val || '';
            if (val2 === num2) {
              // Found exact sequence chain! Highlight BOTH cells!
              const m1 = {
                r, c,
                day: DAY_NAMES[c],
                rowNum: r + 1,
                val: val1,
                reason: `Step 1 (${val1}) on ${DAY_NAMES[c]} (Row #${r+1})`,
                color: GREEN_MATCH_COLOR
              };
              const m2 = {
                r: targetR, c: targetC,
                day: DAY_NAMES[targetC],
                rowNum: targetR + 1,
                val: val2,
                reason: `Step 2 (${val2}) on ${DAY_NAMES[targetC]} (Row #${targetR+1})`,
                color: GREEN_MATCH_COLOR
              };
              matches.push(m1, m2);
              matchMap[`${r}_${c}`] = m1;
              matchMap[`${targetR}_${targetC}`] = m2;
            }
          }
        }
      }
    }

    // Fallback: If no strict sequential chain found, highlight all instances of both numbers
    if (matches.length === 0) {
      for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < cols; c++) {
          const val = grid[r]?.[c]?.val || '';
          if (val === num1 || val === num2) {
            const matchItem = {
              r, c,
              day: DAY_NAMES[c],
              rowNum: r + 1,
              val,
              reason: `Found ${val} on ${DAY_NAMES[c]} (Row #${r+1})`,
              color: isRedPair(val) ? RED_MATCH_COLOR : HIGHLIGHT_COLOR
            };
            matches.push(matchItem);
            matchMap[`${r}_${c}`] = matchItem;
          }
        }
      }
    }
  }

  // -------------------------------------------------------------
  // RULE 2: SINGLE NUMBER SEARCH WITH DAY (e.g. "find 56 in Mon" or "find 91 in tues")
  // -------------------------------------------------------------
  else if (explicitNumberMatches.length === 1) {
    const numToFind = explicitNumberMatches[0];
    const targetCol = foundDays.length > 0 ? foundDays[0].col : null;

    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < cols; c++) {
        if (targetCol !== null && c !== targetCol) continue;
        const val = grid[r]?.[c]?.val || '';

        if (val === numToFind) {
          const matchItem = {
            r, c,
            day: DAY_NAMES[c],
            rowNum: r + 1,
            val,
            reason: `Found exact number ${val} on ${DAY_NAMES[c]} (Row #${r+1})`,
            color: isRedPair(val) ? RED_MATCH_COLOR : HIGHLIGHT_COLOR
          };
          matches.push(matchItem);
          matchMap[`${r}_${c}`] = matchItem;

          // If "next" or "next row" is mentioned, also check the next row cell!
          if (isNextMentioned && r + 1 < grid.length) {
            const nextVal = grid[r + 1]?.[c]?.val || '';
            if (nextVal) {
              const nextItem = {
                r: r + 1, c,
                day: DAY_NAMES[c],
                rowNum: r + 2,
                val: nextVal,
                reason: `Next Row follow-up to ${val}: ${nextVal} on ${DAY_NAMES[c]} (Row #${r+2})`,
                color: GREEN_MATCH_COLOR
              };
              matches.push(nextItem);
              matchMap[`${r+1}_${c}`] = nextItem;
            }
          }
        }
      }
    }
  }

  // -------------------------------------------------------------
  // RULE 3: OPEN / CLOSE DIGIT SEARCH (e.g. "open 9 in mon", "close 2 in tuesday")
  // -------------------------------------------------------------
  else if (q.includes('open') || q.includes('close')) {
    const targetCol = foundDays.length > 0 ? foundDays[0].col : null;
    const openMatch = q.match(/open[s]?\s*(\d)/);
    const closeMatch = q.match(/close[s]?\s*(\d)/);

    const targetOpen = openMatch ? openMatch[1] : null;
    const targetClose = closeMatch ? closeMatch[1] : null;

    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < cols; c++) {
        if (targetCol !== null && c !== targetCol) continue;
        const val = grid[r]?.[c]?.val || '';

        if (val && /^\d{2}$/.test(val)) {
          const isOOk = targetOpen === null || val[0] === targetOpen;
          const isCOk = targetClose === null || val[1] === targetClose;

          if (isOOk && isCOk) {
            const matchItem = {
              r, c,
              day: DAY_NAMES[c],
              rowNum: r + 1,
              val,
              reason: `Matched ${targetOpen ? `Open ${targetOpen}` : ''} ${targetClose ? `Close ${targetClose}` : ''} (${val}) on ${DAY_NAMES[c]} (Row #${r+1})`,
              color: BLUE_MATCH_COLOR
            };
            matches.push(matchItem);
            matchMap[`${r}_${c}`] = matchItem;
          }
        }
      }
    }
  }

  // -------------------------------------------------------------
  // RULE 4: CONSECUTIVE / SAME RED NUMBERS SEARCH (e.g. "red numbers on Tuesday", "11 11 or 11 66")
  // -------------------------------------------------------------
  else if (q.includes('red')) {
    const targetCol = foundDays.length > 0 ? foundDays[0].col : null;
    const isConsecutive = isNextMentioned || q.includes('consecutive') || q.includes('same row') || q.includes('column');

    if (isConsecutive) {
      // Vertical consecutive search
      for (let c = 0; c < cols; c++) {
        if (targetCol !== null && c !== targetCol) continue;
        for (let r = 0; r < grid.length - 1; r++) {
          const val1 = grid[r]?.[c]?.val || '';
          const val2 = grid[r + 1]?.[c]?.val || '';
          if (isRedPair(val1) && isRedPair(val2)) {
            const m1 = { r, c, day: DAY_NAMES[c], rowNum: r + 1, val: val1, reason: `Consecutive Red Pair ${val1} (Row #${r+1}) ➔ ${val2} (Row #${r+2})`, color: RED_MATCH_COLOR };
            const m2 = { r: r + 1, c, day: DAY_NAMES[c], rowNum: r + 2, val: val2, reason: `Consecutive Red Pair ${val1} (Row #${r+1}) ➔ ${val2} (Row #${r+2})`, color: RED_MATCH_COLOR };
            matches.push(m1, m2);
            matchMap[`${r}_${c}`] = m1;
            matchMap[`${r+1}_${c}`] = m2;
          }
        }
      }
    } else {
      // Single red pair search
      for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < cols; c++) {
          if (targetCol !== null && c !== targetCol) continue;
          const val = grid[r]?.[c]?.val || '';
          if (isRedPair(val)) {
            const matchItem = { r, c, day: DAY_NAMES[c], rowNum: r + 1, val, reason: `Red Pair ${val} on ${DAY_NAMES[c]} (Row #${r+1})`, color: RED_MATCH_COLOR };
            matches.push(matchItem);
            matchMap[`${r}_${c}`] = matchItem;
          }
        }
      }
    }
  }

  // -------------------------------------------------------------
  // RULE 5: TOTAL / SUM / DIFFERENCE SEARCH
  // -------------------------------------------------------------
  else if (q.includes('total') || q.includes('sum') || q.includes('diff')) {
    const targetCol = foundDays.length > 0 ? foundDays[0].col : null;
    const totalMatch = q.match(/(?:total|sum)\s*(\d+)/);
    const diffMatch = q.match(/(?:diff|difference)\s*(\d+)/);

    const targetTotal = totalMatch ? parseInt(totalMatch[1]) : null;
    const targetDiff = diffMatch ? parseInt(diffMatch[1]) : null;

    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < cols; c++) {
        if (targetCol !== null && c !== targetCol) continue;
        const val = grid[r]?.[c]?.val || '';

        if (targetTotal !== null && calculateTotal(val) === targetTotal) {
          const matchItem = { r, c, day: DAY_NAMES[c], rowNum: r + 1, val, reason: `Total = ${targetTotal} (${val}) on ${DAY_NAMES[c]} (Row #${r+1})`, color: BLUE_MATCH_COLOR };
          matches.push(matchItem);
          matchMap[`${r}_${c}`] = matchItem;
        }

        if (targetDiff !== null && calculateDiffTotal(val) === targetDiff) {
          const matchItem = { r, c, day: DAY_NAMES[c], rowNum: r + 1, val, reason: `Difference = ${targetDiff} (${val}) on ${DAY_NAMES[c]} (Row #${r+1})`, color: PURPLE_MATCH_COLOR };
          matches.push(matchItem);
          matchMap[`${r}_${c}`] = matchItem;
        }
      }
    }
  }

  // -------------------------------------------------------------
  // RULE 6: FALLBACK SUBSTRING SEARCH
  // -------------------------------------------------------------
  else {
    const cleanSearchStr = q.replace(/find|search|where|is|the|number|in|of|and|next/g, '').trim();
    const targetCol = foundDays.length > 0 ? foundDays[0].col : null;

    if (cleanSearchStr.length > 0) {
      for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < cols; c++) {
          if (targetCol !== null && c !== targetCol) continue;
          const val = grid[r]?.[c]?.val || '';
          if (val && val.toLowerCase().includes(cleanSearchStr)) {
            const matchItem = { r, c, day: DAY_NAMES[c], rowNum: r + 1, val, reason: `Matched "${cleanSearchStr}" (${val}) on ${DAY_NAMES[c]} (Row #${r+1})`, color: HIGHLIGHT_COLOR };
            matches.push(matchItem);
            matchMap[`${r}_${c}`] = matchItem;
          }
        }
      }
    }
  }

  const summary = matches.length > 0
    ? `Found ${matches.length} matching cell${matches.length > 1 ? 's' : ''} for "${queryStr}"`
    : `No matches found for "${queryStr}". Try e.g. "find 91 in tues and next tues 92", "open 9 in mon", or "tuesday total 2".`;

  return { matches, summary, matchMap };
};
