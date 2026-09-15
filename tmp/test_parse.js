const WORD_TO_NUM = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

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

const cStr = 'open to open same and close to close one down between 1 to 4 row';
const subTokens = cStr.split(/\s*(?=open\s+to\s+close|close\s+to\s+open|open\s+to\s+open|close\s+to\s+close)/i);

console.log('SubTokens:', subTokens);

const crossClauses = [];
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

console.log('CrossClauses:', JSON.stringify(crossClauses, null, 2));

// Test against grid values
const checkDigitRelation = (d1, d2, rel) => {
  if (!rel) return false;
  if (rel.type === 'SAME') return d1 === d2;
  if (rel.type === 'OPPOSITE') return d2 === (d1 + 5) % 10;
  if (rel.type === 'UP') return d2 === (d1 + rel.step + 10) % 10;
  if (rel.type === 'DOWN') return d2 === (d1 - rel.step + 10) % 10;
  return false;
};

const testPairs = [
  { name: 'Monday 53 vs 52', val1: '53', val2: '52' },
  { name: 'Tuesday 84 vs 88', val1: '84', val2: '88' },
  { name: 'Wednesday 07 vs 00', val1: '07', val2: '00' },
  { name: 'Saturday 86 vs 89', val1: '86', val2: '89' },
  { name: 'Thursday 12 vs 51', val1: '12', val2: '51' }
];

testPairs.forEach(p => {
  const o1 = parseInt(p.val1[0]), c1 = parseInt(p.val1[1]);
  const o2 = parseInt(p.val2[0]), c2 = parseInt(p.val2[1]);

  let passesCount = 0;
  crossClauses.forEach(cl => {
    let d1, d2;
    if (cl.type === 'open_to_close') { d1 = o1; d2 = c2; }
    else if (cl.type === 'close_to_open') { d1 = c1; d2 = o2; }
    else if (cl.type === 'open_to_open') { d1 = o1; d2 = o2; }
    else if (cl.type === 'close_to_close') { d1 = c1; d2 = c2; }

    if (checkDigitRelation(d1, d2, cl.rel)) passesCount++;
  });

  const passes = passesCount === crossClauses.length;
  console.log(`${p.name}: passesCount=${passesCount}/${crossClauses.length} -> MATCH=${passes}`);
});
