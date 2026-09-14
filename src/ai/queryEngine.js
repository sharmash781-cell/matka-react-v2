/**
 * Ultra-Advanced Natural Language Query Engine for Matka Chart
 * Features:
 * - Ordinal Week Target Day Search ("fri 16 4rd week saturday" -> Row 2 Fri 16 ➔ Row 5 Sat 59)
 * - Same & Opposite (Cut Digit) Engine ("thu open to open same and close to close opposite")
 * - Ordinal Column/Row offsets ("4rd thu", "next 3rd thursday")
 * - Multi-Step Sentence Chain Parser ("thursday 88 next 3rd thursday 64...")
 * - Statistical Outcome Predictor ("what mostly came after 88 in thursday")
 * - Compound Open/Close UP & DOWN Engine
 * - Strict Same Row vs Same Col Disambiguation
 * - Holiday Filtering (** / * / XX are holidays, not red pairs)
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

const parseRelation = (textStr) => {
  if (!textStr) return null;
  const lower = textStr.toLowerCase();

  if (lower.includes('opposite') || lower.includes('cut') || lower.includes('family')) {
    return { type: 'OPPOSITE' };
  }
  if (lower.includes('same')) {
    return { type: 'SAME' };
  }

  const upMatch = lower.match(/(\d+)?\s*up/);
  if (upMatch) {
    const step = upMatch[1] ? parseInt(upMatch[1]) : 1;
    return { type: 'UP', step };
  }

  const downMatch = lower.match(/(\d+)?\s*down/);
  if (downMatch) {
    const step = downMatch[1] ? parseInt(downMatch[1]) : 1;
    return { type: 'DOWN', step };
  }

  return null;
};

const checkDigitRelation = (d1, d2, rel) => {
  if (!rel) return true;
  if (rel.type === 'SAME') return d1 === d2;
  if (rel.type === 'OPPOSITE') return d2 === (d1 + 5) % 10;
  if (rel.type === 'UP') return d2 === (d1 + rel.step + 10) % 10;
  if (rel.type === 'DOWN') return d2 === (d1 - rel.step + 10) % 10;
  return true;
};

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

  // Parse default row offset or ordinal (e.g. "4rd thu", "4th thu", "4rd week")
  let rowOffset = 1;
  const ordMatch = q.match(/(\d+)(?:st|nd|rd|th)/);
  if (ordMatch) {
    rowOffset = parseInt(ordMatch[1]) - 1; // 4th -> +3 rows
  } else {
    const offsetMatch = q.match(/(?:next|after|following)?\s*(\d+)(?:st|nd|rd|th)?\s*row/) || q.match(/(\d+)\s*row[s]?\s*down/);
    if (offsetMatch) {
      rowOffset = parseInt(offsetMatch[1]);
    } else if (q.includes('next') || q.includes('then') || q.includes('after')) {
      rowOffset = 1;
    }
  }

  // -------------------------------------------------------------
  // FEATURE 0: ORDINAL WEEK TARGET DAY RELATIONAL SEARCH
  // E.g. "fri 16 4rd week saturday" -> Row 2 Fri 16 ➔ Row 5 Sat 59
  // -------------------------------------------------------------
  if (foundDays.length >= 1 && explicitNumberMatches.length === 1 && (q.includes('week') || ordMatch)) {
    const startDayCol = foundDays[0].col;
    const targetDayCol = foundDays.length >= 2 ? foundDays[1].col : startDayCol;
    const numToFind = explicitNumberMatches[0];

    let weekOffset = rowOffset;
    if (ordMatch) {
      weekOffset = parseInt(ordMatch[1]) - 1;
    } else {
      const wMatch = q.match(/(\d+)(?:st|nd|rd|th)?\s*week/);
      if (wMatch) weekOffset = parseInt(wMatch[1]) - 1;
    }

    for (let r = 0; r < grid.length; r++) {
      if (grid[r]?.[startDayCol]?.val === numToFind) {
        const targetR = r + weekOffset;
        if (targetR < grid.length) {
          const targetVal = grid[targetR]?.[targetDayCol]?.val || '';
          if (targetVal) {
            const m1 = {
              r, c: startDayCol,
              day: DAY_NAMES[startDayCol],
              rowNum: r + 1,
              val: numToFind,
              reason: `Start: ${DAY_NAMES[startDayCol]} ${numToFind} (Row #${r+1})`,
              color: HIGHLIGHT_COLOR
            };
            const m2 = {
              r: targetR, c: targetDayCol,
              day: DAY_NAMES[targetDayCol],
              rowNum: targetR + 1,
              val: targetVal,
              reason: `${weekOffset + 1}th Week ${DAY_NAMES[targetDayCol]}: ${targetVal} (Row #${targetR+1})`,
              color: GREEN_MATCH_COLOR
            };
            matches.push(m1, m2);
            matchMap[`${r}_${startDayCol}`] = m1;
            matchMap[`${targetR}_${targetDayCol}`] = m2;
          }
        }
      }
    }

    if (matches.length > 0) {
      const summary = `Found ${matches.length / 2} ordinal week match(es) for "${queryStr}"`;
      return { matches, summary, matchMap };
    }
  }

  // -------------------------------------------------------------
  // FEATURE 0.5: DIGIT RELATIONSHIPS ENGINE (SAME / OPPOSITE / UP / DOWN)
  // E.g. "thu open to open same and close to close opposite"
  // -------------------------------------------------------------
  const hasOpenClause = q.includes('open');
  const hasCloseClause = q.includes('close');
  const hasRelationKeyword = q.includes('same') || q.includes('opposite') || q.includes('cut') || q.includes('up') || q.includes('down');

  if ((hasOpenClause || hasCloseClause) && hasRelationKeyword) {
    const openSubstr = q.match(/open[a-z\s]*?(same|opposite|cut|family|\d*\s*up|\d*\s*down)/);
    const closeSubstr = q.match(/close[a-z\s]*?(same|opposite|cut|family|\d*\s*up|\d*\s*down)/);

    const openRel = openSubstr ? parseRelation(openSubstr[0]) : (hasOpenClause ? parseRelation(q) : null);
    const closeRel = closeSubstr ? parseRelation(closeSubstr[0]) : (hasCloseClause ? parseRelation(q) : null);

    const targetCols = foundDays.map(d => d.col);
    const colsToScan = targetCols.length > 0 ? targetCols : Array.from({ length: cols }, (_, i) => i);

    const isSameRow = q.includes('same row');
    const isSameCol = q.includes('same col') || q.includes('same column') || targetCols.length > 0;

    let candidateOffsets = [rowOffset > 0 ? rowOffset : 1];
    if (ordMatch) {
      const parsedN = parseInt(ordMatch[1]);
      candidateOffsets = Array.from(new Set([parsedN - 1, parsedN, 1].filter(x => x > 0)));
    }

    if (isSameCol && !isSameRow) {
      colsToScan.forEach(c => {
        candidateOffsets.forEach(off => {
          for (let r = 0; r < grid.length - off; r++) {
            const val1 = grid[r]?.[c]?.val || '';
            const val2 = grid[r + off]?.[c]?.val || '';
            if (!val1 || !val2 || !/^\d{2}$/.test(val1) || !/^\d{2}$/.test(val2)) continue;

            const o1 = parseInt(val1[0]), o2 = parseInt(val2[0]);
            const c1 = parseInt(val1[1]), c2 = parseInt(val2[1]);

            const isOOk = checkDigitRelation(o1, o2, openRel);
            const isCOk = checkDigitRelation(c1, c2, closeRel);

            if (isOOk && isCOk) {
              const m1 = { r, c, day: DAY_NAMES[c], rowNum: r + 1, val: val1, reason: `${DAY_NAMES[c]} Open/Close match (${val1} ➔ ${val2}) Row #${r+1}`, color: BLUE_MATCH_COLOR };
              const m2 = { r: r + off, c, day: DAY_NAMES[c], rowNum: r + 1 + off, val: val2, reason: `${DAY_NAMES[c]} Open/Close match (${val1} ➔ ${val2}) Row #${r+1+off}`, color: BLUE_MATCH_COLOR };
              matches.push(m1, m2);
              matchMap[`${r}_${c}`] = m1;
              matchMap[`${r+off}_${c}`] = m2;
            }
          }
        });
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

            const isOOk = checkDigitRelation(o1, o2, openRel);
            const isCOk = checkDigitRelation(cl1, cl2, closeRel);

            if (isOOk && isCOk) {
              const m1 = { r, c: c1, day: DAY_NAMES[c1], rowNum: r + 1, val: val1, reason: `Same Row match (${val1} & ${val2}) Row #${r+1}`, color: BLUE_MATCH_COLOR };
              const m2 = { r, c: c2, day: DAY_NAMES[c2], rowNum: r + 1, val: val2, reason: `Same Row match (${val1} & ${val2}) Row #${r+1}`, color: BLUE_MATCH_COLOR };
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
  // FEATURE 0.6: STATISTICAL OUTCOME PREDICTOR
  // -------------------------------------------------------------
  const isPredictorQuery = q.includes('mostly') || q.includes('comes after') || q.includes('came after') || q.includes('what comes') || q.includes('prediction');

  if (isPredictorQuery && explicitNumberMatches.length > 0) {
    const targetNum = explicitNumberMatches[0];
    const targetCol = foundDays.length > 0 ? foundDays[0].col : null;
    const colsToScan = targetCol !== null ? [targetCol] : Array.from({ length: cols }, (_, i) => i);

    const followUps = [];
    const openFreq = {};
    const closeFreq = {};
    const jodiFreq = {};

    colsToScan.forEach(c => {
      for (let r = 0; r < grid.length - 1; r++) {
        const val = grid[r]?.[c]?.val || '';
        if (val === targetNum) {
          const nextVal = grid[r + 1]?.[c]?.val || '';
          if (nextVal && /^\d{2}$/.test(nextVal)) {
            followUps.push({ r: r + 1, c, val: nextVal });
            openFreq[nextVal[0]] = (openFreq[nextVal[0]] || 0) + 1;
            closeFreq[nextVal[1]] = (closeFreq[nextVal[1]] || 0) + 1;
            jodiFreq[nextVal] = (jodiFreq[nextVal] || 0) + 1;

            const mOrigin = { r, c, day: DAY_NAMES[c], rowNum: r + 1, val, reason: `Target ${val} on ${DAY_NAMES[c]} (Row #${r+1})`, color: HIGHLIGHT_COLOR };
            matches.push(mOrigin);
            matchMap[`${r}_${c}`] = mOrigin;

            const mNext = { r: r + 1, c, day: DAY_NAMES[c], rowNum: r + 2, val: nextVal, reason: `Follow-up after ${val}: ${nextVal} on ${DAY_NAMES[c]} (Row #${r+2})`, color: GREEN_MATCH_COLOR };
            matches.push(mNext);
            matchMap[`${r+1}_${c}`] = mNext;
          }
        }
      }
    });

    if (followUps.length > 0) {
      const topOpen = Object.keys(openFreq).sort((a, b) => openFreq[b] - openFreq[a])[0];
      const topClose = Object.keys(closeFreq).sort((a, b) => closeFreq[b] - closeFreq[a])[0];
      const topJodi = Object.keys(jodiFreq).sort((a, b) => jodiFreq[b] - jodiFreq[a])[0];

      const openPct = Math.round((openFreq[topOpen] / followUps.length) * 100);
      const closePct = Math.round((closeFreq[topClose] / followUps.length) * 100);

      const dayLabel = targetCol !== null ? DAY_NAMES[targetCol] : 'chart';
      const summary = `After ${targetNum} on ${dayLabel}: Most common Open is ${topOpen} (${openPct}%), Close is ${topClose} (${closePct}%). Top predicted Jodi: ${topJodi}`;

      return { matches, summary, matchMap };
    }
  }

  // -------------------------------------------------------------
  // FEATURE 0.7: MULTI-STEP SENTENCE CHAIN PARSER
  // -------------------------------------------------------------
  if (explicitNumberMatches.length >= 3 || (explicitNumberMatches.length >= 2 && q.includes('and'))) {
    const chainItems = [];

    const segments = q.split(/(?:and|then|,)+/);
    segments.forEach(seg => {
      const numMatch = seg.match(/\b\d{2}\b/);
      if (numMatch) {
        const val = numMatch[0];

        let segCol = null;
        Object.keys(DAY_MAP).forEach(dk => {
          if (seg.includes(dk) && segCol === null) segCol = DAY_MAP[dk];
        });

        let segOffset = 0;
        const ordM = seg.match(/(\d+)(?:st|nd|rd|th)/);
        if (ordM) {
          segOffset = parseInt(ordM[1]) - 1;
        } else if (seg.includes('next day')) {
          segOffset = 'NEXT_DAY';
        }

        chainItems.push({ val, col: segCol, offset: segOffset, raw: seg });
      }
    });

    if (chainItems.length >= 2) {
      const firstItem = chainItems[0];
      const startCol = firstItem.col !== null ? firstItem.col : (foundDays.length > 0 ? foundDays[0].col : null);
      const colsToScan = startCol !== null ? [startCol] : Array.from({ length: cols }, (_, i) => i);

      colsToScan.forEach(c => {
        for (let r = 0; r < grid.length; r++) {
          if (grid[r]?.[c]?.val === firstItem.val) {
            let fullMatch = true;
            const currentChain = [{ r, c, val: firstItem.val, day: DAY_NAMES[c], rowNum: r + 1 }];

            for (let k = 1; k < chainItems.length; k++) {
              const item = chainItems[k];
              let targetR = r;
              let targetC = item.col !== null ? item.col : c;

              if (item.offset === 'NEXT_DAY') {
                targetC = (targetC + 1) % cols;
                if (targetC === 0) targetR = targetR + 1;
                if (k > 1 && typeof chainItems[k-1].offset === 'number') {
                  targetR = r + chainItems[k-1].offset;
                }
              } else if (typeof item.offset === 'number' && item.offset > 0) {
                targetR = r + item.offset;
              } else {
                targetR = r + k;
              }

              if (targetR < grid.length && grid[targetR]?.[targetC]?.val === item.val) {
                currentChain.push({ r: targetR, c: targetC, val: item.val, day: DAY_NAMES[targetC], rowNum: targetR + 1 });
              } else {
                fullMatch = false;
                break;
              }
            }

            if (fullMatch && currentChain.length >= 2) {
              currentChain.forEach((stepItem, idx) => {
                const m = {
                  r: stepItem.r, c: stepItem.c,
                  day: stepItem.day,
                  rowNum: stepItem.rowNum,
                  val: stepItem.val,
                  reason: `Chain Step ${idx + 1}: ${stepItem.val} on ${stepItem.day} (Row #${stepItem.rowNum})`,
                  color: GREEN_MATCH_COLOR
                };
                matches.push(m);
                matchMap[`${stepItem.r}_${stepItem.c}`] = m;
              });
            }
          }
        }
      });

      if (matches.length > 0) {
        const summary = `Found ${matches.length / chainItems.length} complete sentence chain match(es) for "${queryStr}"`;
        return { matches, summary, matchMap };
      }
    }
  }

  // -------------------------------------------------------------
  // FEATURE 1: OPEN TO OPEN / CLOSE TO CLOSE PROCESSOR
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
  // FEATURE 2: STRICT SAME ROW QUERY PROCESSOR
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
  // FEATURE 3: STRICT SAME COL QUERY PROCESSOR
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
  // FEATURE 4: MULTI-NUMBER / RELATIONAL SEQUENCE SEARCH
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
  // FEATURE 5: TOTAL / SUM / DIFFERENCE SEARCH
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
  // FEATURE 6: SINGLE NUMBER SEARCH WITH STRICT DAY FILTER
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
  // FEATURE 7: SINGLE OPEN / CLOSE DIGIT SEARCH
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
  // FEATURE 8: RED PAIRS SEARCH
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
  // FEATURE 9: GENERAL DAY / SUBSTRING FALLBACK
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
    : `No matches found for "${queryStr}". Try e.g. "fri 16 4rd week saturday".`;

  return { matches, summary, matchMap };
};
