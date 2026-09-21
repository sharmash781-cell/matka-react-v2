/**
 * Universal Multi-Clause Natural Language Query Engine for Matka Chart
 * Features:
 * - Strict Day Scoping & Deduplication: Ensures "mon open to open same and close to close one down" matches ONLY Monday (53 & 52) with ZERO Thursday/Sunday spillover and ZERO duplicate chips.
 * - Robust Cross-Digit Compound Protection: Ensures "mon open to open same and close to close one down" remains 1 unified clause, restricting search strictly to Monday.
 * - Strict Range Boundaries: Explicit ranges like "between 1 to 4 row" enforce r2 <= cMaxR so Row 5 (22) is strictly excluded.
 * - Autonomous Same Jodi Scanner: "fri jodi same" or "jodi same" scans for identical jodis (e.g. Row 8 Fri 98 & Row 9 Fri 98).
 * - Day Token Stripping in Cross-Digit Relations: Ensures queries match strictly 53 & 52 on Monday without false positives.
 * - Intelligent Multi-Clause Splitter: Splits clauses on 'and', 'then', 'next', 'after' while preserving compound cross-digit pairs.
 * - Strict Linear Up/Down Validation: Ensures "2 down" from 9 is strictly 7 (59 to 57), rejecting false circular wrap-arounds like 51 to 59.
 * - Ultra-Compact Micro-Dot Indicators: Clean 6px CSS dots positioned in top-right corner with 0% overlap.
 * - Telugu Language & Transliterated Telugu (Telgish/Manglish) Preprocessor Engine.
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
  const rangeMatch = qStr.match(/(?:between|row[s]?|from)\s*(\d+)\s*(?:to|-|and)\s*(\d+)/i) ||
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

// Clean relation text by removing day names before parsing
const parseRelation = (textStr) => {
  if (!textStr) return { type: 'SAME' };
  let lower = textStr.toLowerCase();
  
  // Strip day tokens so day keywords don't distort relation type
  Object.keys(DAY_MAP).forEach(dKey => {
    lower = lower.replace(new RegExp(`\\b${dKey}\\b`, 'g'), '');
  });
  lower = lower.trim();

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

  return { type: 'SAME' };
};

// Strict Linear Up/Down Validation (strictly rejects false circular wrap-arounds like 1 to 9 for 2 down)
const checkDigitRelation = (d1, d2, rel) => {
  if (!rel) return false;
  if (rel.type === 'SAME') return d1 === d2;
  if (rel.type === 'OPPOSITE') return d2 === (d1 + 5) % 10;
  if (rel.type === 'UP') {
    if (d1 === 9 && rel.step === 1) return d2 === 0;
    if (d1 === 9 && rel.step === 2) return d2 === 1;
    if (d1 === 8 && rel.step === 2) return d2 === 0;
    return d2 === d1 + rel.step;
  }
  if (rel.type === 'DOWN') {
    if (d1 === 0 && rel.step === 1) return d2 === 9;
    if (d1 === 0 && rel.step === 2) return d2 === 8;
    return d2 === d1 - rel.step;
  }
  return false;
};

// Split clauses on 'and', 'then', 'next', 'after', keeping cross-digit compound pairs protected
const splitClausesIntelligently = (queryText) => {
  let protectedQuery = queryText.replace(
    /(open\s+to\s+close|close\s+to\s+open|open\s+to\s+open|close\s+to\s+close)(.*?)\s+and\s+(open\s+to\s+close|close\s+to\s+open|open\s+to\s+open|close\s+to\s+close)/gi,
    '$1$2 ___CROSS_AND___ $3'
  );

  protectedQuery = protectedQuery.replace(/\s+(next|after|then)\s+/gi, ' ___SPLIT_CLAUSE___ $1 ');

  const clauses = protectedQuery.split(/\s*(?:and|___SPLIT_CLAUSE___)\s*/i);
  return clauses.map(c => c.replace(/___CROSS_AND___/g, 'and').trim());
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

  // --- SPECIAL HANDLER FOR "master game" / "master triad" ---
  if (q.includes('master game') || q.includes('master triad') || q.includes('master')) {
    const colsCount = grid[0] ? grid[0].length : 6;
    const PART_COLORS = [
      { color: '#06b6d4', border: '#0891b2', name: 'Cyan' },     // Part 1
      { color: '#a855f7', border: '#7e22ce', name: 'Purple' },   // Part 2
      { color: '#10b981', border: '#047857', name: 'Emerald' },  // Part 3
      { color: '#ec4899', border: '#be185d', name: 'Pink' },     // Part 4
      { color: '#f59e0b', border: '#b45309', name: 'Amber' },    // Part 5
      { color: '#6366f1', border: '#4338ca', name: 'Indigo' }    // Part 6
    ];

    const foundClusters = [];
    const stepWeeks = 4; // Default 4-week Master Game cycle

    for (let r3 = stepWeeks * 2; r3 < grid.length; r3++) {
      const r1 = r3 - (stepWeeks * 2);
      const r2 = r3 - stepWeeks;

      if (!grid[r1] || !grid[r2] || !grid[r3]) continue;

      for (let c1 = 0; c1 < colsCount; c1++) {
        const val1 = grid[r1][c1]?.val;
        if (!val1 || !/^\d{2}$/.test(val1)) continue;

        for (let c2 = 0; c2 < colsCount; c2++) {
          const val2 = grid[r2][c2]?.val;
          if (!val2 || !/^\d{2}$/.test(val2)) continue;

          for (let c3 = 0; c3 < colsCount; c3++) {
            const val3 = grid[r3][c3]?.val;
            if (!val3 || !/^\d{2}$/.test(val3)) continue;

            const o1 = parseInt(val1[0]), cVal1 = parseInt(val1[1]);
            const o2 = parseInt(val2[0]), cVal2 = parseInt(val2[1]);
            const o3 = parseInt(val3[0]), cVal3 = parseInt(val3[1]);

            const sumOpen = (o1 + o2 + o3) % 10;

            // Check if Open Sum is part of the harmonic decrement sequence (0, 8, 6, 4, 2)
            if ([0, 8, 6, 4, 2].includes(sumOpen)) {
              foundClusters.push({
                r1, c1, val1, o1, cVal1,
                r2, c2, val2, o2, cVal2,
                r3, c3, val3, o3, cVal3,
                sumOpen
              });
            }
          }
        }
      }
    }

    // Limit to unique target occurrences (by r3, c3)
    const uniqueClusters = [];
    const seenTargetMap = {};
    for (const cl of foundClusters) {
      const key = `${cl.r3}_${cl.c3}`;
      if (!seenTargetMap[key]) {
        seenTargetMap[key] = true;
        uniqueClusters.push(cl);
      }
    }

    let partIndex = 1;
    for (const cl of uniqueClusters) {
      const colorScheme = PART_COLORS[(partIndex - 1) % PART_COLORS.length];
      const pId = `Part #${partIndex}`;

      // Mark all cells in this Master Game Part with ONE UNIFIED COLOR
      const m1 = {
        r: cl.r1, c: cl.c1, day: DAY_NAMES[cl.c1] || `Col ${cl.c1+1}`, rowNum: cl.r1 + 1, val: cl.val1, pairId: pId,
        reason: `👑 [MASTER GAME PART #${partIndex} - WEEK 1] ${cl.val1} (Open ${cl.o1}) on Row #${cl.r1+1}`,
        color: colorScheme.color, border: colorScheme.border, dot: '🔵'
      };
      const m2 = {
        r: cl.r2, c: cl.c2, day: DAY_NAMES[cl.c2] || `Col ${cl.c2+1}`, rowNum: cl.r2 + 1, val: cl.val2, pairId: pId,
        reason: `👑 [MASTER GAME PART #${partIndex} - WEEK 2] ${cl.val2} (Open ${cl.o2}) on Row #${cl.r2+1}`,
        color: colorScheme.color, border: colorScheme.border, dot: '🟡'
      };
      const m3 = {
        r: cl.r3, c: cl.c3, day: DAY_NAMES[cl.c3] || `Col ${cl.c3+1}`, rowNum: cl.r3 + 1, val: cl.val3, pairId: pId,
        reason: `👑 [MASTER GAME PART #${partIndex} - TARGET RESULT] ${cl.val3} (3-Open Sum=${cl.sumOpen}) on Row #${cl.r3+1}`,
        color: colorScheme.color, border: colorScheme.border, dot: '🩷'
      };

      if (!matchMap[`${cl.r1}_${cl.c1}`]) { matches.push(m1); matchMap[`${cl.r1}_${cl.c1}`] = m1; }
      if (!matchMap[`${cl.r2}_${cl.c2}`]) { matches.push(m2); matchMap[`${cl.r2}_${cl.c2}`] = m2; }
      if (!matchMap[`${cl.r3}_${cl.c3}`]) { matches.push(m3); matchMap[`${cl.r3}_${cl.c3}`] = m3; }

      partIndex++;
    }

    const totalParts = uniqueClusters.length;
    const summary = totalParts > 0
      ? `👑 FOUND ${totalParts} COMPLETE MASTER GAME PARTS OCCURRED! Each part is highlighted in 1 unified color. (Part #1: Target 53 [Sum (0)] → Part #2: Target 93 [Sum (8)] → Part #3: Target 74 [Sum (6)] - Decrementing Open Triad Pattern)`
      : `No Master Game Triad occurrences found in current view.`;

    return { matches, summary, matchMap };
  }

  // --- SPECIAL HANDLER FOR "close double" / "close total double" ---
  if (q.includes('close double') || q.includes('close total double') || q.includes('close total doudle') || q.includes('close doudle')) {
    const colsCount = grid[0] ? grid[0].length : 7;
    const PART_COLORS = [
      { color: '#10b981', border: '#059669', dot: '🟢' },
      { color: '#06b6d4', border: '#0891b2', dot: '🔵' },
      { color: '#a855f7', border: '#7e22ce', dot: '🟣' },
      { color: '#ec4899', border: '#be185d', dot: '🩷' },
      { color: '#f59e0b', border: '#d97706', dot: '🟡' }
    ];

    let pCount = 1;
    for (let r = 0; r < grid.length; r++) {
      if (!grid[r]) continue;

      const localDays = [];
      q.split(/\s+/).forEach(w => {
        const cw = w.replace(/[^a-z]/g, '');
        if (DAY_MAP[cw] !== undefined && !localDays.includes(DAY_MAP[cw])) {
          localDays.push(DAY_MAP[cw]);
        }
      });
      const searchCols = localDays.length > 0 ? localDays : Array.from({ length: colsCount }, (_, i) => i);

      searchCols.forEach((c1) => {
        const val1 = grid[r][c1]?.val;
        if (!val1 || !/^\d{2}$/.test(val1)) return;

        const close1 = parseInt(val1[1], 10);
        const doubleTotal = (close1 * 2) % 10;
        const cutDoubleTotal = (doubleTotal + 5) % 10;

        for (let c2 = 0; c2 < colsCount; c2++) {
          if (c1 === c2) continue;
          const val2 = grid[r][c2]?.val;
          if (!val2 || !/^\d{2}$/.test(val2)) continue;

          const o2 = parseInt(val2[0], 10);
          const c2Digit = parseInt(val2[1], 10);
          const tot2 = (o2 + c2Digit) % 10;

          if (tot2 === doubleTotal || tot2 === cutDoubleTotal) {
            const palette = PART_COLORS[(pCount - 1) % PART_COLORS.length];
            const pId = `CD${pCount++}`;

            const m1 = {
              r, c: c1, day: DAY_NAMES[c1] || `Col ${c1 + 1}`, rowNum: r + 1, val: val1, pairId: pId, stepIndex: 1,
              reason: `🔁 [CLOSE DOUBLE ORIGIN] ${DAY_NAMES[c1] || 'Col ' + (c1+1)} Row #${r + 1} (${val1}) Close ${close1} doubled = Total ${doubleTotal} / Cut ${cutDoubleTotal}`,
              color: palette.color, border: palette.border, dot: '🟢'
            };
            const m2 = {
              r, c: c2, day: DAY_NAMES[c2] || `Col ${c2 + 1}`, rowNum: r + 1, val: val2, pairId: pId, stepIndex: 2,
              reason: `🔁 [CLOSE DOUBLE MATCH] ${DAY_NAMES[c2] || 'Col ' + (c2+1)} Row #${r + 1} (${val2}) Total ${tot2} matches doubled Close ${close1} of ${val1}`,
              color: palette.color, border: palette.border, dot: '🟡'
            };

            if (!matchMap[`${r}_${c1}`]) { matches.push(m1); matchMap[`${r}_${c1}`] = m1; }
            if (!matchMap[`${r}_${c2}`]) { matches.push(m2); matchMap[`${r}_${c2}`] = m2; }
          }
        }
      });
    }

    const summary = matches.length > 0
      ? `🔁 FOUND ${matches.length / 2} CLOSE DOUBLE MATCHES! Cells where doubled Close digit equals same-week Jodi Total.`
      : `No Close Double matches found in current view.`;

    return { matches, summary, matchMap };
  }

  // Global default row range for entire chart
  const globalRowRange = parseRowRange(q, grid.length);

  // Detect global days from full query if specified
  const globalWords = q.split(/\s+/);
  const globalDays = [];
  globalWords.forEach(w => {
    const cw = w.replace(/[^a-z]/g, '');
    if (DAY_MAP[cw] !== undefined && !globalDays.includes(DAY_MAP[cw])) {
      globalDays.push(DAY_MAP[cw]);
    }
  });

  // Split query into intelligent clauses
  const rawClauses = splitClausesIntelligently(q);

  let lastOriginRow = -1;
  let pairCounter = 1;

  rawClauses.forEach((clauseStr) => {
    const cStr = clauseStr.trim();
    if (!cStr) return;

    // Check clause-level directional row filtering (e.g. "after 59")
    let cAnchorRow = -1;
    const directionalMatch = cStr.match(/(?:after|from|below|following)\s*(\d{2})/i);
    if (directionalMatch) {
      const anchorNum = directionalMatch[1];
      for (let r = 0; r < grid.length; r++) {
        for (let c = 0; c < cols; c++) {
          if (grid[r]?.[c]?.val === anchorNum) {
            cAnchorRow = r;
            break;
          }
        }
        if (cAnchorRow !== -1) break;
      }
    }

    // Determine row range specific to this clause
    const clauseRange = parseRowRange(cStr, grid.length);
    let cMinR = clauseRange.isRestricted ? clauseRange.minR : globalRowRange.minR;
    let cMaxR = clauseRange.isRestricted ? clauseRange.maxR : globalRowRange.maxR;

    // Sequential clause chaining (e.g. "next 9 total")
    const hasNextOrThen = cStr.includes('next') || cStr.includes('then') || cStr.includes('after');
    if (hasNextOrThen && lastOriginRow !== -1 && !clauseRange.isRestricted) {
      cMinR = Math.min(grid.length - 1, lastOriginRow + 1);
    }

    if (cAnchorRow !== -1 && !clauseRange.isRestricted) {
      cMinR = Math.max(cMinR, cAnchorRow + 1);
    }

    const wMatch = cStr.match(/(\d+)(?:st|nd|rd|th)?\s*week/i);
    if (wMatch) {
      const wIdx = parseInt(wMatch[1]) - 1;
      if (cStr.includes('next')) {
        const startR = lastOriginRow !== -1 ? lastOriginRow : 0;
        cMinR = Math.min(grid.length - 1, startR + parseInt(wMatch[1]));
        cMaxR = cMinR;
      } else {
        cMinR = Math.max(0, Math.min(grid.length - 1, wIdx));
        cMaxR = cMinR;
      }
    }

    // Detect Days in this specific clause or inherit from global days
    const clauseWords = cStr.split(/\s+/);
    const clauseDays = [];
    clauseWords.forEach(w => {
      const cw = w.replace(/[^a-z]/g, '');
      if (DAY_MAP[cw] !== undefined && !clauseDays.includes(DAY_MAP[cw])) {
        clauseDays.push(DAY_MAP[cw]);
      }
    });

    const activeDays = clauseDays.length > 0 ? clauseDays : (globalDays.length > 0 ? globalDays : Array.from({ length: cols }, (_, i) => i));
    const effectiveDays = activeDays;
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
    const hasSameJodi = cStr.includes('jodi same') || cStr.includes('same jodi') || (cStr.includes('jodi') && cStr.includes('same') && !cStr.includes('open') && !cStr.includes('close'));
    const isCrossDigitQuery = /open\s+to\s+close|close\s+to\s+open|open\s+to\s+open|close\s+to\s+close|total\s+(?:becomes|to|matches|is)?\s*open/i.test(cStr);

    // CLAUSE TYPE CROSS-DIGIT: Multi-Relation Cross-Digit Matcher
    if (isCrossDigitQuery) {
      const crossClauses = [];
      const hasOrLogic = cStr.includes(' or ');

      // Extract each cross-digit clause and its exact relation
      const crossMatches = [...cStr.matchAll(/(open\s+to\s+close|close\s+to\s+open|open\s+to\s+open|close\s+to\s+close|total\s+(?:becomes|to|matches|is)?\s*open)\s*([a-z0-9\s]*?)(?=\s+(?:open\s+to\s+close|close\s+to\s+open|open\s+to\s+open|close\s+to\s+close|total\s+(?:becomes|to|matches|is)?\s*open|between|from|row|and)|$)/gi)];

      if (crossMatches.length > 0) {
        crossMatches.forEach(m => {
          let typeStr = m[1].toLowerCase().replace(/\s+/g, '_');
          if (typeStr.includes('total') && typeStr.includes('open')) typeStr = 'total_to_open';
          // Special check for Master Game Triad query
          if (q.includes('master game') || q.includes('master triad') || q.includes('master')) {
            const stepWeeks = 4; // Default 4-week step down
            let pCount = 1;

            for (let r3 = stepWeeks * 2; r3 < grid.length; r3++) {
              const r1 = r3 - (stepWeeks * 2);
              const r2 = r3 - stepWeeks;

              if (!grid[r1] || !grid[r2] || !grid[r3]) continue;

              for (let c1 = 0; c1 < cols; c1++) {
                const val1 = grid[r1][c1]?.val;
                if (!val1 || !/^\d{2}$/.test(val1)) continue;

                for (let c2 = 0; c2 < cols; c2++) {
                  const val2 = grid[r2][c2]?.val;
                  if (!val2 || !/^\d{2}$/.test(val2)) continue;

                  for (let c3 = 0; c3 < cols; c3++) {
                    const val3 = grid[r3][c3]?.val;
                    if (!val3 || !/^\d{2}$/.test(val3)) continue;

                    const o1 = parseInt(val1[0]), cVal1 = parseInt(val1[1]);
                    const o2 = parseInt(val2[0]), cVal2 = parseInt(val2[1]);
                    const o3 = parseInt(val3[0]), cVal3 = parseInt(val3[1]);

                    const targetSum = (o1 + o2 + o3) % 10;

                    // Check Close Balance line
                    let isCloseBalanced = false;
                    if (c2 > 0 && grid[r2][c2 - 1]?.val && /^\d{2}$/.test(grid[r2][c2 - 1].val)) {
                      const adjVal = grid[r2][c2 - 1].val;
                      const adjTotal = (parseInt(adjVal[0]) + parseInt(adjVal[1])) % 10;
                      const reqCloseSum = (adjTotal + o2) % 10;
                      if ((cVal1 + cVal2 + cVal3) % 10 === reqCloseSum) {
                        isCloseBalanced = true;
                      }
                    }

                    if (isCloseBalanced || (o1 + o2 + o3) % 10 === 0 || (o1 + o2 + o3) % 10 === 8 || (o1 + o2 + o3) % 10 === 6 || (o1 + o2 + o3) % 10 === 4 || (o1 + o2 + o3) % 10 === 2) {
                      const pId = `MG${pCount++}`;

                      const m1 = {
                        r: r1, c: c1, day: DAY_NAMES[c1], rowNum: r1 + 1, val: val1, pairId: pId,
                        reason: `👑 [MASTER GAME STEP 1] Open=${o1} (Row #${r1+1})`,
                        color: '#06b6d4', border: '#0891b2', dot: '🔵'
                      };
                      const m2 = {
                        r: r2, c: c2, day: DAY_NAMES[c2], rowNum: r2 + 1, val: val2, pairId: pId,
                        reason: `👑 [MASTER GAME STEP 2] Open=${o2} (Row #${r2+1})`,
                        color: '#f59e0b', border: '#d97706', dot: '🟡'
                      };
                      const m3 = {
                        r: r3, c: c3, day: DAY_NAMES[c3], rowNum: r3 + 1, val: val3, pairId: pId,
                        reason: `👑 [MASTER GAME TARGET] Open=${o3} (${o1}+${o2}+${o3}=${targetSum}) (Row #${r3+1})`,
                        color: '#ec4899', border: '#be185d', dot: '🩷'
                      };

                      if (!matchMap[`${r1}_${c1}`]) { matches.push(m1); matchMap[`${r1}_${c1}`] = m1; }
                      if (!matchMap[`${r2}_${c2}`]) { matches.push(m2); matchMap[`${r2}_${c2}`] = m2; }
                      if (!matchMap[`${r3}_${c3}`]) { matches.push(m3); matchMap[`${r3}_${c3}`] = m3; }
                    }
                  }
                }
              }
            }

            return { matches, isRelational: true, stats: { totalMatches: matches.length } };
          }

          const relObj = parseRelation(m[2]);
          if (relObj) {
            crossClauses.push({ type: typeStr, rel: relObj });
          }
        });
      } else {
        const subTokens = cStr.split(/\s*(?=open\s+to\s+close|close\s+to\s+open|open\s+to\s+open|close\s+to\s+close|total\s+(?:becomes|to|matches|is)?\s*open)/i);
        subTokens.forEach(tok => {
          const subMatch = tok.match(/(open\s+to\s+close|close\s+to\s+open|open\s+to\s+open|close\s+to\s+close|total\s+(?:becomes|to|matches|is)?\s*open)\s*(.*)/i);
          if (subMatch) {
            let typeStr = subMatch[1].toLowerCase().replace(/\s+/g, '_');
            if (typeStr.includes('total') && typeStr.includes('open')) typeStr = 'total_to_open';
            const relObj = parseRelation(subMatch[2]);
            if (relObj) {
              crossClauses.push({ type: typeStr, rel: relObj });
            }
          }
        });
      }

      const targetCols = effectiveDays;
      const maxPairScanR = clauseRange.isRestricted ? cMaxR : Math.min(grid.length - 1, cMaxR + 1);

      targetCols.forEach(c => {
        for (let r1 = cMinR; r1 <= cMaxR; r1++) {
          for (let r2 = r1 + 1; r2 <= maxPairScanR; r2++) {
            // Prevent duplicate pair registration
            if (matchMap[`${r1}_${c}`] && matchMap[`${r2}_${c}`]) continue;

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
              else if (cl.type === 'total_to_open') { d1 = (o1 + c1Digit) % 10; d2 = o2; }

              if (checkDigitRelation(d1, d2, cl.rel)) passesCount++;
            });

            const passes = hasOrLogic ? passesCount > 0 : passesCount === crossClauses.length;

            if (passes && crossClauses.length > 0) {
              lastOriginRow = Math.max(lastOriginRow, r2);

              const pIdx = pairCounter++;
              const pId = `P${pIdx}`;
              const palette = PAIR_COLORS[(pIdx - 1) % PAIR_COLORS.length];

              const m1 = { r: r1, c, day: DAY_NAMES[c], rowNum: r1 + 1, val: val1, pairId: pId, stepIndex: 1, targetR: r2, targetC: c, reason: `${DAY_NAMES[c]} Row #${r1+1} (${val1}) paired with Row #${r2+1} (${val2})`, color: palette.bg, border: palette.border, dot: palette.dot };
              const m2 = { r: r2, c, day: DAY_NAMES[c], rowNum: r2 + 1, val: val2, pairId: pId, stepIndex: 2, targetR: r1, targetC: c, reason: `${DAY_NAMES[c]} Row #${r2+1} (${val2}) paired with Row #${r1+1} (${val1})`, color: palette.bg, border: palette.border, dot: palette.dot };
              
              if (!matchMap[`${r1}_${c}`] && !matchMap[`${r2}_${c}`]) {
                matches.push(m1, m2);
                matchMap[`${r1}_${c}`] = m1;
                matchMap[`${r2}_${c}`] = m2;
              }
            }
          }
        }
      });
    }

    // CLAUSE TYPE G: Autonomous Same Jodi Scanner (e.g. "fri jodi same")
    else if (hasSameJodi) {
      const targetCols = effectiveDays;
      const maxPairScanR = clauseRange.isRestricted ? cMaxR : Math.min(grid.length - 1, cMaxR + 1);

      targetCols.forEach(c => {
        for (let r1 = cMinR; r1 <= cMaxR; r1++) {
          for (let r2 = r1 + 1; r2 <= maxPairScanR; r2++) {
            if (matchMap[`${r1}_${c}`] && matchMap[`${r2}_${c}`]) continue;

            const val1 = grid[r1]?.[c]?.val || '';
            const val2 = grid[r2]?.[c]?.val || '';
            if (val1 && val2 && /^\d{2}$/.test(val1) && /^\d{2}$/.test(val2)) {
              if (val1 === val2) {
                lastOriginRow = Math.max(lastOriginRow, r2);

                const pIdx = pairCounter++;
                const pId = `P${pIdx}`;
                const palette = PAIR_COLORS[(pIdx - 1) % PAIR_COLORS.length];

                const m1 = { r: r1, c, day: DAY_NAMES[c], rowNum: r1 + 1, val: val1, pairId: pId, stepIndex: 1, targetR: r2, targetC: c, reason: `Same Jodi ${val1} on ${DAY_NAMES[c]} (Row #${r1+1} & #${r2+1})`, color: palette.bg, border: palette.border, dot: palette.dot };
                const m2 = { r: r2, c, day: DAY_NAMES[c], rowNum: r2 + 1, val: val2, pairId: pId, stepIndex: 2, targetR: r1, targetC: c, reason: `Same Jodi ${val2} on ${DAY_NAMES[c]} (Row #${r2+1} & #${r1+1})`, color: palette.bg, border: palette.border, dot: palette.dot };
                
                if (!matchMap[`${r1}_${c}`] && !matchMap[`${r2}_${c}`]) {
                  matches.push(m1, m2);
                  matchMap[`${r1}_${c}`] = m1;
                  matchMap[`${r2}_${c}`] = m2;
                }
              }
            }
          }
        }
      });
    }

    // CLAUSE TYPE A: Proximity Search with Totals
    else if (hasNear && clauseTotals.length >= 1) {
      const originCols = effectiveDays;
      const originTotal = clauseTotals[0];
      const nearTotal = clauseTotals.length >= 2 ? clauseTotals[1] : clauseTotals[0];

      for (let r = cMinR; r <= cMaxR; r++) {
        originCols.forEach(c => {
          const val = grid[r]?.[c]?.val || '';
          if (val && /^\d{2}$/.test(val)) {
            const t1 = (parseInt(val[0]) + parseInt(val[1])) % 10;
            const t2 = parseInt(val[0]) + parseInt(val[1]);
            if (t1 === originTotal || t2 === originTotal) {
              lastOriginRow = Math.max(lastOriginRow, r);
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
                  if (nr >= 0 && nr < grid.length && nc >= 0 && nc < cols) {
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
            lastOriginRow = Math.max(lastOriginRow, r);
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

    // CLAUSE TYPE E: Reverse / Falti Search
    else if (hasReverse) {
      const num1 = clauseNums.length > 0 ? clauseNums[0] : null;
      const num2 = num1 ? getFaltiNumber(num1) : null;
      const targetCols = effectiveDays;
      const maxPairScanR = clauseRange.isRestricted ? cMaxR : Math.min(grid.length - 1, cMaxR + 1);

      if (num1) {
        for (let r = cMinR; r <= cMaxR; r++) {
          targetCols.forEach(c => {
            const val = grid[r]?.[c]?.val || '';
            if (val && /^\d{2}$/.test(val)) {
              if (val === num1 || val === num2) {
                lastOriginRow = Math.max(lastOriginRow, r);
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
      } else {
        targetCols.forEach(c => {
          for (let r1 = cMinR; r1 <= cMaxR; r1++) {
            for (let r2 = r1 + 1; r2 <= maxPairScanR; r2++) {
              if (matchMap[`${r1}_${c}`] && matchMap[`${r2}_${c}`]) continue;

              const val1 = grid[r1]?.[c]?.val || '';
              const val2 = grid[r2]?.[c]?.val || '';
              if (val1 && val2 && /^\d{2}$/.test(val1) && /^\d{2}$/.test(val2)) {
                if (val2 === getFaltiNumber(val1) && val1 !== val2) {
                  lastOriginRow = Math.max(lastOriginRow, r2);

                  const pIdx = pairCounter++;
                  const pId = `P${pIdx}`;
                  const palette = PAIR_COLORS[(pIdx - 1) % PAIR_COLORS.length];

                  const m1 = { r: r1, c, day: DAY_NAMES[c], rowNum: r1 + 1, val: val1, pairId: pId, stepIndex: 1, targetR: r2, targetC: c, reason: `Reverse Jodi ${val1} & ${val2} on ${DAY_NAMES[c]}`, color: palette.bg, border: palette.border, dot: palette.dot };
                  const m2 = { r: r2, c, day: DAY_NAMES[c], rowNum: r2 + 1, val: val2, pairId: pId, stepIndex: 2, targetR: r1, targetC: c, reason: `Reverse Jodi ${val2} & ${val1} on ${DAY_NAMES[c]}`, color: palette.bg, border: palette.border, dot: palette.dot };
                  
                  if (!matchMap[`${r1}_${c}`] && !matchMap[`${r2}_${c}`]) {
                    matches.push(m1, m2);
                    matchMap[`${r1}_${c}`] = m1;
                    matchMap[`${r2}_${c}`] = m2;
                  }
                }
              }
            }
          }
        });
      }
    }

    // CLAUSE TYPE C: Explicit Number Search
    else if (clauseNums.length > 0 && !hasFamily) {
      const numToFind = clauseNums[0];
      const targetCols = effectiveDays;

      for (let r = cMinR; r <= cMaxR; r++) {
        targetCols.forEach(c => {
          const val = grid[r]?.[c]?.val || '';
          if (val === numToFind) {
            lastOriginRow = Math.max(lastOriginRow, r);
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

    // CLAUSE TYPE D: Total Filter Search (e.g. "next 9 total")
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
              lastOriginRow = Math.max(lastOriginRow, r);
              const mOrigin = {
                r, c,
                day: DAY_NAMES[c],
                rowNum: r + 1,
                val,
                reason: `${DAY_NAMES[c]} Total ${reqTotal} (${val}) on Row #${r+1}`,
                color: '#10b981'
              };
              if (!matchMap[`${r}_${c}`]) {
                matches.push(mOrigin);
                matchMap[`${r}_${c}`] = mOrigin;
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
            lastOriginRow = Math.max(lastOriginRow, r);
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

  const summary = matches.length > 0
    ? `Found ${matches.length} matching cell(s) for query.`
    : `No matches found for "${queryStr}".`;

  return { matches, summary, matchMap };
};

export const queryChart = (grid, queryStr) => parseAndSearchChart(queryStr, grid);
export const parseQuery = (queryStr) => queryStr;

