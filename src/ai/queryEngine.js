/**
 * Ultra-Advanced Natural Language Query Engine for Matka Chart
 * Supports strict day filtering, multi-row offsets ("next 2nd row"), reverse total syntax ("sat 1 total"),
 * open/close digit constraints, and multi-step sequence chains.
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

  // 1. Detect explicit days mentioned in the query sentence
  const words = q.split(/\s+/);
  const foundDays = [];
  words.forEach(word => {
    const cleanWord = word.replace(/[^a-z]/g, '');
    if (DAY_MAP[cleanWord] !== undefined) {
      foundDays.push({ key: cleanWord, col: DAY_MAP[cleanWord] });
    }
  });

  // Extract explicit 2-digit numbers (e.g., "11", "70", "99", "94")
  const explicitNumberMatches = q.match(/\b\d{2}\b/g) || [];

  // Parse row offset (e.g. "next 2nd row" -> offset 2, "next 3rd row" -> offset 3, "next row" -> offset 1)
  let rowOffset = 1;
  const offsetMatch = q.match(/(?:next|after|following)?\s*(\d+)(?:st|nd|rd|th)?\s*row/) || q.match(/(\d+)\s*row[s]?\s*down/);
  if (offsetMatch) {
    rowOffset = parseInt(offsetMatch[1]);
  } else if (q.includes('next') || q.includes('then') || q.includes('after')) {
    rowOffset = 1;
  }

  // -------------------------------------------------------------
  // FEATURE A: MULTI-NUMBER / RELATIONAL SEQUENCE SEARCH
  // E.g. "find tuesday 11 and next tuesday 70"
  // E.g. "find sat 99 and next 2nd row 94"
  // -------------------------------------------------------------
  if (explicitNumberMatches.length >= 2) {
    const num1 = explicitNumberMatches[0];
    const num2 = explicitNumberMatches[1];

    const day1Col = foundDays.length > 0 ? foundDays[0].col : null;
    const day2Col = foundDays.length > 1 ? foundDays[1].col : (day1Col !== null ? day1Col : null);

    // Search for sequential chain: num1 at Row r (col1), num2 at Row r + rowOffset (col2)
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < cols; c++) {
        // STRICT DAY FILTER: If day1 specified, MUST match day1Col strictly!
        if (day1Col !== null && c !== day1Col) continue;
        const val1 = grid[r]?.[c]?.val || '';

        if (val1 === num1) {
          const targetR = r + rowOffset;
          const targetC = day2Col !== null ? day2Col : c;

          if (targetR < grid.length) {
            const val2 = grid[targetR]?.[targetC]?.val || '';
            if (val2 === num2) {
              // FOUND EXACT SEQUENCE MATCH! Highlight BOTH cells!
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
                reason: `Step 2 (+${rowOffset} row): ${val2} on ${DAY_NAMES[targetC]} (Row #${targetR+1})`,
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

    const summary = matches.length > 0
      ? `Found ${matches.length / 2} sequence match(es) for "${queryStr}" (${num1} ➔ ${num2})`
      : `No sequence match (${num1} ➔ ${num2}) found on ${day1Col !== null ? DAY_NAMES[day1Col] : 'the chart'}.`;

    return { matches, summary, matchMap };
  }

  // -------------------------------------------------------------
  // FEATURE B: TOTAL / SUM / DIFFERENCE SEARCH (FLEXIBLE SYNTAX)
  // E.g. "sat 1 total", "1 total in sat", "total 1 in sat", "tuesday 2 total"
  // -------------------------------------------------------------
  const isTotalQuery = q.includes('total') || q.includes('sum') || q.includes('diff');
  if (isTotalQuery) {
    const targetCol = foundDays.length > 0 ? foundDays[0].col : null;

    // Match both "total 1" AND "1 total" / "sum 2" AND "2 sum"
    const totalMatch = q.match(/(?:total|sum)\s*(\d+)/) || q.match(/(\d+)\s*(?:total|sum)/);
    const diffMatch = q.match(/(?:diff|difference)\s*(\d+)/) || q.match(/(\d+)\s*(?:diff|difference)/);

    const targetTotal = totalMatch ? parseInt(totalMatch[1]) : null;
    const targetDiff = diffMatch ? parseInt(diffMatch[1]) : null;

    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < cols; c++) {
        // STRICT DAY FILTER
        if (targetCol !== null && c !== targetCol) continue;
        const val = grid[r]?.[c]?.val || '';

        if (targetTotal !== null && val && /^\d{2}$/.test(val)) {
          const tot1 = calculateTotal(val); // (a+b)%10
          const tot2 = (parseInt(val[0]) + parseInt(val[1])) % 10;
          const tot3 = parseInt(val[0]) + parseInt(val[1]);

          if (tot1 === targetTotal || tot2 === targetTotal || tot3 === targetTotal) {
            const matchItem = {
              r, c,
              day: DAY_NAMES[c],
              rowNum: r + 1,
              val,
              reason: `Total = ${targetTotal} (${val}) on ${DAY_NAMES[c]} (Row #${r+1})`,
              color: BLUE_MATCH_COLOR
            };
            matches.push(matchItem);
            matchMap[`${r}_${c}`] = matchItem;
          }
        }

        if (targetDiff !== null && val && /^\d{2}$/.test(val)) {
          const diff = calculateDiffTotal(val);
          if (diff === targetDiff) {
            const matchItem = {
              r, c,
              day: DAY_NAMES[c],
              rowNum: r + 1,
              val,
              reason: `Difference = ${targetDiff} (${val}) on ${DAY_NAMES[c]} (Row #${r+1})`,
              color: PURPLE_MATCH_COLOR
            };
            matches.push(matchItem);
            matchMap[`${r}_${c}`] = matchItem;
          }
        }
      }
    }

    const summary = matches.length > 0
      ? `Found ${matches.length} cell(s) with Total = ${targetTotal ?? targetDiff} on ${targetCol !== null ? DAY_NAMES[targetCol] : 'chart'}`
      : `No cells found with Total = ${targetTotal ?? targetDiff} on ${targetCol !== null ? DAY_NAMES[targetCol] : 'chart'}.`;

    return { matches, summary, matchMap };
  }

  // -------------------------------------------------------------
  // FEATURE C: SINGLE NUMBER SEARCH WITH STRICT DAY FILTER
  // E.g. "find 56 in Mon" or "find 91 in tues"
  // -------------------------------------------------------------
  if (explicitNumberMatches.length === 1) {
    const numToFind = explicitNumberMatches[0];
    const targetCol = foundDays.length > 0 ? foundDays[0].col : null;

    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < cols; c++) {
        // STRICT DAY FILTER
        if (targetCol !== null && c !== targetCol) continue;
        const val = grid[r]?.[c]?.val || '';

        if (val === numToFind) {
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

          // If "next row" is mentioned, also highlight the target next row cell!
          if (q.includes('next') && r + rowOffset < grid.length) {
            const nextVal = grid[r + rowOffset]?.[c]?.val || '';
            if (nextVal) {
              const nextItem = {
                r: r + rowOffset, c,
                day: DAY_NAMES[c],
                rowNum: r + rowOffset + 1,
                val: nextVal,
                reason: `Follow-up (+${rowOffset} row): ${nextVal} on ${DAY_NAMES[c]} (Row #${r+rowOffset+1})`,
                color: GREEN_MATCH_COLOR
              };
              matches.push(nextItem);
              matchMap[`${r+rowOffset}_${c}`] = nextItem;
            }
          }
        }
      }
    }

    const summary = matches.length > 0
      ? `Found ${matches.length} matching cell(s) for "${queryStr}"`
      : `No matches found for number ${numToFind} on ${targetCol !== null ? DAY_NAMES[targetCol] : 'chart'}.`;

    return { matches, summary, matchMap };
  }

  // -------------------------------------------------------------
  // FEATURE D: OPEN / CLOSE DIGIT SEARCH
  // E.g. "open 9 in mon", "close 2 in tuesday", "tue open 8"
  // -------------------------------------------------------------
  if (q.includes('open') || q.includes('close')) {
    const targetCol = foundDays.length > 0 ? foundDays[0].col : null;
    const openMatch = q.match(/open[s]?\s*(\d)/) || q.match(/(\d)\s*open[s]?/);
    const closeMatch = q.match(/close[s]?\s*(\d)/) || q.match(/(\d)\s*close[s]?/);

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

    const summary = matches.length > 0
      ? `Found ${matches.length} matching cell(s) for "${queryStr}"`
      : `No matching Open/Close digits found for "${queryStr}".`;

    return { matches, summary, matchMap };
  }

  // -------------------------------------------------------------
  // FEATURE E: RED PAIRS SEARCH (STRICT DAY SUPPORT)
  // E.g. "red numbers on tuesday", "sat red pairs"
  // -------------------------------------------------------------
  if (q.includes('red')) {
    const targetCol = foundDays.length > 0 ? foundDays[0].col : null;
    const isConsecutive = q.includes('consecutive') || q.includes('next') || q.includes('same row') || q.includes('column');

    if (isConsecutive) {
      for (let c = 0; c < cols; c++) {
        if (targetCol !== null && c !== targetCol) continue;
        for (let r = 0; r < grid.length - rowOffset; r++) {
          const val1 = grid[r]?.[c]?.val || '';
          const val2 = grid[r + rowOffset]?.[c]?.val || '';
          if (isRedPair(val1) && isRedPair(val2)) {
            const m1 = { r, c, day: DAY_NAMES[c], rowNum: r + 1, val: val1, reason: `Red Pair ${val1} (Row #${r+1}) ➔ ${val2} (Row #${r+1+rowOffset})`, color: RED_MATCH_COLOR };
            const m2 = { r: r + rowOffset, c, day: DAY_NAMES[c], rowNum: r + 1 + rowOffset, val: val2, reason: `Red Pair ${val1} (Row #${r+1}) ➔ ${val2} (Row #${r+1+rowOffset})`, color: RED_MATCH_COLOR };
            matches.push(m1, m2);
            matchMap[`${r}_${c}`] = m1;
            matchMap[`${r+rowOffset}_${c}`] = m2;
          }
        }
      }
    } else {
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

    const summary = matches.length > 0
      ? `Found ${matches.length} Red Pair cell(s) on ${targetCol !== null ? DAY_NAMES[targetCol] : 'chart'}`
      : `No Red Pairs found on ${targetCol !== null ? DAY_NAMES[targetCol] : 'chart'}.`;

    return { matches, summary, matchMap };
  }

  // -------------------------------------------------------------
  // FEATURE F: GENERAL DAY / SUBSTRING FALLBACK
  // E.g. "find tuesday" or "sat"
  // -------------------------------------------------------------
  const targetCol = foundDays.length > 0 ? foundDays[0].col : null;
  const cleanSearchStr = q.replace(/find|search|where|is|the|number|in|of|and|next/g, '').trim();

  if (targetCol !== null && cleanSearchStr.length === 0) {
    for (let r = 0; r < grid.length; r++) {
      const val = grid[r]?.[targetCol]?.val || '';
      if (val) {
        const matchItem = { r, c: targetCol, day: DAY_NAMES[targetCol], rowNum: r + 1, val, reason: `Value ${val} on ${DAY_NAMES[targetCol]} (Row #${r+1})`, color: HIGHLIGHT_COLOR };
        matches.push(matchItem);
        matchMap[`${r}_${targetCol}`] = matchItem;
      }
    }
  } else if (cleanSearchStr.length > 0) {
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

  const summary = matches.length > 0
    ? `Found ${matches.length} matching cell(s) for "${queryStr}"`
    : `No matches found for "${queryStr}". Try e.g. "find tuesday 11 and next tuesday 70", "find sat 99 and next 2nd row 94", or "sat 1 total".`;

  return { matches, summary, matchMap };
};
