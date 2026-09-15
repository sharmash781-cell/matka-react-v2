/**
 * Ultra-Advanced Natural Language Query Engine for Matka Chart
 * Features:
 * - N-Step Ordinal Sentence Chain Parser ("mon 08 next 2 week wed 66 and next day 85 and next 4 week 51")
 * - Compound Cross-Digit Relations Engine ("open to open 4 down and close to close 4 down row mon")
 * - Row Range & Specific Row Filter ("in between 1 to 12 rows", "in row 1", "row 1 to 10")
 * - Jodi Family Engine ("03 family" -> finds 03, 08, 53, 58, 30, 35, 80, 85)
 * - Falti / Reverse / Palat Engine ("56 falti", "56 reverse", "56 palat" -> finds 65)
 * - N-th Occurrence & Proximity Search ("10th 88 near 1 total", "5th 88")
 * - Strict Number Dead Pair Search ("88 dead same col")
 * - Same Week Follow-Up Search ("after red 22 any one total same week")
 * - Dead Pair / Cut Pair Engine ("dead", "full dead", "open dead", "close dead")
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

// Helper to extract row range (1-indexed input e.g. "between 1 to 12 rows", "row 1")
const parseRowRange = (qStr, totalRows) => {
  const rangeMatch = qStr.match(/(?:between|row[s]?)\s*(\d+)\s*(?:to|-|and)\s*(\d+)/i) ||
                     qStr.match(/(\d+)\s*(?:to|-)\s*(\d+)\s*row[s]?/i);
  if (rangeMatch) {
    const minR = Math.max(0, parseInt(rangeMatch[1]) - 1);
    const maxR = Math.min(totalRows - 1, parseInt(rangeMatch[2]) - 1);
    return { minR: Math.min(minR, maxR), maxR: Math.max(minR, maxR) };
  }

  const singleRowMatch = qStr.match(/(?:in\s+)?row\s*(\d+)\b/i);
  if (singleRowMatch) {
    const rIdx = Math.max(0, Math.min(totalRows - 1, parseInt(singleRowMatch[1]) - 1));
    return { minR: rIdx, maxR: rIdx };
  }

  return { minR: 0, maxR: totalRows - 1 };
};

// Helper to generate full 8-member Matka Jodi Family
const getJodiFamily = (jodiStr) => {
  if (!jodiStr || !/^\d{2}$/.test(jodiStr)) return [];
  const o = parseInt(jodiStr[0]);
  const c = parseInt(jodiStr[1]);
  const cutO = (o + 5) % 10;
  const cutC = (c + 5) % 10;

  const set = new Set([
    `${o}${c}`,         // Direct
    `${o}${cutC}`,      // Cut Close
    `${cutO}${c}`,      // Cut Open
    `${cutO}${cutC}`,   // Both Cut
    `${c}${o}`,         // Palat Direct
    `${c}${cutO}`,      // Palat Cut Open
    `${cutC}${o}`,      // Palat Cut Close
    `${cutC}${cutO}`    // Palat Both Cut
  ]);
  return Array.from(set);
};

// Helper for Falti / Reverse / Palat
const getFaltiNumber = (numStr) => {
  if (!numStr || numStr.length !== 2) return null;
  return `${numStr[1]}${numStr[0]}`;
};

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
  if (lower.includes('opposite') || lower.includes('cut')) {
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

  const { minR, maxR } = parseRowRange(q, grid.length);

  // Detect explicit days mentioned in query
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

  const explicitNumberMatches = q.match(/\b\d{2}\b/g) || [];

  // -------------------------------------------------------------
  // FEATURE 0.00: MULTI-STEP SENTENCE CHAIN ENGINE (N-Step Chains)
  // E.g. "mon 08 next 2 week wed 66 and next day 85 and next 4 week 51"
  // E.g. "mon 88 next 2 week 33 and 3 week 64 and next day 03"
  // -------------------------------------------------------------
  const isChainQuery = q.includes('and') || (q.match(/next/g) || []).length >= 2;
  if (isChainQuery && explicitNumberMatches.length >= 2) {
    // Split sentence into segments by "and", "then", or commas
    const rawSegments = q.split(/\s*(?:and|then|,)\s*/);
    const segments = [];

    rawSegments.forEach((segStr, sIdx) => {
      const segNumMatch = segStr.match(/\b\d{2}\b/);
      if (segNumMatch) {
        const segNum = segNumMatch[0];

        // Day detection for this segment
        let segCol = null;
        let isNextDay = segStr.includes('next day') || segStr.includes('following day');
        words.forEach(w => {
          const cw = w.replace(/[^a-z]/g, '');
          if (DAY_MAP[cw] !== undefined && segStr.includes(cw)) {
            segCol = DAY_MAP[cw];
          }
        });

        // Offset detection for this segment
        let segOffset = 1;
        const wMatch = segStr.match(/(\d+)(?:st|nd|rd|th)?\s*week/);
        if (wMatch) {
          segOffset = parseInt(wMatch[1]) - 1;
        } else if (segStr.includes('next week')) {
          segOffset = 1;
        } else if (isNextDay) {
          segOffset = 0;
        }

        segments.push({
          num: segNum,
          col: segCol,
          isNextDay,
          offset: segOffset,
          raw: segStr
        });
      }
    });

    if (segments.length >= 2) {
      const step1 = segments[0];
      const startCol = step1.col !== null ? step1.col : (foundDays.length > 0 ? foundDays[0].col : null);

      for (let r = minR; r <= maxR; r++) {
        const startColsToScan = startCol !== null ? [startCol] : Array.from({ length: cols }, (_, i) => i);
        startColsToScan.forEach(c0 => {
          if (grid[r]?.[c0]?.val === step1.num) {
            // Traversal path tracking
            const path = [{ r, c: c0, val: step1.num, stepName: `Step 1 (${step1.num})` }];
            let currR = r;
            let currC = c0;
            let chainMatched = true;

            for (let sIdx = 1; sIdx < segments.length; sIdx++) {
              const seg = segments[sIdx];
              let targetR, targetC;

              if (seg.isNextDay) {
                targetR = currC < cols - 1 ? currR : currR + 1;
                targetC = currC < cols - 1 ? currC + 1 : 0;
              } else {
                targetR = r + seg.offset; // Week offset relative to origin or previous step
                targetC = seg.col !== null ? seg.col : currC;
              }

              if (targetR <= maxR && targetR < grid.length && targetC >= 0 && targetC < cols) {
                const cellVal = grid[targetR]?.[targetC]?.val || '';
                if (cellVal === seg.num) {
                  path.push({ r: targetR, c: targetC, val: cellVal, stepName: `Step ${sIdx+1} (${seg.num})` });
                  currR = targetR;
                  currC = targetC;
                } else {
                  chainMatched = false;
                  break;
                }
              } else {
                chainMatched = false;
                break;
              }
            }

            if (chainMatched && path.length === segments.length) {
              const colors = [HIGHLIGHT_COLOR, GREEN_MATCH_COLOR, BLUE_MATCH_COLOR, PURPLE_MATCH_COLOR, RED_MATCH_COLOR];
              path.forEach((p, idx) => {
                const item = {
                  r: p.r, c: p.c,
                  day: DAY_NAMES[p.c],
                  rowNum: p.r + 1,
                  val: p.val,
                  reason: `Chain Step #${idx+1}: ${p.val} on ${DAY_NAMES[p.c]} (Row #${p.r+1})`,
                  color: colors[idx % colors.length]
                };
                matches.push(item);
                matchMap[`${p.r}_${p.c}`] = item;
              });
            }
          }
        });
      }

      if (matches.length > 0) {
        const summary = `Found ${matches.length / segments.length} complete multi-step sequence chain(s) for "${queryStr}"`;
        return { matches, summary, matchMap };
      }
    }
  }

  // -------------------------------------------------------------
  // FEATURE 0.01: COMPOUND CROSS-DIGIT RELATIONS ENGINE
  // E.g. "open to open 4 down and close to close 4 down row mon"
  // E.g. "open to close opposite and close to open same in row 1"
  // -------------------------------------------------------------
  const isCrossDigitQuery = (q.includes('open to close') || q.includes('close to open') || q.includes('open to open') || q.includes('close to close'));
  if (isCrossDigitQuery) {
    const clauses = [];
    const clauseRegex = /(open\s+to\s+close|close\s+to\s+open|open\s+to\s+open|close\s+to\s+close)\s+(same|opposite|cut|dead|\d*\s*up|\d*\s*down)/gi;
    let match;
    while ((match = clauseRegex.exec(q)) !== null) {
      const typeStr = match[1].toLowerCase().replace(/\s+/g, '_');
      const relObj = parseRelation(match[2]);
      clauses.push({ type: typeStr, rel: relObj });
    }

    if (clauses.length > 0) {
      const targetCols = foundDays.length > 0 ? foundDays.map(d => d.col) : Array.from({ length: cols }, (_, i) => i);
      // Strictly check if user requested SAME ROW / HORIZONTAL vs COLUMN / VERTICAL
      const isExplicitSameRow = q.includes('same row') || q.includes('in same row') || q.includes('horizontal');
      const isSameRowMode = isExplicitSameRow || (q.includes('row 1') && foundDays.length === 0);

      for (let r = minR; r <= maxR; r++) {
        // Option 1: Horizontal / Same Row Comparison across ANY two columns (c1 < c2)
        if (isSameRowMode) {
          for (let c1 = 0; c1 < cols - 1; c1++) {
            for (let c2 = c1 + 1; c2 < cols; c2++) {
              const val1 = grid[r]?.[c1]?.val || '';
              const val2 = grid[r]?.[c2]?.val || '';
              if (!val1 || !val2 || !/^\d{2}$/.test(val1) || !/^\d{2}$/.test(val2)) continue;

              const o1 = parseInt(val1[0]), c1Digit = parseInt(val1[1]);
              const o2 = parseInt(val2[0]), c2Digit = parseInt(val2[1]);

              let allClausesPass = true;
              clauses.forEach(cl => {
                let d1, d2;
                if (cl.type === 'open_to_close') { d1 = o1; d2 = c2Digit; }
                else if (cl.type === 'close_to_open') { d1 = c1Digit; d2 = o2; }
                else if (cl.type === 'open_to_open') { d1 = o1; d2 = o2; }
                else if (cl.type === 'close_to_close') { d1 = c1Digit; d2 = c2Digit; }

                if (!checkDigitRelation(d1, d2, cl.rel)) {
                  allClausesPass = false;
                }
              });

              if (allClausesPass) {
                const m1 = { r, c: c1, day: DAY_NAMES[c1], rowNum: r + 1, val: val1, reason: `Row #${r+1} ${DAY_NAMES[c1]} (${val1}) vs ${DAY_NAMES[c2]} (${val2}) Cross-Digit Match`, color: GREEN_MATCH_COLOR };
                const m2 = { r, c: c2, day: DAY_NAMES[c2], rowNum: r + 1, val: val2, reason: `Row #${r+1} ${DAY_NAMES[c1]} (${val1}) vs ${DAY_NAMES[c2]} (${val2}) Cross-Digit Match`, color: GREEN_MATCH_COLOR };
                matches.push(m1, m2);
                matchMap[`${r}_${c1}`] = m1;
                matchMap[`${r}_${c2}`] = m2;
              }
            }
          }
        }

        // Option 2: Vertical / Column Comparison (Row to next Row in target day columns)
        if (!isExplicitSameRow) {
          targetCols.forEach(c => {
            for (let off = 1; off <= 5; off++) {
              if (r + off <= maxR) {
                const val1 = grid[r]?.[c]?.val || '';
                const val2 = grid[r + off]?.[c]?.val || '';
                if (!val1 || !val2 || !/^\d{2}$/.test(val1) || !/^\d{2}$/.test(val2)) continue;

                const o1 = parseInt(val1[0]), c1Digit = parseInt(val1[1]);
                const o2 = parseInt(val2[0]), c2Digit = parseInt(val2[1]);

                let allClausesPass = true;
                clauses.forEach(cl => {
                  let d1, d2;
                  if (cl.type === 'open_to_close') { d1 = o1; d2 = c2Digit; }
                  else if (cl.type === 'close_to_open') { d1 = c1Digit; d2 = o2; }
                  else if (cl.type === 'open_to_open') { d1 = o1; d2 = o2; }
                  else if (cl.type === 'close_to_close') { d1 = c1Digit; d2 = c2Digit; }

                  if (!checkDigitRelation(d1, d2, cl.rel)) {
                    allClausesPass = false;
                  }
                });

                if (allClausesPass) {
                  const m1 = { r, c, day: DAY_NAMES[c], rowNum: r + 1, val: val1, reason: `${DAY_NAMES[c]} Row #${r+1} (${val1}) vs Row #${r+1+off} (${val2}) Cross-Digit Match`, color: GREEN_MATCH_COLOR };
                  const m2 = { r: r + off, c, day: DAY_NAMES[c], rowNum: r + 1 + off, val: val2, reason: `${DAY_NAMES[c]} Row #${r+1} (${val1}) vs Row #${r+1+off} (${val2}) Cross-Digit Match`, color: GREEN_MATCH_COLOR };
                  matches.push(m1, m2);
                  matchMap[`${r}_${c}`] = m1;
                  matchMap[`${r+off}_${c}`] = m2;
                }
              }
            }
          });
        }
      }

      const dayLabel = targetCols.length < cols ? targetCols.map(c => DAY_NAMES[c]).join('/') : 'chart';
      const summary = matches.length > 0
        ? `Found ${matches.length / 2} cross-digit match(es) on ${dayLabel}`
        : `No cross-digit matches found on ${dayLabel} for "${queryStr}".`;
      return { matches, summary, matchMap };
    }
  }

  // -------------------------------------------------------------
  // FEATURE 0.02: JODI FAMILY SEARCH
  // E.g. "03 family" or "family of 03" -> finds [03, 08, 53, 58, 30, 35, 80, 85]
  // -------------------------------------------------------------
  if (q.includes('family') && explicitNumberMatches.length > 0) {
    const targetJodi = explicitNumberMatches[0];
    const familyMembers = getJodiFamily(targetJodi);
    const targetCols = foundDays.length > 0 ? foundDays.map(d => d.col) : Array.from({ length: cols }, (_, i) => i);

    for (let r = minR; r <= maxR; r++) {
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
          matches.push(m);
          matchMap[`${r}_${c}`] = m;
        }
      });
    }

    const summary = matches.length > 0
      ? `Found ${matches.length} cell(s) for ${targetJodi} Family [${familyMembers.join(', ')}]`
      : `No cells found for ${targetJodi} Family [${familyMembers.join(', ')}].`;
    return { matches, summary, matchMap };
  }

  // -------------------------------------------------------------
  // FEATURE 0.03: FALTI / REVERSE / PALAT SEARCH
  // E.g. "31 reverse in between 1 to 12 rows" -> finds 31 & 13 in rows 1..12
  // -------------------------------------------------------------
  if ((q.includes('falti') || q.includes('reverse') || q.includes('palat')) && explicitNumberMatches.length > 0) {
    const num1 = explicitNumberMatches[0];
    const num2 = getFaltiNumber(num1);
    const targetCols = foundDays.length > 0 ? foundDays.map(d => d.col) : Array.from({ length: cols }, (_, i) => i);

    for (let r = minR; r <= maxR; r++) {
      targetCols.forEach(c => {
        const val = grid[r]?.[c]?.val || '';
        if (val === num1 || val === num2) {
          const isFalti = val === num2 && num1 !== num2;
          const m = {
            r, c,
            day: DAY_NAMES[c],
            rowNum: r + 1,
            val,
            reason: isFalti ? `Reverse/Falti of ${num1} (${num2}) on ${DAY_NAMES[c]} (Row #${r+1})` : `Direct ${num1} on ${DAY_NAMES[c]} (Row #${r+1})`,
            color: isFalti ? PURPLE_MATCH_COLOR : HIGHLIGHT_COLOR
          };
          matches.push(m);
          matchMap[`${r}_${c}`] = m;
        }
      });
    }

    const rowRangeStr = (minR === 0 && maxR === grid.length - 1) ? '' : ` (Rows #${minR+1}..#${maxR+1})`;
    const summary = matches.length > 0
      ? `Found ${matches.length} cell(s) for ${num1} and its Reverse/Falti ${num2}${rowRangeStr}`
      : `No cells found for ${num1} or ${num2}${rowRangeStr}.`;
    return { matches, summary, matchMap };
  }

  // -------------------------------------------------------------
  // FEATURE 0.04: N-TH OCCURRENCE & NEARBY TOTAL SEARCH
  // E.g. "10th 88 near 1 total" or "10th 88"
  // -------------------------------------------------------------
  const nthOccurMatch = q.match(/(\d+)(?:st|nd|rd|th)?\s*(\d{2})/);
  if (nthOccurMatch && (q.includes('near') || q.includes('total') || q.includes('occurrence'))) {
    const targetN = parseInt(nthOccurMatch[1]);
    const targetNum = nthOccurMatch[2];

    const totalFilterMatch = q.match(/(\d+)\s*total/) || q.match(/total\s*(\d+)/);
    const targetTotal = totalFilterMatch ? parseInt(totalFilterMatch[1]) : null;

    let occurrencesFound = 0;
    let nthCell = null;

    for (let r = minR; r <= maxR; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r]?.[c]?.val === targetNum) {
          occurrencesFound++;
          if (occurrencesFound === targetN) {
            nthCell = { r, c, val: targetNum };
            break;
          }
        }
      }
      if (nthCell) break;
    }

    if (nthCell) {
      const mOrigin = {
        r: nthCell.r, c: nthCell.c,
        day: DAY_NAMES[nthCell.c],
        rowNum: nthCell.r + 1,
        val: nthCell.val,
        reason: `${targetN}th occurrence of ${targetNum} on ${DAY_NAMES[nthCell.c]} (Row #${nthCell.r+1})`,
        color: HIGHLIGHT_COLOR
      };
      matches.push(mOrigin);
      matchMap[`${nthCell.r}_${nthCell.c}`] = mOrigin;

      if (targetTotal !== null) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            const nr = nthCell.r + dr;
            const nc = nthCell.c + dc;
            if (nr >= minR && nr <= maxR && nc >= 0 && nc < cols) {
              if (nr === nthCell.r && nc === nthCell.c) continue;
              const nVal = grid[nr]?.[nc]?.val || '';
              if (nVal && /^\d{2}$/.test(nVal)) {
                const tot = (parseInt(nVal[0]) + parseInt(nVal[1])) % 10;
                const rawTot = parseInt(nVal[0]) + parseInt(nVal[1]);
                if (tot === targetTotal || rawTot === targetTotal) {
                  const mNear = {
                    r: nr, c: nc,
                    day: DAY_NAMES[nc],
                    rowNum: nr + 1,
                    val: nVal,
                    reason: `Near ${targetN}th ${targetNum}: Total ${targetTotal} (${nVal}) on ${DAY_NAMES[nc]} (Row #${nr+1})`,
                    color: GREEN_MATCH_COLOR
                  };
                  matches.push(mNear);
                  matchMap[`${nr}_${nc}`] = mNear;
                }
              }
            }
          }
        }
      }

      const summary = matches.length > 1
        ? `Found ${targetN}th ${targetNum} (Row #${nthCell.r+1}) and ${matches.length - 1} nearby cell(s) with Total = ${targetTotal}`
        : `Found ${targetN}th occurrence of ${targetNum} on ${DAY_NAMES[nthCell.c]} (Row #${nthCell.r+1})`;
      return { matches, summary, matchMap };
    }
  }

  // -------------------------------------------------------------
  // FEATURE 0.1: ORDINAL WEEK MULTI-NUMBER / TOTAL SEARCH
  // -------------------------------------------------------------
  if (foundDays.length >= 1 && explicitNumberMatches.length >= 1 && q.includes('week')) {
    const startDayCol = foundDays[0].col;
    const num1 = explicitNumberMatches[0];
    const num2 = explicitNumberMatches.length >= 2 ? explicitNumberMatches[1] : null;

    const totalFilterMatch = q.match(/(\d+)\s*total/) || q.match(/total\s*(\d+)/);
    const targetTotal = totalFilterMatch ? parseInt(totalFilterMatch[1]) : null;

    const scanAllTargetCols = q.includes('any') || foundDays.length < 2;

    const wMatch = q.match(/(\d+)(?:st|nd|rd|th)?\s*week/);
    const weekOffset = wMatch ? parseInt(wMatch[1]) - 1 : 1;

    for (let r = minR; r <= maxR; r++) {
      if (grid[r]?.[startDayCol]?.val === num1) {
        const targetR = r + weekOffset;
        if (targetR <= maxR && targetR < grid.length) {
          const targetColsToScan = !scanAllTargetCols && foundDays.length >= 2
            ? [foundDays[1].col]
            : Array.from({ length: cols }, (_, i) => i);

          targetColsToScan.forEach(targetDayCol => {
            const targetVal = grid[targetR]?.[targetDayCol]?.val || '';
            if (!targetVal || !/^\d{2}$/.test(targetVal)) return;

            const numOk = !num2 || targetVal === num2;

            let totalOk = true;
            if (targetTotal !== null) {
              const t1 = parseInt(targetVal[0]) + parseInt(targetVal[1]);
              const t2 = t1 % 10;
              const t3 = calculateTotal ? calculateTotal(targetVal) : t1;
              totalOk = t1 === targetTotal || t2 === targetTotal || t3 === targetTotal;
            }

            if (numOk && totalOk) {
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
  // FEATURE 0.5: STRICT NUMBER DEAD PAIR ENGINE
  // E.g. "88 dead same col" or "81 dead fri"
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
      for (let r = minR; r <= maxR; r++) {
        if (grid[r]?.[c]?.val === targetNum) {
          const m = { r, c, day: DAY_NAMES[c], rowNum: r + 1, val: targetNum, reason: `${targetNum} on ${DAY_NAMES[c]} (Row #${r+1})`, color: HIGHLIGHT_COLOR };
          matches.push(m);
          matchMap[`${r}_${c}`] = m;
        }
        if (grid[r]?.[c]?.val === deadVal) {
          const m2 = { r, c, day: DAY_NAMES[c], rowNum: r + 1, val: deadVal, reason: `Dead of ${targetNum} → ${deadVal} on ${DAY_NAMES[c]} (Row #${r+1})`, color: GREEN_MATCH_COLOR };
          matches.push(m2);
          matchMap[`${r}_${c}`] = m2;
        }
      }
    });

    const deadSummary = matches.length > 0
      ? `Found ${matches.length} cell(s): ${targetNum} and its dead pair ${deadVal} on ${colsToScan.map(c => DAY_NAMES[c]).join('/')}`
      : `Dead pair of ${targetNum} is ${deadVal}. Neither found on ${colsToScan.map(c => DAY_NAMES[c]).join('/')}.`;
    return { matches, summary: deadSummary, matchMap };
  }

  // -------------------------------------------------------------
  // FEATURE 6: SINGLE NUMBER SEARCH WITH STRICT DAY FILTER
  // -------------------------------------------------------------
  if (explicitNumberMatches.length === 1) {
    const numToFind = explicitNumberMatches[0];
    const targetCol = foundDays.length > 0 ? foundDays[0].col : null;

    for (let r = minR; r <= maxR; r++) {
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
