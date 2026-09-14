/**
 * Ultra-Advanced Natural Language Query Engine for Matka Chart
 * Supports strict day filtering, multi-row ordinal offsets ("71 after next 3 at 81"),
 * compound open & close UP/DOWN engine ("thu open to open 2 down and close to close is 4 down"),
 * single UP/DOWN relationship engine, strict same-row/same-col matching,
 * and star holiday filtering (** / * / XX are holidays, not red pairs).
 */
import { isRedPair, isHoliday, calculateTotal, calculateDiffTotal, calculateCN, calculateCloseCond } from '../context/ChartContext';

const DAY_MAP = {
  mon: 0, monday: 0, mo: 0,
  tue: 1, tuesday: 1, tu: 1, tues: 1,
  wed: 2, wednesday: 2, we: 2,
  thu: 3, thursday: 3, th: 3, thur: 3, thurs: 3,
  fri: 4, friday: 4, fr: 4,
  sat: 5, saturday: 5, sa: 5,
  sun: 6, sunday: 6, su: 6, sund: 6
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
      if (!foundDays.some(d => d.col === DAY_MAP[cleanWord])) {
        foundDays.push({ key: cleanWord, col: DAY_MAP[cleanWord] });
      }
    }
  });

  // Extract explicit 2-digit numbers
  const explicitNumberMatches = q.match(/\b\d{2}\b/g) || [];

  // Parse default row offset
  let rowOffset = 1;
  const offsetMatch = q.match(/(?:next|after|following)?\s*(\d+)(?:st|nd|rd|th)?\s*row/) || q.match(/(\d+)\s*row[s]?\s*down/);
  if (offsetMatch) {
    rowOffset = parseInt(offsetMatch[1]);
  } else if (q.includes('next') || q.includes('then') || q.includes('after')) {
    rowOffset = 1;
  }

  // -------------------------------------------------------------
  // FEATURE 0: COMPOUND OPEN & CLOSE UP/DOWN ENGINE
  // E.g. "thu open to open 2 down and close to close is 4 down"
  // E.g. "open to open 1 up and close to close 2 down same row"
  // -------------------------------------------------------------
  const hasOpenClause = q.includes('open');
  const hasCloseClause = q.includes('close');
  const hasUpDown = q.includes('up') || q.includes('down');

  if (hasOpenClause && hasCloseClause && hasUpDown) {
    let openStep = null;
    const openMatch = q.match(/open[a-z\s]*?(\d+)\s*(up|down)/) || q.match(/(up|down)\s*(\d+)[a-z\s]*?open/);
    if (openMatch) {
      const num = parseInt(openMatch[1] || openMatch[2]);
      const dir = (openMatch[2] || openMatch[1]).toLowerCase();
      openStep = dir === 'down' ? -num : num;
    }

    let closeStep = null;
    const closeMatch = q.match(/close[a-z\s]*?(\d+)\s*(up|down)/) || q.match(/(up|down)\s*(\d+)[a-z\s]*?close/);
    if (closeMatch) {
      const num = parseInt(closeMatch[1] || closeMatch[2]);
      const dir = (closeMatch[2] || closeMatch[1]).toLowerCase();
      closeStep = dir === 'down' ? -num : num;
    }

    const targetCols = foundDays.map(d => d.col);
    const colsToScan = targetCols.length > 0 ? targetCols : Array.from({ length: cols }, (_, i) => i);

    const isSameRow = q.includes('same row');
    const isSameCol = q.includes('same col') || q.includes('same column') || targetCols.length > 0;

    if (isSameCol && !isSameRow) {
      colsToScan.forEach(c => {
        for (let r = 0; r < grid.length - rowOffset; r++) {
          const val1 = grid[r]?.[c]?.val || '';
          const val2 = grid[r + rowOffset]?.[c]?.val || '';
          if (!val1 || !val2 || !/^\d{2}$/.test(val1) || !/^\d{2}$/.test(val2)) continue;

          const o1 = parseInt(val1[0]), o2 = parseInt(val2[0]);
          const c1 = parseInt(val1[1]), c2 = parseInt(val2[1]);

          const isOOk = openStep === null || (o1 + openStep + 10) % 10 === o2;
          const isCOk = closeStep === null || (c1 + closeStep + 10) % 10 === c2;

          if (isOOk && isCOk) {
            const m1 = { r, c, day: DAY_NAMES[c], rowNum: r + 1, val: val1, reason: `${DAY_NAMES[c]} Open ${openStep ? (openStep>0?`+${openStep}`:openStep) : ''} & Close ${closeStep ? (closeStep>0?`+${closeStep}`:closeStep) : ''} (${val1} ➔ ${val2}) Row #${r+1}`, color: BLUE_MATCH_COLOR };
            const m2 = { r: r + rowOffset, c, day: DAY_NAMES[c], rowNum: r + 1 + rowOffset, val: val2, reason: `${DAY_NAMES[c]} Open ${openStep ? (openStep>0?`+${openStep}`:openStep) : ''} & Close ${closeStep ? (closeStep>0?`+${closeStep}`:closeStep) : ''} (${val1} ➔ ${val2}) Row #${r+1+rowOffset}`, color: BLUE_MATCH_COLOR };
            matches.push(m1, m2);
            matchMap[`${r}_${c}`] = m1;
            matchMap[`${r+rowOffset}_${c}`] = m2;
          }
        }
      });
    } else if (isSameRow) {
      for (let r = 0; r < grid.length; r++) {
        for (let i = 0; i < colsToScan.length; i++) {
          const c1 = colsToScan[i];
          const val1 = grid[r]?.[c1]?.val || '';
          if (!val1 || !/^\d{2}$/.test(val1)) continue;

          for (let j = i + 1; j < colsToScan.length; j++) {
            const c2 = colsToScan[j];
            const val2 = grid[r]?.[c2]?.val || '';
            if (!val2 || !/^\d{2}$/.test(val2)) continue;

            const o1 = parseInt(val1[0]), o2 = parseInt(val2[0]);
            const cl1 = parseInt(val1[1]), cl2 = parseInt(val2[1]);

            const isOOk = openStep === null || (o1 + openStep + 10) % 10 === o2;
            const isCOk = closeStep === null || (cl1 + closeStep + 10) % 10 === cl2;

            if (isOOk && isCOk) {
              const m1 = { r, c: c1, day: DAY_NAMES[c1], rowNum: r + 1, val: val1, reason: `Same Row Open/Close match (${val1} & ${val2}) Row #${r+1}`, color: BLUE_MATCH_COLOR };
              const m2 = { r, c: c2, day: DAY_NAMES[c2], rowNum: r + 1, val: val2, reason: `Same Row Open/Close match (${val1} & ${val2}) Row #${r+1}`, color: BLUE_MATCH_COLOR };
              matches.push(m1, m2);
              matchMap[`${r}_${c1}`] = m1;
              matchMap[`${r}_${c2}`] = m2;
            }
          }
        }
      }
    }

    if (matches.length > 0) {
      const summary = `Found ${matches.length} matching cell(s) for "${queryStr}"`;
      return { matches, summary, matchMap };
    }
  }

  // -------------------------------------------------------------
  // FEATURE 0.5: SINGLE UP / DOWN DIGIT RELATIONSHIP ENGINE
  // -------------------------------------------------------------
  if (hasUpDown) {
    let step = 1;
    if (q.includes('two up') || q.includes('2 up') || q.includes('double up')) step = 2;
    else if (q.includes('three up') || q.includes('3 up')) step = 3;
    else if (q.includes('four up') || q.includes('4 up')) step = 4;
    else if (q.includes('two down') || q.includes('2 down') || q.includes('double down')) step = -2;
    else if (q.includes('three down') || q.includes('3 down')) step = -3;
    else if (q.includes('four down') || q.includes('4 down')) step = -4;
    else if (isDownQuery) step = -1;
    else step = 1;

    const isCloseToClose = q.includes('close to close') || q.includes('close-to-close');
    const isOpenToClose = q.includes('open to close') || q.includes('open-to-close');
    const isCloseToOpen = q.includes('close to open') || q.includes('close-to-open');
    const isOpenToOpen = !isCloseToClose && !isOpenToClose && !isCloseToOpen;

    const isSameCol = q.includes('same col') || q.includes('same column') || foundDays.length > 0;
    const isSameRow = q.includes('same row') && !q.includes('same col');

    const targetCols = foundDays.map(d => d.col);

    if (isSameCol) {
      const colsToScan = targetCols.length > 0 ? targetCols : Array.from({ length: cols }, (_, i) => i);
      colsToScan.forEach(c => {
        for (let r = 0; r < grid.length - rowOffset; r++) {
          const val1 = grid[r]?.[c]?.val || '';
          const val2 = grid[r + rowOffset]?.[c]?.val || '';
          if (!val1 || !val2 || !/^\d{2}$/.test(val1) || !/^\d{2}$/.test(val2)) continue;

          let d1 = 0, d2 = 0, typeLabel = '';
          if (isOpenToOpen) {
            d1 = parseInt(val1[0]); d2 = parseInt(val2[0]);
            typeLabel = 'Open-to-Open';
          } else if (isCloseToClose) {
            d1 = parseInt(val1[1]); d2 = parseInt(val2[1]);
            typeLabel = 'Close-to-Close';
          } else if (isOpenToClose) {
            d1 = parseInt(val1[0]); d2 = parseInt(val2[1]);
            typeLabel = 'Open-to-Close';
          } else if (isCloseToOpen) {
            d1 = parseInt(val1[1]); d2 = parseInt(val2[0]);
            typeLabel = 'Close-to-Open';
          }

          const targetD2 = (d1 + step + 10) % 10;
          if (d2 === targetD2) {
            const labelStr = step > 0 ? `${step} Up` : `${Math.abs(step)} Down`;
            const m1 = { r, c, day: DAY_NAMES[c], rowNum: r + 1, val: val1, reason: `${labelStr} ${typeLabel} (${d1} ➔ ${d2}) on ${DAY_NAMES[c]} (Row #${r+1})`, color: PURPLE_MATCH_COLOR };
            const m2 = { r: r + rowOffset, c, day: DAY_NAMES[c], rowNum: r + 1 + rowOffset, val: val2, reason: `${labelStr} ${typeLabel} (${d1} ➔ ${d2}) on ${DAY_NAMES[c]} (Row #${r+1+rowOffset})`, color: PURPLE_MATCH_COLOR };
            matches.push(m1, m2);
            matchMap[`${r}_${c}`] = m1;
            matchMap[`${r+rowOffset}_${c}`] = m2;
          }
        }
      });
    }

    if (matches.length > 0) {
      const summary = `Found ${matches.length} matching cell(s) for "${queryStr}"`;
      return { matches, summary, matchMap };
    }
  }

  // -------------------------------------------------------------
  // FEATURE 0.6: OPEN TO OPEN / CLOSE TO CLOSE PROCESSOR
  // -------------------------------------------------------------
  const isOpenToOpen = q.includes('open to open') || q.includes('open-to-open') || q.includes('open 2 open') || q.includes('open to close') || q.includes('close to close') || q.includes('close-to-close');

  if (isOpenToOpen) {
    const isCloseToClose = q.includes('close to close') || q.includes('close-to-close');
    const isOpenToClose = q.includes('open to close') || q.includes('close to open');

    const singleDigitMatch = q.match(/\b\d\b/);
    const targetDigit = singleDigitMatch ? singleDigitMatch[0] : null;

    const targetCols = foundDays.map(d => d.col);
    const colsToScan = targetCols.length > 0 ? targetCols : Array.from({ length: cols }, (_, i) => i);

    for (let r = 0; r < grid.length; r++) {
      if (isCloseToClose) {
        if (targetDigit !== null) {
          const matchCols = colsToScan.filter(c => grid[r]?.[c]?.val && grid[r][c].val[1] === targetDigit);
          if (matchCols.length >= 2) {
            matchCols.forEach(c => {
              const val = grid[r][c].val;
              const m = { r, c, day: DAY_NAMES[c], rowNum: r + 1, val, reason: `Close-to-Close Digit ${targetDigit} (${val}) on ${DAY_NAMES[c]} (Row #${r+1})`, color: BLUE_MATCH_COLOR };
              matches.push(m);
              matchMap[`${r}_${c}`] = m;
            });
          }
        } else {
          for (let d = 0; d <= 9; d++) {
            const digitStr = d.toString();
            const matchCols = colsToScan.filter(c => grid[r]?.[c]?.val && grid[r][c].val[1] === digitStr);
            if (matchCols.length >= 2) {
              matchCols.forEach(c => {
                const val = grid[r][c].val;
                const m = { r, c, day: DAY_NAMES[c], rowNum: r + 1, val, reason: `Close-to-Close Digit ${digitStr} (${val}) on ${DAY_NAMES[c]} (Row #${r+1})`, color: BLUE_MATCH_COLOR };
                matches.push(m);
                matchMap[`${r}_${c}`] = m;
              });
            }
          }
        }
      } else if (isOpenToClose) {
        for (let c1 = 0; c1 < colsToScan.length; c1++) {
          const col1 = colsToScan[c1];
          const val1 = grid[r]?.[col1]?.val || '';
          if (!val1 || !/^\d{2}$/.test(val1)) continue;

          for (let c2 = c1 + 1; c2 < colsToScan.length; c2++) {
            const col2 = colsToScan[c2];
            const val2 = grid[r]?.[col2]?.val || '';
            if (!val2 || !/^\d{2}$/.test(val2)) continue;

            if (val1[0] === val2[1] || val1[1] === val2[0]) {
              const m1 = { r, c: col1, day: DAY_NAMES[col1], rowNum: r + 1, val: val1, reason: `Open-to-Close match (${val1} & ${val2}) Row #${r+1}`, color: PURPLE_MATCH_COLOR };
              const m2 = { r, c: col2, day: DAY_NAMES[col2], rowNum: r + 1, val: val2, reason: `Open-to-Close match (${val1} & ${val2}) Row #${r+1}`, color: PURPLE_MATCH_COLOR };
              matches.push(m1, m2);
              matchMap[`${r}_${col1}`] = m1;
              matchMap[`${r}_${col2}`] = m2;
            }
          }
        }
      } else {
        if (targetDigit !== null) {
          const matchCols = colsToScan.filter(c => grid[r]?.[c]?.val && grid[r][c].val[0] === targetDigit);
          if (matchCols.length >= 2) {
            matchCols.forEach(c => {
              const val = grid[r][c].val;
              const m = { r, c, day: DAY_NAMES[c], rowNum: r + 1, val, reason: `Open-to-Open Digit ${targetDigit} (${val}) on ${DAY_NAMES[c]} (Row #${r+1})`, color: BLUE_MATCH_COLOR };
              matches.push(m);
              matchMap[`${r}_${c}`] = m;
            });
          }
        } else {
          for (let d = 0; d <= 9; d++) {
            const digitStr = d.toString();
            const matchCols = colsToScan.filter(c => grid[r]?.[c]?.val && grid[r][c].val[0] === digitStr);
            if (matchCols.length >= 2) {
              matchCols.forEach(c => {
                const val = grid[r][c].val;
                const m = { r, c, day: DAY_NAMES[c], rowNum: r + 1, val, reason: `Open-to-Open Digit ${digitStr} (${val}) on ${DAY_NAMES[c]} (Row #${r+1})`, color: BLUE_MATCH_COLOR };
                matches.push(m);
                matchMap[`${r}_${c}`] = m;
              });
            }
          }
        }
      }
    }

    const summary = matches.length > 0
      ? `Found ${matches.length} matching cell(s) for "${queryStr}"`
      : `No multi-cell matches found for "${queryStr}".`;

    return { matches, summary, matchMap };
  }

  // -------------------------------------------------------------
  // FEATURE 1: STRICT SAME ROW QUERY PROCESSOR
  // -------------------------------------------------------------
  const isSameRowQuery = q.includes('same row') || q.includes('in same row') || q.includes('row same');
  const isSameColQuery = (q.includes('same col') || q.includes('same column') || q.includes('in same col') || q.includes('col same')) && !isSameRowQuery;

  if (isSameRowQuery) {
    const numToFind = explicitNumberMatches.length > 0 ? explicitNumberMatches[0] : null;
    const targetCols = foundDays.map(d => d.col);

    const timesMatch = q.match(/(\d+)\s*(?:times|x|repeat[s]?)/);
    const requiredTimes = timesMatch ? parseInt(timesMatch[1]) : 2;

    for (let r = 0; r < grid.length; r++) {
      if (numToFind) {
        if (targetCols.length >= 2) {
          const allMatch = targetCols.every(c => grid[r]?.[c]?.val === numToFind);
          if (allMatch) {
            targetCols.forEach(c => {
              const m = {
                r, c,
                day: DAY_NAMES[c],
                rowNum: r + 1,
                val: numToFind,
                reason: `Same Row ${numToFind} on ${targetCols.map(tc => DAY_NAMES[tc]).join(' & ')} (Row #${r+1})`,
                color: GREEN_MATCH_COLOR
              };
              matches.push(m);
              matchMap[`${r}_${c}`] = m;
            });
          }
        } else {
          const matchingCols = [];
          for (let c = 0; c < cols; c++) {
            if (targetCols.length > 0 && !targetCols.includes(c)) continue;
            if (grid[r]?.[c]?.val === numToFind) matchingCols.push(c);
          }
          if (matchingCols.length >= requiredTimes) {
            matchingCols.forEach(c => {
              const m = {
                r, c,
                day: DAY_NAMES[c],
                rowNum: r + 1,
                val: numToFind,
                reason: `Same Row repeat (${matchingCols.length}x) ${numToFind} on ${DAY_NAMES[c]} (Row #${r+1})`,
                color: GREEN_MATCH_COLOR
              };
              matches.push(m);
              matchMap[`${r}_${c}`] = m;
            });
          }
        }
      } else if (q.includes('red')) {
        const redCols = [];
        for (let c = 0; c < cols; c++) {
          if (targetCols.length > 0 && !targetCols.includes(c)) continue;
          if (isRedPair(grid[r]?.[c]?.val)) redCols.push(c);
        }
        if (redCols.length >= 2) {
          redCols.forEach(c => {
            const m = { r, c, day: DAY_NAMES[c], rowNum: r + 1, val: grid[r][c].val, reason: `Same Row Red Pair ${grid[r][c].val} (Row #${r+1})`, color: RED_MATCH_COLOR };
            matches.push(m);
            matchMap[`${r}_${c}`] = m;
          });
        }
      }
    }

    const summary = matches.length > 0
      ? `Found ${matches.length} matching cell(s) for "${queryStr}"`
      : `No matching cells found where ${numToFind || 'number'} appears ${requiredTimes} times in the same row.`;

    return { matches, summary, matchMap };
  }

  // -------------------------------------------------------------
  // FEATURE 2: STRICT SAME COL QUERY PROCESSOR
  // -------------------------------------------------------------
  if (isSameColQuery) {
    const numToFind = explicitNumberMatches.length > 0 ? explicitNumberMatches[0] : null;
    const targetCols = foundDays.map(d => d.col);
    const colsToScan = targetCols.length > 0 ? targetCols : Array.from({ length: cols }, (_, i) => i);

    const timesMatch = q.match(/(\d+)\s*(?:times|x|row[s]?|repeat[s]?)/) || q.match(/(?:repeat[s]?|times)\s*(\d+)/);
    const countN = timesMatch ? parseInt(timesMatch[1]) : 2;
    const isStrictConsecutive = q.includes('times') || q.includes('consecutive') || q.includes('next row');

    let matchedAny = false;

    colsToScan.forEach(c => {
      if (numToFind) {
        if (isStrictConsecutive) {
          for (let r = 0; r <= grid.length - countN; r++) {
            let isConsecutiveMatch = true;
            for (let k = 0; k < countN; k++) {
              if (grid[r + k]?.[c]?.val !== numToFind) {
                isConsecutiveMatch = false;
                break;
              }
            }
            if (isConsecutiveMatch) {
              matchedAny = true;
              for (let k = 0; k < countN; k++) {
                const rowIdx = r + k;
                const m = {
                  r: rowIdx, c,
                  day: DAY_NAMES[c],
                  rowNum: rowIdx + 1,
                  val: numToFind,
                  reason: `${numToFind} ${countN} Consecutive Times on ${DAY_NAMES[c]} (Row #${rowIdx+1})`,
                  color: GREEN_MATCH_COLOR
                };
                matches.push(m);
                matchMap[`${rowIdx}_${c}`] = m;
              }
            }
          }
        } else {
          const matchingRows = [];
          for (let r = 0; r < grid.length; r++) {
            if (grid[r]?.[c]?.val === numToFind) matchingRows.push(r);
          }
          if (matchingRows.length >= countN) {
            matchedAny = true;
            matchingRows.forEach(r => {
              const m = {
                r, c,
                day: DAY_NAMES[c],
                rowNum: r + 1,
                val: numToFind,
                reason: `Same Column repeat ${numToFind} on ${DAY_NAMES[c]} (Row #${r+1})`,
                color: GREEN_MATCH_COLOR
              };
              matches.push(m);
              matchMap[`${r}_${c}`] = m;
            });
          }
        }
      }
    });

    if (matchedAny) {
      const summary = `Found ${matches.length} matching cell(s) for "${queryStr}"`;
      return { matches, summary, matchMap };
    }
  }

  // -------------------------------------------------------------
  // FEATURE 3: MULTI-NUMBER / RELATIONAL SEQUENCE SEARCH
  // -------------------------------------------------------------
  if (explicitNumberMatches.length >= 2) {
    const num1 = explicitNumberMatches[0];
    const num2 = explicitNumberMatches[1];

    const day1Col = foundDays.length > 0 ? foundDays[0].col : null;
    const day2Col = foundDays.length > 1 ? foundDays[1].col : (day1Col !== null ? day1Col : null);

    const numOffsetMatch = q.match(/(?:next|after|following)?\s*(\d+)(?:st|nd|rd|th)?/);
    let candidateOffsets = [rowOffset];

    if (numOffsetMatch) {
      const parsedN = parseInt(numOffsetMatch[1]);
      if (parsedN > 1 && parsedN < 50) {
        candidateOffsets = [parsedN - 1, parsedN];
      }
    }

    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < cols; c++) {
        if (day1Col !== null && c !== day1Col) continue;
        const val1 = grid[r]?.[c]?.val || '';

        if (val1 === num1) {
          candidateOffsets.forEach(off => {
            const targetR = r + off;
            const targetC = day2Col !== null ? day2Col : c;

            if (targetR < grid.length) {
              const val2 = grid[targetR]?.[targetC]?.val || '';
              if (val2 === num2) {
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
                  reason: `Step 2 (+${off} rows): ${val2} on ${DAY_NAMES[targetC]} (Row #${targetR+1})`,
                  color: GREEN_MATCH_COLOR
                };
                matches.push(m1, m2);
                matchMap[`${r}_${c}`] = m1;
                matchMap[`${targetR}_${targetC}`] = m2;
              }
            }
          });
        }
      }
    }

    const summary = matches.length > 0
      ? `Found ${matches.length / 2} sequence match(es) for "${queryStr}" (${num1} ➔ ${num2})`
      : `No sequence match (${num1} ➔ ${num2}) found on ${day1Col !== null ? DAY_NAMES[day1Col] : 'the chart'}.`;

    return { matches, summary, matchMap };
  }

  // -------------------------------------------------------------
  // FEATURE 4: TOTAL / SUM / DIFFERENCE SEARCH
  // -------------------------------------------------------------
  const isTotalQuery = q.includes('total') || q.includes('sum') || q.includes('diff');
  if (isTotalQuery) {
    const targetCol = foundDays.length > 0 ? foundDays[0].col : null;

    const totalMatch = q.match(/(?:total|sum)\s*(\d+)/) || q.match(/(\d+)\s*(?:total|sum)/);
    const diffMatch = q.match(/(?:diff|difference)\s*(\d+)/) || q.match(/(\d+)\s*(?:diff|difference)/);

    const targetTotal = totalMatch ? parseInt(totalMatch[1]) : null;
    const targetDiff = diffMatch ? parseInt(diffMatch[1]) : null;

    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < cols; c++) {
        if (targetCol !== null && c !== targetCol) continue;
        const val = grid[r]?.[c]?.val || '';

        if (targetTotal !== null && val && /^\d{2}$/.test(val)) {
          const tot1 = calculateTotal(val);
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
  // FEATURE 5: SINGLE NUMBER SEARCH WITH STRICT DAY FILTER
  // -------------------------------------------------------------
  if (explicitNumberMatches.length === 1) {
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
            reason: `Found ${val} on ${DAY_NAMES[c]} (Row #${r+1})`,
            color: isRedPair(val) ? RED_MATCH_COLOR : HIGHLIGHT_COLOR
          };
          matches.push(matchItem);
          matchMap[`${r}_${c}`] = matchItem;

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
  // FEATURE 6: SINGLE OPEN / CLOSE DIGIT SEARCH
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
  // FEATURE 7: RED PAIRS SEARCH
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
  // FEATURE 8: GENERAL DAY / SUBSTRING FALLBACK
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
    : `No matches found for "${queryStr}". Try e.g. "thu open to open 2 down and close to close is 4 down", "71 after next 3 at 81", or "one up open to open same row".`;

  return { matches, summary, matchMap };
};
