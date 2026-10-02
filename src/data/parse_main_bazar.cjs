const fs = require('fs');
const path = require('path');

const rawPath = path.join(__dirname, 'main_bazar_raw.txt');
const rawText = fs.readFileSync(rawPath, 'utf8');
const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

const gridData = lines.map((line, rIdx) => {
  const tokens = line.split(/\s+/);
  const row = [];
  const isLastRow = (rIdx === lines.length - 1);

  for (let cIdx = 0; cIdx < 5; cIdx++) {
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
  name: "MAIN BAZAR",
  rows: gridData.length,
  cols: 5,
  updatedAt: new Date().toISOString(),
  data: gridData
};

const outputPath = path.join(__dirname, 'main_bazar_preset.json');
fs.writeFileSync(outputPath, JSON.stringify(preset, null, 2));
console.log(`Successfully generated MAIN BAZAR preset with ${gridData.length} rows and 5 columns!`);
