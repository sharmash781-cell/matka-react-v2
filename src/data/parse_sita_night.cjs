const fs = require('fs');
const path = require('path');

const rawPath = path.join(__dirname, 'sita_night_raw.txt');
const rawText = fs.readFileSync(rawPath, 'utf8');
const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

const gridData = lines.map((line, rIdx) => {
  const tokens = line.split(/\s+/);
  const row = [];
  for (let cIdx = 0; cIdx < 7; cIdx++) {
    const val = tokens[cIdx] || '**';
    row.push({ r: rIdx, c: cIdx, val });
  }
  return row;
});

const preset = {
  name: "SITA NIGHT",
  rows: gridData.length,
  cols: 7,
  updatedAt: new Date().toISOString(),
  data: gridData
};

const outputPath = path.join(__dirname, 'sita_night_preset.json');
fs.writeFileSync(outputPath, JSON.stringify(preset, null, 2));
console.log(`Successfully generated SITA NIGHT preset with ${gridData.length} rows and 7 columns!`);
