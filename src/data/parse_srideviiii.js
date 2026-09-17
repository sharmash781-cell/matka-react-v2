import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rawPath = path.join(__dirname, 'srideviiii_raw.txt');
const raw = fs.readFileSync(rawPath, 'utf8');
const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

const data = lines.map((line, rIdx) => {
  const tokens = line.split(/\s+/);
  const row = [];
  for (let cIdx = 0; cIdx < 7; cIdx++) {
    let val = tokens[cIdx] || '';
    if (val === '**' || val === '*') val = '';
    row.push({
      r: rIdx,
      c: cIdx,
      val: val
    });
  }
  return row;
});

const preset = {
  name: "SRIDEVIIII",
  rows: data.length,
  cols: 7,
  updatedAt: new Date().toISOString(),
  data: data
};

const outputPath = path.join(__dirname, 'srideviiii_preset.json');
fs.writeFileSync(outputPath, JSON.stringify(preset, null, 2));
console.log(`Successfully created SRIDEVIIII preset with ${data.length} rows and 7 columns (Mon to Sun).`);
