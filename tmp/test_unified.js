import { parseAndSearchChart } from './src/ai/queryEngine.js';

const mockGrid = [
  [{val: '53'}, {val: '84'}, {val: '07'}, {val: '12'}, {val: '69'}, {val: '24'}, {val: '77'}], // Row 1
  [{val: '65'}, {val: '18'}, {val: '90'}, {val: '33'}, {val: '51'}, {val: '08'}, {val: '59'}], // Row 2
  [{val: '52'}, {val: '88'}, {val: '00'}, {val: '64'}, {val: '03'}, {val: '86'}, {val: '30'}], // Row 3
  [{val: '39'}, {val: '36'}, {val: '45'}, {val: '51'}, {val: '31'}, {val: '89'}, {val: '05'}], // Row 4
  [{val: '22'}, {val: '88'}, {val: '01'}, {val: '59'}, {val: '55'}, {val: '59'}, {val: '59'}], // Row 5
  [{val: '56'}, {val: '91'}, {val: '86'}, {val: '75'}, {val: '81'}, {val: '57'}, {val: '08'}], // Row 6
  [{val: '88'}, {val: '92'}, {val: '66'}, {val: '57'}, {val: '99'}, {val: '71'}, {val: '20'}], // Row 7
  [{val: '15'}, {val: '28'}, {val: '30'}, {val: '44'}, {val: '55'}, {val: '66'}, {val: '77'}]  // Row 8
];

const q = 'open to close opposite tue from 3 to 8 row and close to open 4 down';
const res = parseAndSearchChart(q, mockGrid, 7);

console.log('--- UNIFIED TEST RESULT ---');
console.log('Query:', q);
console.log('Summary:', res.summary);
console.log('Matches Count:', res.matches.length);
res.matches.forEach((m, idx) => {
  console.log(`Match #${idx + 1}: ${m.day} Row #${m.rowNum} (${m.val}) - ${m.reason}`);
});
