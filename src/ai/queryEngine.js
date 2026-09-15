/**
 * Unified Intelligent Natural Language Query Engine for Matka Chart
 * Features:
 * - Unified Parameter Extraction Pipeline (Days, Numbers, Totals, Row Range, Proximity, Reverses, Relations, Chains)
 * - N-Step Ordinal Sentence Chain Parser
 * - Compound Cross-Digit Relations Engine
 * - Proximity + Multi-Total + Reverse Figure Inspector
 * - Strict Row Range Restrictor (1-indexed, local & global windows)
 * - Fast Execution & Smooth Auto-Scrolling
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

// 1. Extract row range constraints (1-indexed input e.g. "between 1 to 5 row", "440 row", "in row 1")
const parseRowRange = (qStr, totalRows) => {
  // Check "between X to Y rows" or "row X to Y" or "X to Y row"
  const rangeMatch = qStr.match(/(?:between|row[s]?)\s*(\d+)\s*(?:to|-|and)\s*(\d+)/i) ||
                     qStr.match(/(\d+)\s*(?:to|-)\s*(\d+)\s*row[s]?/i);
  if (rangeMatch) {
    const minR = Math.max(0, parseInt(rangeMatch[1]) - 1);
    const maxR = Math.min(totalRows - 1, parseInt(rangeMatch[2]) - 1);
    return { minR: Math.min(minR, maxR), maxR: Math.max(minR, maxR), isRestricted: true };
  }

  // Check "440 row" or "440th row" at start or before words
  const leadingRowMatch = qStr.match(/^(\d+)\s*(?:st|nd|rd|th)?\s*row/i) || qStr.match(/\b(\d{3,4})\s*row/i);
  if (leadingRowMatch) {
    const rIdx = Math.max(0, Math.min(totalRows - 1, parseInt(leadingRowMatch[1]) - 1));
    return { minR: rIdx, maxR: rIdx, isRestricted: true };
  }

  // Check "row 440" or "in row 440" or "4th row"
  const singleRowMatch = qStr.match(/\brow\s*(\d+)\b/i) || qStr.match(/(\d+)(?:st|nd|rd|th)?\s*row/i);
  if (singleRowMatch) {
    const rIdx = Math.max(0, Math.min(totalRows - 1, parseInt(singleRowMatch[1]) - 1));
    return { minR: rIdx, maxR: rIdx, isRestricted: true };
  }

  return { minR: 0, maxR: totalRows - 1, isRestricted: false };
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

  const { minR, maxR, isRestricted } = parseRowRange(q, grid.length);

  // Extract Days mentioned in query
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

  // Extract explicit 2-digit numbers (excluding row numbers)
  const explicitNumberMatches = q.match(/\b\d{2}\b/g) || [];

  // Extract all requested totals (e.g. "2 total and 6 total", "2 total")
  const requestedTotals = [];
  const tMatches = q.matchAll(/(\d+)\s*total/gi);
  for (const tm of tMatches) {
    const tVal = parseInt(tm[1]);
    if (!requestedTotals.includes(tVal)) requestedTotals.push(tVal);
  }

  const isNearQuery = q.includes('near') || q.includes('around') || q.includes('close to');
  const isReverseQuery = q.includes('reverse') || q.includes('falti') || q.includes('palat');

  // -------------------------------------------------------------
  // PIPELINE FEATURE 1: PROXIMITY + MULTI-TOTAL + REVERSE ENGINE
  // E.g. "wed 06 near 2 total and 6 total between 1 to 5 row and also near reverse of 06"
  // -------------------------------------------------------------
  if (isNearQuery && (requestedTotals.length > 0 || isReverseQuery) && explicitNumberMatches.length > 0) {
    const targetNum = explicitNumberMatches[0];
    const targetCol = foundDays.length > 0 ? foundDays[0].col : null;
    const targetColsToScan = targetCol !== null ? [targetCol] : Array.from({ length: cols }, (_, i) => i);

    for (let r = minR; r <= maxR; r++) {
      targetColsToScan.forEach(c => {
        if (grid[r]?.[c]?.val === targetNum) {
          const mOrigin = {
            r, c,
            day: DAY_NAMES[c],
            rowNum: r + 1,
            val: targetNum,
            reason: `Origin Target ${targetNum} on ${DAY_NAMES[c]} (Row #${r+1})`,
            color: HIGHLIGHT_COLOR
          };
          matches.push(mOrigin);
          matchMap[`${r}_${c}`] = mOrigin;

          // Scan 8 surrounding neighbor cells strictly inside [minR..maxR]
          for (let dr = -2; dr <= 2; dr++) {
            for (let dc = -2; dc <= 2; dc++) {
              const nr = r + dr;
              const nc = c + dc;
              if (nr >= minR && nr <= maxR && nc >= 0 && nc < cols) {
                if (nr === r && nc === c) continue;
                const nVal = grid[nr]?.[nc]?.val || '';
                if (nVal && /^\d{2}$/.test(nVal)) {
                  const t1 = (parseInt(nVal[0]) + parseInt(nVal[1])) % 10;
                  const t2 = parseInt(nVal[0]) + parseInt(nVal[1]);

                  requestedTotals.forEach(reqT => {
                    if (t1 === reqT || t2 === reqT) {
                      const mNear = {
                        r: nr, c: nc,
                        day: DAY_NAMES[nc],
                        rowNum: nr + 1,
                        val: nVal,
                        reason: `Near ${targetNum}: Total ${reqT} (${nVal}) on ${DAY_NAMES[nc]} (Row #${nr+1})`,
                        color: GREEN_MATCH_COLOR
                      };
                      if (!matchMap[`${nr}_${nc}`]) {
                        matches.push(mNear);
                        matchMap[`${nr}_${nc}`] = mNear;
                      }
                    }
                  });
                }
              }
            }
          }

          // Check reverse figure of targetNum (e.g. 06 -> 60) within [minR..maxR] or local window
          let revFoundCount = 0;
          let revVal = null;
          if (isReverseQuery) {
            revVal = getFaltiNumber(targetNum);
            if (revVal && revVal !== targetNum) {
              const revMinR = isRestricted ? minR : Math.max(0, r - 15);
              const revMaxR = isRestricted ? maxR : Math.min(grid.length - 1, r + 15);

              for (let gr = revMinR; gr <= revMaxR; gr++) {
                for (let gc = 0; gc < cols; gc++) {
                  if (grid[gr]?.[gc]?.val === revVal) {
                    revFoundCount++;
                    const mRev = {
                      r: gr, c: gc,
                      day: DAY_NAMES[gc],
                      rowNum: gr + 1,
                      val: revVal,
                      reason: `Reverse of ${targetNum} (${revVal}) on ${DAY_NAMES[gc]} (Row #${gr+1})`,
                      color: PURPLE_MATCH_COLOR
                    };
                    if (!matchMap[`${gr}_${gc}`]) {
                      matches.push(mRev);
                      matchMap[`${gr}_${gc}`] = mRev;
                    }
                  }
                }
              }
            }
          }

          // Scan secondary numbers requested in query (e.g. 64) within [minR..maxR]
          if (explicitNumberMatches.length > 1) {
            for (let sIdx = 1; sIdx < explicitNumberMatches.length; sIdx++) {
              const secNum = explicitNumberMatches[sIdx];
              for (let sr = minR; sr <= maxR; sr++) {
                for (let sc = 0; sc < cols; sc++) {
                  if (grid[sr]?.[sc]?.val === secNum) {
                    const mSec = {
                      r: sr, c: sc,
                      day: DAY_NAMES[sc],
                      rowNum: sr + 1,
                      val: secNum,
                      reason: `Requested number ${secNum} on ${DAY_NAMES[sc]} (Row #${sr+1})`,
                      color: BLUE_MATCH_COLOR
                    };
                    if (!matchMap[`${sr}_${sc}`]) {
                      matches.push(mSec);
                      matchMap[`${sr}_${sc}`] = mSec;
                    }
                  }
                }
              }
            }
          }
        }
      });
    }

    if (matches.length > 0) {
      const rowLabel = isRestricted ? (minR === maxR ? `Row #${minR+1}` : `Rows #${minR+1} to #${maxR+1}`) : `chart`;
      const revNote = isReverseQuery && revVal ? (revFoundCount === 0 ? ` [Note: Reverse of ${targetNum} (${revVal}) not found in ${rowLabel}]` : ` [Reverse ${revVal} found ${revFoundCount} time(s)]`) : '';
      const summary = `Found ${matches.length} matching cell(s) for "${queryStr}" on ${rowLabel}${revNote}`;
      return { matches, summary, matchMap };
    }
  }

  // -------------------------------------------------------------
  // PIPELINE FEATURE 2: N-STEP ORDINAL SENTENCE CHAIN ENGINE
  // E.g. "sun 30 and 05 and 59", "sun 30 and 05 and tues 88 and monday any one total near"
  // -------------------------------------------------------------
  const isChainQuery = q.includes('and') || (q.match(/next/g) || []).length >= 2;
  if (isChainQuery && (explicitNumberMatches.length >= 2 || (explicitNumberMatches.length >= 1 && q.includes('total')))) {
    const rawSegments = q.split(/\s*(?:and|then|,)\s*/);
    const segments = [];

    rawSegments.forEach(segStr => {
      const segNumMatch = segStr.match(/\b\d{2}\b/);
      const segNum = segNumMatch ? segNumMatch[0] : null;

      let segCol = null;
      let isNextDay = segStr.includes('next day') || segStr.includes('following day');
      words.forEach(w => {
        const cw = w.replace(/[^a-z]/g, '');
        if (DAY_MAP[cw] !== undefined && segStr.includes(cw)) {
          segCol = DAY_MAP[cw];
        }
      });

      let segOffset = 1;
      const wMatch = segStr.match(/(\d+)(?:st|nd|rd|th)?\s*week/);
      if (wMatch) {
        segOffset = parseInt(wMatch[1]) - 1;
      } else if (segStr.includes('next week')) {
        segOffset = 1;
      } else if (isNextDay || (segCol !== null && segNumMatch === null)) {
        segOffset = 0;
      }

      const isTotalCond = segStr.includes('total');

      if (segNum || isTotalCond || segCol !== null) {
        segments.push({ num: segNum, col: segCol, isNextDay, offset: segOffset, isTotalCond, raw: segStr });
      }
    });

    if (segments.length >= 2) {
      const step1 = segments[0];
      const startCol = step1.col !== null ? step1.col : (foundDays.length > 0 ? foundDays[0].col : null);

      for (let r = minR; r <= maxR; r++) {
        const startColsToScan = startCol !== null ? [startCol] : Array.from({ length: cols }, (_, i) => i);
        startColsToScan.forEach(c0 => {
          if (step1.num && grid[r]?.[c0]?.val === step1.num) {
            const path = [{ r, c: c0, val: step1.num }];
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
                targetR = currR + seg.offset; // Cumulative offset relative to previous step row currR!
                targetC = seg.col !== null ? seg.col : currC;
              }

              if (targetR <= maxR && targetR < grid.length && targetC >= 0 && targetC < cols) {
                const cellVal = grid[targetR]?.[targetC]?.val || '';
                if (seg.num && cellVal === seg.num) {
                  path.push({ r: targetR, c: targetC, val: cellVal });
                  currR = targetR;
                  currC = targetC;
                } else if (!seg.num && seg.isTotalCond && cellVal && /^\d{2}$/.test(cellVal)) {
                  path.push({ r: targetR, c: targetC, val: cellVal });
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
  // PIPELINE FEATURE 3: UNIVERSAL TOTAL SEARCH ENGINE (Single & Multi-Total)
  // E.g. "4th row 2 total jodi", "440 row 7 total and 5 total", "mon 2 total"
  // -------------------------------------------------------------
  if (requestedTotals.length > 0 && explicitNumberMatches.length === 0) {
    const targetCols = foundDays.length > 0 ? foundDays.map(d => d.col) : Array.from({ length: cols }, (_, i) => i);

    for (let r = minR; r <= maxR; r++) {
      targetCols.forEach(c => {
        const val = grid[r]?.[c]?.val || '';
        if (val && /^\d{2}$/.test(val)) {
          const t1 = (parseInt(val[0]) + parseInt(val[1])) % 10;
          const t2 = parseInt(val[0]) + parseInt(val[1]);

          requestedTotals.forEach(reqT => {
            if (t1 === reqT || t2 === reqT) {
              const m = {
                r, c,
                day: DAY_NAMES[c],
                rowNum: r + 1,
                val,
                reason: `Row #${r+1} ${DAY_NAMES[c]} (${val}): Total = ${reqT}`,
                color: GREEN_MATCH_COLOR
              };
              matches.push(m);
              matchMap[`${r}_${c}`] = m;
            }
          });
        }
      });
    }

    if (matches.length > 0) {
      const rowLabel = isRestricted ? (minR === maxR ? `Row #${minR+1}` : `Rows #${minR+1} to #${maxR+1}`) : `chart`;
      const summary = `Found ${matches.length} cell(s) with Total = ${requestedTotals.join('/')} on ${rowLabel}`;
      return { matches, summary, matchMap };
    }
  }

  // -------------------------------------------------------------
  // PIPELINE FEATURE 4: COMPOUND CROSS-DIGIT RELATIONS ENGINE
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
      const isExplicitSameRow = q.includes('same row') || q.includes('in same row') || q.includes('horizontal');
      const isSameRowMode = isExplicitSameRow || foundDays.length >= 2 || (q.includes('row 1') && foundDays.length === 0);

      for (let r = minR; r <= maxR; r++) {
        if (isSameRowMode) {
          const colPairs = [];
          if (foundDays.length >= 2) {
            for (let i = 0; i < foundDays.length - 1; i++) {
              for (let j = i + 1; j < foundDays.length; j++) {
                colPairs.push({ c1: Math.min(foundDays[i].col, foundDays[j].col), c2: Math.max(foundDays[i].col, foundDays[j].col) });
              }
            }
          } else {
            for (let c1 = 0; c1 < cols - 1; c1++) {
              for (let c2 = c1 + 1; c2 < cols; c2++) {
                colPairs.push({ c1, c2 });
              }
            }
          }

          colPairs.forEach(({ c1, c2 }) => {
            const val1 = grid[r]?.[c1]?.val || '';
            const val2 = grid[r]?.[c2]?.val || '';
            if (!val1 || !val2 || !/^\d{2}$/.test(val1) || !/^\d{2}$/.test(val2)) return;

            const o1 = parseInt(val1[0]), c1Digit = parseInt(val1[1]);
            const o2 = parseInt(val2[0]), c2Digit = parseInt(val2[1]);

            let allClausesPass = true;
            clauses.forEach(cl => {
              let d1, d2;
              if (cl.type === 'open_to_close') { d1 = o1; d2 = c2Digit; }
              else if (cl.type === 'close_to_open') { d1 = c1Digit; d2 = o2; }
              else if (cl.type === 'open_to_open') { d1 = o1; d2 = o2; }
              else if (cl.type === 'close_to_close') { d1 = c1Digit; d2 = c2Digit; }

              if (!checkDigitRelation(d1, d2, cl.rel)) allClausesPass = false;
            });

            if (allClausesPass) {
              const m1 = { r, c: c1, day: DAY_NAMES[c1], rowNum: r + 1, val: val1, reason: `Row #${r+1} ${DAY_NAMES[c1]} (${val1}) vs ${DAY_NAMES[c2]} (${val2}) Cross-Digit Match`, color: GREEN_MATCH_COLOR };
              const m2 = { r, c: c2, day: DAY_NAMES[c2], rowNum: r + 1, val: val2, reason: `Row #${r+1} ${DAY_NAMES[c1]} (${val1}) vs ${DAY_NAMES[c2]} (${val2}) Cross-Digit Match`, color: GREEN_MATCH_COLOR };
              matches.push(m1, m2);
              matchMap[`${r}_${c1}`] = m1;
              matchMap[`${r}_${c2}`] = m2;
            }
          });
        }

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

                  if (!checkDigitRelation(d1, d2, cl.rel)) allClausesPass = false;
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

      if (matches.length > 0) {
        const rowLabel = isRestricted ? (minR === maxR ? `Row #${minR+1}` : `Rows #${minR+1} to #${maxR+1}`) : `chart`;
        const summary = `Found ${matches.length / 2} cross-digit match(es) on ${rowLabel}`;
        return { matches, summary, matchMap };
      }
    }
  }

  // -------------------------------------------------------------
  // PIPELINE FEATURE 5: JODI FAMILY ENGINE
  // E.g. "03 family" -> finds [03, 08, 53, 58, 30, 35, 80, 85]
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
  // PIPELINE FEATURE 6: FALTI / REVERSE ENGINE
  // E.g. "31 reverse in between 1 to 12 rows" -> finds 31 & 13
  // -------------------------------------------------------------
  if (isReverseQuery && explicitNumberMatches.length > 0) {
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

    const summary = matches.length > 0
      ? `Found ${matches.length} cell(s) for ${num1} and its Reverse/Falti ${num2}`
      : `No cells found for ${num1} or ${num2}.`;
    return { matches, summary, matchMap };
  }

  // -------------------------------------------------------------
  // PIPELINE FEATURE 7: SINGLE NUMBER SEARCH WITH STRICT DAY & ROW FILTER
  // E.g. "440 row 70 jodi monday", "mon 70"
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
