/**
 * Universal Multi-Clause Natural Language Query Engine for Matka Chart
 * Features:
 * - Non-greedy Cross-Digit Tokenizer (properly parses multiple clauses e.g. open to open same AND close to close one down)
 * - Multi-Color Pair Palette (Emerald 🟢, Cyan 🔵, Purple 🟣, Pink 🩷, Amber 🟡)
 * - Strict Cross-Digit Validation (guarantees exact step matches e.g. 1-down 55-54, rejecting false matches like 84-88, 86-89)
 * - Pair Connection Tracking (pairId, stepIndex, targetR, targetC)
 * - Telugu Language & Transliterated Telugu (Telgish/Manglish) Preprocessor Engine
 * - Strict Day Propagation across clauses (e.g. "mon ..." restricts all clauses to Monday)
 * - Independent Multi-Clause Pipeline with Relative Ordinal Week Context
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

const PAIR_COLORS = [
  { bg: '#10b981', border: '#059669', dot: '🟢' },
  { bg: '#06b6d4', border: '#0891b2', dot: '🔵' },
  { bg: '#a855f7', border: '#7e22ce', dot: '🟣' },
  { bg: '#ec4899', border: '#be185d', dot: '🩷' },
  { bg: '#f59e0b', border: '#d97706', dot: '🟡' },
  { bg: '#3b82f6', border: '#1d4ed8', dot: '🔹' }
];

// Telugu & Transliterated Telugu Preprocessor Engine
const preprocessTeluguQuery = (str) => {
  if (!str) return '';
  let q = str.toLowerCase();

  const teluguDigits = ['౦', '౧', '౨', '౩', '౪', '౫', '౬', '౭', '౮', '౯'];
  teluguDigits.forEach((td, idx) => {
    q = q.replaceAll(td, idx.toString());
  });

  q = q.replace(/\b(సోమవారం|somavaramu|somavaram|sombharam|sombharamu|somvar)\b/gi, 'mon');
  q = q.replace(/\b(మంగళవారం|mangalavaramu|mangalavaram|mangalvar|mangal)\b/gi, 'tue');
  q = q.replace(/\b(బుధవారం|budhavaramu|budhavaram|budhvar|budha|budh)\b/gi, 'wed');
  q = q.replace(/\b(గురువారం|guruvaramu|guruvaram|gurvar|guru)\b/gi, 'thu');
  q = q.replace(/\b(శుక్రవారం|sukravaramu|sukravaram|shukravaram|sukra)\b/gi, 'fri');
  q = q.replace(/\b(శనివారం|sanivaramu|sanivaram|shanivaram|sani)\b/gi, 'sat');
  q = q.replace(/\b(ఆదివారం|adivaramu|adivaram|aadivaram|aadi)\b/gi, 'sun');

  q = q.replace(/\b(దగ్గర|daggara|pakkana|చేరువ|cheruva)\b/gi, 'near');
  q = q.replace(/\b(తరువాత|taruvatha|tarvata|tharuwatha|tarwata)\b/gi, 'after');
  q = q.replace(/\b(ముందు|mundu|munde|ముందే)\b/gi, 'before');
  q = q.replace(/\b(వారం|varam|vaaram|వారము|వరుస|varusa)\b/gi, 'week');
  q = q.replace(/\b(మొత్తం|mottam|mothamy|motham|కూడిక|kudika)\b/gi, 'total');
  q = q.replace(/\b(తిరిగి|tirigi|ultha|ulta|తిరగేసి|tiragesi|తిరగి)\b/gi, 'reverse');
  q = q.replace(/\b(అదే|ade|సమానం|samanam|okate|ఒకే)\b/gi, 'same');
  q = q.replace(/\b(కట్|cut|వ్యతిరేకం|vyatirekam)\b/gi, 'opposite');
  q = q.replace(/\b(రెడ్ జంట|red janta|ఎరుపు|erupu|red pair)\b/gi, 'red pair');
  q = q.replace(/\b(జంట|janta|జోడీ|jodi)\b/gi, 'jodi');

  return q;
};

// Helper to extract row range
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

const getFaltiNumber = (numStr) => {
  if (!numStr || numStr.length !== 2) return null;
  return `${numStr[1]}${numStr[0]}`;
};

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

  let step = null;
  Object.keys(WORD_TO_NUM).forEach(wKey => {
    if (lower.includes(`${wKey} down`) || lower.includes(`${wKey} up`)) {
      step = WORD_TO_NUM[wKey];
    }
  });

  const digitMatch = lower.match(/(\d+)\s*(?:down|up)/);
  if (digitMatch) {
    step = parseInt(digitMatch[1]);
  }

  if (step === null) {
    if (lower.includes('down') || lower.includes('up')) step = 1;
  }

  if (lower.includes('down')) return { type: 'DOWN', step: step || 1 };
  if (lower.includes('up')) return { type: 'UP', step: step || 1 };

  return null;
};

const checkDigitRelation = (d1, d2, rel) => {
  if (!rel) return false;
  if (rel.type === 'SAME') return d1 === d2;
  if (rel.type === 'OPPOSITE') return d2 === (d1 + 5) % 10;
  if (rel.type === 'UP') return d2 === (d1 + rel.step + 10) % 10;
  if (rel.type === 'DOWN') return d2 === (d1 - rel.step + 10) % 10;
  return false;
};

export const parseAndSearchChart = (queryStr, grid, cols = 7) => {
  if (!queryStr || !grid || grid.length === 0) {
    return { matches: [], summary: 'Type a query in simple English or Telugu to search the chart.', matchMap: {} };
  }

  const q = preprocessTeluguQuery(queryStr).trim();
  const matches = [];
  const matchMap = {};

  const HIGHLIGHT_COLOR = '#f59e0b';
  const RED_MATCH_COLOR = '#ef4444';
  const PURPLE_MATCH_COLOR = '#a855f7';

  let { minR, maxR, isRestricted } = parseRowRange(q, grid.length);

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

  const words = q.split(/\s+/);
  const globalDays = [];
  words.forEach(w => {
    const cw = w.replace(/[^a-z]/g, '');
    if (DAY_MAP[cw] !== undefined && !globalDays.includes(DAY_MAP[cw])) {
      globalDays.push(DAY_MAP[cw]);
    }
  });

  const rawClauses = q.split(/\s*(?:and|then)\s*/i);

  let lastOriginRow = 0;
  let pairCounter = 1;

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

    const clauseWords = cStr.split(/\s+/);
    const clauseDays = [];
    clauseWords.forEach(w => {
      const cw = w.replace(/[^a-z]/g, '');
      if (DAY_MAP[cw] !== undefined && !clauseDays.includes(DAY_MAP[cw])) {
        clauseDays.push(DAY_MAP[cw]);
      }
    });

    const effectiveDays = clauseDays.length > 0 ? clauseDays : (globalDays.length > 0 ? globalDays : Array.from({ length: cols }, (_, i) => i));
    const clauseNums = cStr.match(/\b\d{2}\b/g) || [];

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

    // CLAUSE TYPE CROSS-DIGIT: Non-Greedy Tokenized Multi-Clause Matcher
    if (isCrossDigitQuery) {
      const crossClauses = [];
      const hasOrLogic = cStr.includes(' or ');

      // Split cleanly by cross-digit relation keywords without greedy swallowing
      const subTokens = cStr.split(/\s*(?=open\s+to\s+close|close\s+to\s+open|open\s+to\s+open|close\s+to\s+close)/i);

      subTokens.forEach(tok => {
        const subMatch = tok.match(/(open\s+to\s+close|close\s+to\s+open|open\s+to\s+open|close\s+to\s+close)\s*(.*)/i);
        if (subMatch) {
          const typeStr = subMatch[1].toLowerCase().replace(/\s+/g, '_');
          const relObj = parseRelation(subMatch[2]);
          if (relObj) {
            crossClauses.push({ type: typeStr, rel: relObj });
          }
        }
      });

      const targetCols = effectiveDays;
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
              const pIdx = pairCounter++;
              const pId = `P${pIdx}`;
              const palette = PAIR_COLORS[(pIdx - 1) % PAIR_COLORS.length];

              const m1 = { r: r1, c, day: DAY_NAMES[c], rowNum: r1 + 1, val: val1, pairId: pId, stepIndex: 1, targetR: r2, targetC: c, reason: `${DAY_NAMES[c]} Row #${r1+1} (${val1}) paired with Row #${r2+1} (${val2})`, color: palette.bg, border: palette.border, dot: palette.dot };
              const m2 = { r: r2, c, day: DAY_NAMES[c], rowNum: r2 + 1, val: val2, pairId: pId, stepIndex: 2, targetR: r1, targetC: c, reason: `${DAY_NAMES[c]} Row #${r2+1} (${val2}) paired with Row #${r1+1} (${val1})`, color: palette.bg, border: palette.border, dot: palette.dot };
              matches.push(m1, m2);
              matchMap[`${r1}_${c}`] = m1;
              matchMap[`${r2}_${c}`] = m2;
            }
          }
        }
      });
    }

    // CLAUSE TYPE A: Proximity Search with Totals
    else if (hasNear && clauseTotals.length >= 1) {
      const originDayCol = clauseDays.length > 0 ? clauseDays[0] : (globalDays.length > 0 ? globalDays[0] : null);
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
                color: '#10b981'
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
                          color: '#10b981'
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

    // CLAUSE TYPE B: Red Pair Handler
    else if (hasRedPair) {
      const targetCols = effectiveDays;
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

    // CLAUSE TYPE C: Explicit Number Search
    else if (clauseNums.length > 0 && !hasFamily && !hasReverse) {
      const numToFind = clauseNums[0];
      const targetCols = effectiveDays;

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

    // CLAUSE TYPE D: Total Filter Search
    else if (clauseTotals.length > 0 && clauseNums.length === 0) {
      const reqTotal = clauseTotals[0];
      const targetCols = effectiveDays;

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
                color: '#10b981'
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

    // CLAUSE TYPE E: Reverse / Falti Search
    else if (hasReverse && (clauseNums.length > 0 || hasRedPair)) {
      const num1 = clauseNums.length > 0 ? clauseNums[0] : null;
      const num2 = num1 ? getFaltiNumber(num1) : null;
      const targetCols = effectiveDays;

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

    // CLAUSE TYPE F: Jodi Family Search
    else if (hasFamily && clauseNums.length > 0) {
      const targetJodi = clauseNums[0];
      const familyMembers = getJodiFamily(targetJodi);
      const targetCols = effectiveDays;

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
              color: '#10b981'
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
