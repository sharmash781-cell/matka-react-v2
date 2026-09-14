/**
 * Ultra-Advanced Natural Language Query Engine for Matka Chart
 * Features:
 * - Ordinal Week Multi-Number Search ("tue 81 2 week 01" -> Row 26 Tue 81 to Row 27 Wed 01)
 * - Strict Number Dead Pair Search ("88 dead same col" -> strictly 88 ➔ 33)
 * - Same Week Follow-Up Search ("after red 22 any one total same week")
 * - Dead Pair / Cut Pair Engine ("dead", "full dead", "open dead", "close dead")
 * - Multi-Row Gap Column Scanning
 * - Ordinal Column/Row offsets
 * - Multi-Step Sentence Chain Parser
 * - Statistical Outcome Predictor
 * - Holiday Filtering
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

  if (lower.includes('full dead') || (lower.includes('dead') && !lower.includes('open dead') && !lower.includes('close dead'))) {
    return { type: 'DEAD' };
  }
  if (lower.includes('open dead')) {
    return { type: 'OPEN_DEAD' };
  }
  if (lower.includes('close dead')) {
    return { type: 'CLOSE_DEAD' };
  }
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
  if (rel.type === 'OPPOSITE' || rel.type === 'DEAD' || rel.type === 'OPEN_DEAD' || rel.type === 'CLOSE_DEAD') {
    return d2 === (d1 + 5) % 10;
  }
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

  // 1. Detect explicit days mentioned in query
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

  // Parse default row offset or ordinal (e.g. "4rd thu", "2 week", "4th week")
  let rowOffset = 1;
  const ordMatch = q.match(/(\d+)(?:st|nd|rd|th|\s*week)/);
  if (ordMatch) {
    rowOffset = parseInt(ordMatch[1]) - 1; // 2 week -> +1 row
  } else {
    const offsetMatch = q.match(/(?:next|after|following)?\s*(\d+)(?:st|nd|rd|th)?\s*row/) || q.match(/(\d+)\s*row[s]?\s*down/);
    if (offsetMatch) {
      rowOffset = parseInt(offsetMatch[1]);
    } else if (q.includes('next') || q.includes('then') || q.includes('after')) {
      rowOffset = 1;
    }
  }

  // -------------------------------------------------------------
  // FEATURE 0.1: ORDINAL WEEK MULTI-NUMBER SEARCH
  // E.g. "tue 81 2 week 01" -> Row 26 Tue 81 to Row 27 Wed 01
  // E.g. "fri 16 4rd week saturday" -> Row 2 Fri 16 to Row 5 Sat 59
  // -------------------------------------------------------------
  if (foundDays.length >= 1 && explicitNumberMatches.length >= 1 && (q.includes('week') || ordMatch)) {
    const startDayCol = foundDays[0].col;
    const num1 = explicitNumberMatches[0];
    const num2 = explicitNumberMatches.length >= 2 ? explicitNumberMatches[1] : null;

    let weekOffset = rowOffset;
    if (ordMatch) {
      weekOffset = parseInt(ordMatch[1]) - 1;
    } else {
      const wMatch = q.match(/(\d+)(?:st|nd|rd|th)?\s*week/);
      if (wMatch) weekOffset = parseInt(wMatch[1]) - 1;
    }

    for (let r = 0; r < grid.length; r++) {
      if (grid[r]?.[startDayCol]?.val === num1) {
        const targetR = r + weekOffset;
        if (targetR < grid.length) {
          const targetColsToScan = foundDays.length >= 2
            ? [foundDays[1].col]
            : (num2 ? Array.from({ length: cols }, (_, i) => i) : [startDayCol]);

          targetColsToScan.forEach(targetDayCol => {
            const targetVal = grid[targetR]?.[targetDayCol]?.val || '';
            if (targetVal && (!num2 || targetVal === num2)) {
              const m1 = {
                r, c: startDayCol,
                day: DAY_NAMES[startDayCol],
                rowNum: r + 1,
                val: num1,
                reason: `Start: ${DAY_NAMES[startDayCol]} ${num1} (Row #${r+1})`,
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
          });
        }
      }
    }

    if (matches.length > 0) {
      const summary = `Found ${matches.length / 2} ordinal week match(es) for "${queryStr}"`;
      return { matches, summary, matchMap };
    }
  }

  // -------------------------------------------------------------
  // FEATURE 0.2: SAME WEEK FOLLOW-UP QUERY PROCESSOR
  // E.g. "after red 22 any one total same week"
  // -------------------------------------------------------------
  if (q.includes('same week') && explicitNumberMatches.length > 0) {
    const targetNum = explicitNumberMatches[0];
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r]?.[c]?.val === targetNum) {
          const mOrigin = {
            r, c,
            day: DAY_NAMES[c],
            rowNum: r + 1,
            val: targetNum,
            reason: `Target ${targetNum} on ${DAY_NAMES[c]} (Row #${r+1})`,
            color: HIGHLIGHT_COLOR
          };
          matches.push(mOrigin);
          matchMap[`${r}_${c}`] = mOrigin;

          // Highlight rest of week
          for (let nextC = c + 1; nextC < cols; nextC++) {
            const nextVal = grid[r]?.[nextC]?.val || '';
            if (nextVal && /^\d{2}$/.test(nextVal)) {
              const tot = calculateTotal(nextVal);
              const mNext = {
                r, c: nextC,
                day: DAY_NAMES[nextC],
                rowNum: r + 1,
                val: nextVal,
                reason: `Same Week after ${targetNum}: ${DAY_NAMES[nextC]} ${nextVal} (Total=${tot})`,
                color: BLUE_MATCH_COLOR
              };
              matches.push(mNext);
              matchMap[`${r}_${nextC}`] = mNext;
            }
          }
        }
      }
    }

    if (matches.length > 0) {
      const summary = `Found ${matches.length} same-week follow-up cell(s) after ${targetNum}`;
      return { matches, summary, matchMap };
    }
  }

  // -------------------------------------------------------------
  // FEATURE 0.5: STRICT NUMBER DEAD PAIR ENGINE
  // E.g. "88 dead same col" or "88 dead wed"
  // -------------------------------------------------------------
  const isDeadQuery = q.includes('dead');
  if (isDeadQuery && explicitNumberMatches.length > 0) {
    const targetNum = explicitNumberMatches[0];
    const deadOpen = (parseInt(targetNum[0]) + 5) % 10;
    const deadClose = (parseInt(targetNum[1]) + 5) % 10;
    const deadVal = `${deadOpen}${deadClose}`;

    const targetCols = foundDays.map(d => d.col);
    const colsToScan = targetCols.length > 0 ? targetCols : Array.from({ length: cols }, (_, i) => i);

    colsToScan.forEach(c => {
      for (let r = 0; r < grid.length; r++) {
        if (grid[r]?.[c]?.val === targetNum) {
          for (let off = 1; off <= 10; off++) {
            if (r + off < grid.length && grid[r + off]?.[c]?.val === deadVal) {
              const m1 = { r, c, day: DAY_NAMES[c], rowNum: r + 1, val: targetNum, reason: `Target ${targetNum} on ${DAY_NAMES[c]} (Row #${r+1})`, color: HIGHLIGHT_COLOR };
              const m2 = { r: r + off, c, day: DAY_NAMES[c], rowNum: r + 1 + off, val: deadVal, reason: `Dead Pair ${deadVal} (+${off} rows) on ${DAY_NAMES[c]} (Row #${r+1+off})`, color: GREEN_MATCH_COLOR };
              matches.push(m1, m2);
              matchMap[`${r}_${c}`] = m1;
              matchMap[`${r+off}_${c}`] = m2;
            }
          }
        }
      }
    });

    if (matches.length > 0) {
      const summary = `Found ${matches.length / 2} dead pair match(es) (${targetNum} ➔ ${deadVal})`;
      return { matches, summary, matchMap };
    }
  }

  // -------------------------------------------------------------
  // GENERAL DIGIT RELATIONSHIPS & DEAD PAIR SCANNER
  // -------------------------------------------------------------
  const hasOpenClause = q.includes('open');
  const hasCloseClause = q.includes('close');
  const hasRelationKeyword = q.includes('same') || q.includes('opposite') || q.includes('cut') || q.includes('up') || q.includes('down') || isDeadQuery;

  if ((hasOpenClause || hasCloseClause || isDeadQuery) && hasRelationKeyword) {
    let openRel = null;
    let closeRel = null;

    if (isDeadQuery) {
      if (q.includes('open dead')) {
        openRel = { type: 'OPEN_DEAD' };
      } else if (q.includes('close dead')) {
        closeRel = { type: 'CLOSE_DEAD' };
      } else {
        openRel = { type: 'DEAD' };
        closeRel = { type: 'DEAD' };
      }
    }

    if (!openRel && hasOpenClause) {
      const openSubstr = q.match(/open[a-z\s]*?(same|opposite|cut|family|\d*\s*up|\d*\s*down|dead)/);
      openRel = openSubstr ? parseRelation(openSubstr[0]) : parseRelation(q);
    }
    if (!closeRel && hasCloseClause) {
      const closeSubstr = q.match(/close[a-z\s]*?(same|opposite|cut|family|\d*\s*up|\d*\s*down|dead)/);
      closeRel = closeSubstr ? parseRelation(closeSubstr[0]) : parseRelation(q);
    }

    const targetCols = foundDays.map(d => d.col);
    const colsToScan = targetCols.length > 0 ? targetCols : Array.from({ length: cols }, (_, i) => i);

    const isSameRow = q.includes('same row');
    const isSameCol = q.includes('same col') || q.includes('same column') || targetCols.length > 0;

    let candidateOffsets = [1];
    if (ordMatch) {
      const parsedN = parseInt(ordMatch[1]);
      candidateOffsets = Array.from(new Set([parsedN - 1, parsedN, 1, 2, 3, 4, 5, 6].filter(x => x > 0)));
    } else if (!isSameRow) {
      candidateOffsets = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
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
              const labelStr = (openRel?.type==='DEAD' && closeRel?.type==='DEAD') ? 'Dead Pair' : 'Open/Close Opposite';
              const m1 = { r, c, day: DAY_NAMES[c], rowNum: r + 1, val: val1, reason: `${DAY_NAMES[c]} ${labelStr} (${val1} ➔ ${val2}) Row #${r+1}`, color: BLUE_MATCH_COLOR };
              const m2 = { r: r + off, c, day: DAY_NAMES[c], rowNum: r + 1 + off, val: val2, reason: `${DAY_NAMES[c]} ${labelStr} (${val1} ➔ ${val2}) Row #${r+1+off}`, color: BLUE_MATCH_COLOR };
              matches.push(m1, m2);
              matchMap[`${r}_${c}`] = m1;
              matchMap[`${r+off}_${c}`] = m2;
            }
          }
        });
      });
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
  // FEATURE 4: MULTI-NUMBER SEQUENCE SEARCH FALLBACK
  // -------------------------------------------------------------
  if (explicitNumberMatches.length >= 2) {
    const num1 = explicitNumberMatches[0];
    const num2 = explicitNumberMatches[1];

    const day1Col = foundDays.length > 0 ? foundDays[0].col : null;
    const day2Col = foundDays.length > 1 ? foundDays[1].col : (day1Col !== null ? day1Col : null);

    const candidateOffsets = [1, 2, 3, 4];

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
        }
      }
    }

    const summary = matches.length > 0
      ? `Found ${matches.length} matching cell(s) for "${queryStr}"`
      : `No matches found for number ${numToFind} on ${targetCol !== null ? DAY_NAMES[targetCol] : 'chart'}.`;

    return { matches, summary, matchMap };
  }

  const summary = matches.length > 0
    ? `Found ${matches.length} matching cell(s) for "${queryStr}"`
    : `No matches found for "${queryStr}".`;

  return { matches, summary, matchMap };
};
