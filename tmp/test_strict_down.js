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

const testThu = [
  { name: '51 (close 1) to 59 (close 9)', c1: 1, c2: 9 },
  { name: '51 (close 1) to 57 (close 7)', c1: 1, c2: 7 },
  { name: '59 (close 9) to 57 (close 7)', c1: 9, c2: 7 }
];

testThu.forEach(t => {
  const passes = checkDigitRelation(t.c1, t.c2, { type: 'DOWN', step: 2 });
  console.log(`${t.name} (2 down) => ${passes ? 'MATCH' : 'REJECTED'}`);
});
