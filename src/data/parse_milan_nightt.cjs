const fs = require('fs');
const path = require('path');

const rawPath = path.join(__dirname, 'milan_nightt_raw.txt');
const rawText = fs.readFileSync(rawPath, 'utf8');
const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

const gridData = lines.map((line, rIdx) => {
  const tokens = line.split(/\s+/);
  const row = [];
  const isLastRow = (rIdx === lines.length - 1);

  for (let cIdx = 0; cIdx < 6; cIdx++) {
    let val = tokens[cIdx];
    if (!val) {
      val = isLastRow ? '' : '**';
    } else if (val === '*' || val === '**') {
      val = isLastRow ? '' : '**';
    }
    row.push({ r: rIdx, c: cIdx, val });
  }
  return row;
});

const preset = {
  name: "MILAN NIGHTT",
  rows: gridData.length,
  cols: 6,
  updatedAt: new Date().toISOString(),
  data: gridData
};

const outputPath = path.join(__dirname, 'milan_nightt_preset.json');
fs.writeFileSync(outputPath, JSON.stringify(preset, null, 2));
console.log(`Successfully generated MILAN NIGHTT preset with ${gridData.length} rows and 6 columns!`);
