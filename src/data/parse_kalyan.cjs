const fs = require('fs');
const path = require('path');

const rawPath = path.join(__dirname, 'kalyan_raw.txt');
const raw = fs.readFileSync(rawPath, 'utf8');
const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

const data = lines.map((line, rIdx) => {
  const tokens = line.split(/\s+/);
  const row = [];
  const isLastRow = (rIdx === lines.length - 1);

  for (let cIdx = 0; cIdx < 6; cIdx++) {
    let val = tokens[cIdx];
    if (!val) {
      val = isLastRow ? '' : '**';
    } else if (val === '*' || val === '**' || val === 'xx' || val === 'XX') {
      val = isLastRow ? '' : '**';
    }
    row.push({
      r: rIdx,
      c: cIdx,
      val: val
    });
  }
  return row;
});

const preset = {
  name: "KALYAN",
  rows: data.length,
  cols: 6,
  updatedAt: new Date().toISOString(),
  data: data
};

const outputPath = path.join(__dirname, 'kalyan_preset.json');
fs.writeFileSync(outputPath, JSON.stringify(preset, null, 2));
console.log(`Successfully created KALYAN preset with ${data.length} rows and 6 columns.`);
