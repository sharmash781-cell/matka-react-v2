/**
 * Universal Multi-Clause Natural Language Query Engine for Matka Chart
 * Features:
 * - Independent Multi-Clause Pipeline with Relative Ordinal Week Context
 * - Support for "OR" and "AND" Compound Relations ("open to open same or 2 down")
 * - Red Pair Handler ("red pair", "red jodi", "double pair")
 * - Word-to-Number Step & Total Parser ("one down", "total one")
 * - Proximity Neighbor Scanner (scans all 8 surrounding cells across all days)
 * - Directional Row Scanning ("after 43", "below 43", "following 43")
 * - Full Ordinal Chain, Cross-Digit & Jodi Family support
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

const WORD_TO_NUM = {
  zero: 0, one: 1, two: 2, three: 3, four: 4,
  five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10
};

// Helper to extract row range (1-indexed input e.g. "between 1 to 5 row", "440 row")
const parseRowRange = (qStr, totalRows) => {
  const rangeMatch = qStr.match(/(?:between|row[s]?)\s*(\d+)\s*(?:to|-|and)\s*(\d+)/i) ||
                     qStr.match(/(\d+)\s*(?:to|-)\s*(\d+)\s*row[s]?/i);
  if (rangeMatch) {
    const minR = Math.max(0, parseInt(rangeMatch[1]) - 1);
    const maxR = Math.min(totalRows - 1, parseInt(rangeMatch[2]) - 1);
    return { minR: Math.min(minR, maxR), maxR: Math.max(minR, maxR), isRestricted: true };
  }

  const leadingRowMatch = qStr.match(/^(\d+)\s*(?:st|nd|rd|th)?\s*row/i) || qStr.match(/\b(\d{3,4})\s*row/i);
  if (leadingRowMatch) {
    const rIdx = Math.max(0, Math.min(totalRows - 1, parseInt(leadingRowMatch[1]) - 1));
    return { minR: rIdx, maxR: rIdx, isRestricted: true };
  }

  const singleRowMatch = qStr.match(/\brow\s*(\d+)\b/i) || qStr.match(/(\d+)(?:st|nd|rd|th)?\s*row/i);
  if (singleRowMatch) {
    const rIdx = Math.max(0, Math.min(totalRows - 1, parseInt(singleRowMatch[1]) - 1));
    return { minR: rIdx, maxR: rIdx, isRestricted: true };
  }

  return { minR: 0, maxR: totalRows - 1, isRestricted: false };
};

// Helper for Falti / Reverse / Palat
const getFaltiNumber = (numStr) => {
  if (!numStr || numStr.length !== 2) return null;
  return `${numStr[1]}${numStr[0]}`;
};

// Helper to generate full 8-member Matka Jodi Family
const getJodiFamily = (jodiStr) => {
  if (!jodiStr || !/^\d{2}$/.test(jodiStr)) return [];
  const o = parseInt(jodiStr[0]);
  const c = parseInt(jodiStr[1]);
  const cutO = (o + 5) % 10;
  const cutC = (c + 5) % 10;

  return Array.from(new Set([
    `${o}${c}`, `${o}${cutC}`, `${cutO}${c}`, `${cutO}${cutC}`,
    `${c}${o}`, `${c}${cutO}`, `${cutC}${o}`, `${cutC}${cutO}`
  ]));
};

const parseRelation = (textStr) => {
  if (!textStr) return null;
  const lower = textStr.toLowerCase();
  if (lower.includes('opposite') || lower.includes('cut')) return { type: 'OPPOSITE' };
  if (lower.includes('same')) return { type: 'SAME' };

  let step = 1;
  Object.keys(WORD_TO_NUM).forEach(wKey => {
    if (lower.includes(`${wKey} down`) || lower.includes(`${wKey} up`)) {
      step = WORD_TO_NUM[wKey];
    }
  });

  const upMatch = lower.match(/(\d+)?\s*up/);
  if (upMatch || lower.includes('up')) {
    if (upMatch && upMatch[1]) step = parseInt(upMatch[1]);
    return { type: 'UP', step };
  }
  const downMatch = lower.match(/(\d+)?\s*down/);
  if (downMatch || lower.includes('down')) {
    if (downMatch && downMatch[1]) step = parseInt(downMatch[1]);
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

  let { minR, maxR, isRestricted } = parseRowRange(q, grid.length);

  // Directional Row Filtering (e.g. "after 43", "from 43", "below 43")
  const directionalMatch = q.match(/(?:after|from|below|following)\s*(\d{2})/i);
  if (directionalMatch) {
    const anchorNum = directionalMatch[1];
    let anchorRow = -1;
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r]?.[c]?.val === anchorNum) {
          anchorRow = r;
          break;
        }
      }
      if (anchorRow !== -1) break;
    }
    if (anchorRow !== -1) {
      minR = Math.max(minR, anchorRow + 1);
      isRestricted = true;
    }
  }

  // Split query into independent logical clauses (separated by "and", "then")
  const rawClauses = q.split(/\s*(?:and|then)\s*/i);

  let lastOriginRow = 0;

  rawClauses.forEach(clauseStr => {
    const cStr = clauseStr.trim();
    if (!cStr) return;

    let cMinR = minR;
    let cMaxR = maxR;

    const wMatch = cStr.match(/(\d+)(?:st|nd|rd|th)?\s*week/i);
    if (wMatch) {
      const wIdx = parseInt(wMatch[1]) - 1;
      if (cStr.includes('next')) {
        cMinR = Math.min(grid.length - 1, lastOriginRow + parseInt(wMatch[1]) - 1);
        cMaxR = cMinR;
      } else {
        cMinR = Math.max(0, Math.min(grid.length - 1, wIdx));
        cMaxR = cMinR;
      }
    }

    // Detect Days in this specific clause
    const clauseWords = cStr.split(/\s+/);
    const clauseDays = [];
    clauseWords.forEach(w => {
      const cw = w.replace(/[^a-z]/g, '');
      if (DAY_MAP[cw] !== undefined && !clauseDays.includes(DAY_MAP[cw])) {
        clauseDays.push(DAY_MAP[cw]);
      }
    });

    // Detect 2-digit numbers in this specific clause
    const clauseNums = cStr.match(/\b\d{2}\b/g) || [];

    // Detect totals in this specific clause (digit or word e.g. "9 total", "total one")
    const clauseTotals = [];
    const tDigitMatches = cStr.matchAll(/(\d+)\s*total|total\s*(\d+)/gi);
    for (const tm of tDigitMatches) {
      const tVal = parseInt(tm[1] || tm[2]);
      if (!clauseTotals.includes(tVal)) clauseTotals.push(tVal);
    }
    Object.keys(WORD_TO_NUM).forEach(wKey => {
      if (cStr.includes(`total ${wKey}`) || cStr.includes(`${wKey} total`)) {
        if (!clauseTotals.includes(WORD_TO_NUM[wKey])) clauseTotals.push(WORD_TO_NUM[wKey]);
      }
    });

    const hasNear = cStr.includes('near') || cStr.includes('around') || cStr.includes('close');
    const hasReverse = cStr.includes('reverse') || cStr.includes('falti') || cStr.includes('palat');
    const hasFamily = cStr.includes('family');
    const hasRedPair = cStr.includes('red pair') || cStr.includes('red jodi') || cStr.includes('double');
    const isCrossDigitQuery = (cStr.includes('open to close') || cStr.includes('close to open') || cStr.includes('open to open') || cStr.includes('close to close'));

    // CLAUSE TYPE CROSS-DIGIT: Cross-Digit Relations with "OR" / "AND" support
    if (isCrossDigitQuery) {
      const crossClauses = [];
      const hasOrLogic = cStr.includes(' or ');
      const clauseRegex = /(open\s+to\s+close|close\s+to\s+open|open\s+to\s+open|close\s+to\s+close)\s+([a-z0-9\s]+)/gi;
      let match;
      while ((match = clauseRegex.exec(cStr)) !== null) {
        const typeStr = match[1].toLowerCase().replace(/\s+/g, '_');
        const relObj = parseRelation(match[2]);
        crossClauses.push({ type: typeStr, rel: relObj });
      }

      const targetCols = clauseDays.length > 0 ? clauseDays : Array.from({ length: cols }, (_, i) => i);
      targetCols.forEach(c => {
        for (let r1 = cMinR; r1 < cMaxR; r1++) {
          for (let r2 = r1 + 1; r2 <= cMaxR; r2++) {
            const val1 = grid[r1]?.[c]?.val || '';
            const val2 = grid[r2]?.[c]?.val || '';
            if (!val1 || !val2 || !/^\d{2}$/.test(val1) || !/^\d{2}$/.test(val2)) continue;

            const o1 = parseInt(val1[0]), c1Digit = parseInt(val1[1]);
            const o2 = parseInt(val2[0]), c2Digit = parseInt(val2[1]);

            let passesCount = 0;
            crossClauses.forEach(cl => {
              let d1, d2;
              if (cl.type === 'open_to_close') { d1 = o1; d2 = c2Digit; }
              else if (cl.type === 'close_to_open') { d1 = c1Digit; d2 = o2; }
              else if (cl.type === 'open_to_open') { d1 = o1; d2 = o2; }
              else if (cl.type === 'close_to_close') { d1 = c1Digit; d2 = c2Digit; }

              if (checkDigitRelation(d1, d2, cl.rel)) passesCount++;
            });

            const passes = hasOrLogic ? passesCount > 0 : passesCount === crossClauses.length;

            if (passes && crossClauses.length > 0) {
              const m1 = { r: r1, c, day: DAY_NAMES[c], rowNum: r1 + 1, val: val1, reason: `${DAY_NAMES[c]} Row #${r1+1} (${val1}) vs Row #${r2+1} (${val2}) Cross-Digit Match`, color: GREEN_MATCH_COLOR };
              const m2 = { r: r2, c, day: DAY_NAMES[c], rowNum: r2 + 1, val: val2, reason: `${DAY_NAMES[c]} Row #${r1+1} (${val1}) vs Row #${r2+1} (${val2}) Cross-Digit Match`, color: GREEN_MATCH_COLOR };
              matches.push(m1, m2);
              matchMap[`${r1}_${c}`] = m1;
              matchMap[`${r2}_${c}`] = m2;
            }
          }
        }
      });
    }

    // CLAUSE TYPE A: Proximity Search with Totals (e.g. "sat 6 total near 8 total")
    else if (hasNear && clauseTotals.length >= 1) {
      const originDayCol = clauseDays.length > 0 ? clauseDays[0] : null;
      const originCols = originDayCol !== null ? [originDayCol] : Array.from({ length: cols }, (_, i) => i);
      const originTotal = clauseTotals[0];
      const nearTotal = clauseTotals.length >= 2 ? clauseTotals[1] : clauseTotals[0];

      for (let r = cMinR; r <= cMaxR; r++) {
        originCols.forEach(c => {
          const val = grid[r]?.[c]?.val || '';
          if (val && /^\d{2}$/.test(val)) {
            const t1 = (parseInt(val[0]) + parseInt(val[1])) % 10;
            const t2 = parseInt(val[0]) + parseInt(val[1]);
            if (t1 === originTotal || t2 === originTotal) {
              lastOriginRow = r;
              const mOrigin = {
                r, c,
                day: DAY_NAMES[c],
                rowNum: r + 1,
                val,
                reason: `${DAY_NAMES[c]} Total ${originTotal} (${val}) on Row #${r+1}`,
                color: GREEN_MATCH_COLOR
              };
              if (!matchMap[`${r}_${c}`]) {
                matches.push(mOrigin);
                matchMap[`${r}_${c}`] = mOrigin;
              }

              for (let dr = -2; dr <= 2; dr++) {
                for (let dc = -3; dc <= 3; dc++) {
                  const nr = r + dr;
                  const nc = c + dc;
                  if (nr >= minR && nr <= maxR && nc >= 0 && nc < cols) {
                    if (nr === r && nc === c) continue;
                    const nVal = grid[nr]?.[nc]?.val || '';
                    if (nVal && /^\d{2}$/.test(nVal)) {
                      const nt1 = (parseInt(nVal[0]) + parseInt(nVal[1])) % 10;
                      const nt2 = parseInt(nVal[0]) + parseInt(nVal[1]);
                      if (nt1 === nearTotal || nt2 === nearTotal) {
                        const mNear = {
                          r: nr, c: nc,
                          day: DAY_NAMES[nc],
                          rowNum: nr + 1,
                          val: nVal,
                          reason: `Near ${DAY_NAMES[c]} Total ${originTotal}: Total ${nearTotal} (${nVal}) on ${DAY_NAMES[nc]} (Row #${nr+1})`,
                          color: GREEN_MATCH_COLOR
                        };
                        if (!matchMap[`${nr}_${nc}`]) {
                          matches.push(mNear);
                          matchMap[`${nr}_${nc}`] = mNear;
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        });
      }
    }

    // CLAUSE TYPE B: Red Pair Handler (e.g. "next 5th week red pair")
    else if (hasRedPair) {
      const targetCols = clauseDays.length > 0 ? clauseDays : Array.from({ length: cols }, (_, i) => i);
      for (let r = cMinR; r <= cMaxR; r++) {
        targetCols.forEach(c => {
          const val = grid[r]?.[c]?.val || '';
          if (val && isRedPair(val)) {
            const m = {
              r, c,
              day: DAY_NAMES[c],
              rowNum: r + 1,
              val,
              reason: `Red Pair (${val}) on ${DAY_NAMES[c]} (Row #${r+1})`,
              color: RED_MATCH_COLOR
            };
            if (!matchMap[`${r}_${c}`]) {
              matches.push(m);
              matchMap[`${r}_${c}`] = m;
            }
          }
        });
      }
    }

    // CLAUSE TYPE C: Explicit Number Search (e.g. "31 jodi", "wed 06")
    else if (clauseNums.length > 0 && !hasFamily && !hasReverse) {
      const numToFind = clauseNums[0];
      const targetCols = clauseDays.length > 0 ? clauseDays : Array.from({ length: cols }, (_, i) => i);

      for (let r = cMinR; r <= cMaxR; r++) {
        targetCols.forEach(c => {
          const val = grid[r]?.[c]?.val || '';
          if (val === numToFind) {
            const m = {
              r, c,
              day: DAY_NAMES[c],
              rowNum: r + 1,
              val,
              reason: `Found ${val} on ${DAY_NAMES[c]} (Row #${r+1})`,
              color: isRedPair(val) ? RED_MATCH_COLOR : HIGHLIGHT_COLOR
            };
            if (!matchMap[`${r}_${c}`]) {
              matches.push(m);
              matchMap[`${r}_${c}`] = m;
            }
          }
        });
      }
    }

    // CLAUSE TYPE D: Total Filter Search (e.g. "total one in 6th week", "7 total in sat")
    else if (clauseTotals.length > 0 && clauseNums.length === 0) {
      const reqTotal = clauseTotals[0];
      const targetCols = clauseDays.length > 0 ? clauseDays : Array.from({ length: cols }, (_, i) => i);

      for (let r = cMinR; r <= cMaxR; r++) {
        targetCols.forEach(c => {
          const val = grid[r]?.[c]?.val || '';
          if (val && /^\d{2}$/.test(val)) {
            const t1 = (parseInt(val[0]) + parseInt(val[1])) % 10;
            const t2 = parseInt(val[0]) + parseInt(val[1]);
            if (t1 === reqTotal || t2 === reqTotal) {
              const m = {
                r, c,
                day: DAY_NAMES[c],
                rowNum: r + 1,
                val,
                reason: `${DAY_NAMES[c]} Total ${reqTotal} (${val}) on Row #${r+1}`,
                color: GREEN_MATCH_COLOR
              };
              if (!matchMap[`${r}_${c}`]) {
                matches.push(m);
                matchMap[`${r}_${c}`] = m;
              }
            }
          }
        });
      }
    }

    // CLAUSE TYPE E: Reverse / Falti Search (e.g. "43 reverse")
    else if (hasReverse && (clauseNums.length > 0 || hasRedPair)) {
      const num1 = clauseNums.length > 0 ? clauseNums[0] : null;
      const num2 = num1 ? getFaltiNumber(num1) : null;
      const targetCols = clauseDays.length > 0 ? clauseDays : Array.from({ length: cols }, (_, i) => i);

      for (let r = cMinR; r <= cMaxR; r++) {
        targetCols.forEach(c => {
          const val = grid[r]?.[c]?.val || '';
          if (val && /^\d{2}$/.test(val)) {
            if (num1 && (val === num1 || val === num2)) {
              const isFalti = val === num2 && num1 !== num2;
              const m = {
                r, c,
                day: DAY_NAMES[c],
                rowNum: r + 1,
                val,
                reason: isFalti ? `Reverse of ${num1} (${num2}) on ${DAY_NAMES[c]} (Row #${r+1})` : `Direct ${num1} on ${DAY_NAMES[c]} (Row #${r+1})`,
                color: isFalti ? PURPLE_MATCH_COLOR : HIGHLIGHT_COLOR
              };
              if (!matchMap[`${r}_${c}`]) {
                matches.push(m);
                matchMap[`${r}_${c}`] = m;
              }
            }
          }
        });
      }
    }

    // CLAUSE TYPE F: Jodi Family Search (e.g. "03 family")
    else if (hasFamily && clauseNums.length > 0) {
      const targetJodi = clauseNums[0];
      const familyMembers = getJodiFamily(targetJodi);
      const targetCols = clauseDays.length > 0 ? clauseDays : Array.from({ length: cols }, (_, i) => i);

      for (let r = cMinR; r <= cMaxR; r++) {
        targetCols.forEach(c => {
          const val = grid[r]?.[c]?.val || '';
          if (val && familyMembers.includes(val)) {
            const m = {
              r, c,
              day: DAY_NAMES[c],
              rowNum: r + 1,
              val,
              reason: `${targetJodi} Family member (${val}) on ${DAY_NAMES[c]} (Row #${r+1})`,
              color: GREEN_MATCH_COLOR
            };
            if (!matchMap[`${r}_${c}`]) {
              matches.push(m);
              matchMap[`${r}_${c}`] = m;
            }
          }
        });
      }
    }
  });

  const rowLabel = isRestricted ? (minR === maxR ? `Row #${minR+1}` : `Rows #${minR+1} to #${maxR+1}`) : `chart`;
  const summary = matches.length > 0
    ? `Found ${matches.length} matching cell(s) for query on ${rowLabel}`
    : `No matches found for "${queryStr}".`;

  return { matches, summary, matchMap };
};
