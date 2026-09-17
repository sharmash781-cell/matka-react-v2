import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rawPath = path.join(__dirname, 'main_bazar_raw.txt');
const raw = fs.readFileSync(rawPath, 'utf8');
const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

const data = lines.map((line, rIdx) => {
  const tokens = line.split(/\s+/);
  const row = [];
  for (let cIdx = 0; cIdx < 5; cIdx++) {
    row.push({
      r: rIdx,
      c: cIdx,
      val: tokens[cIdx] || '**'
    });
  }
  return row;
});

const preset = {
  name: "MAIN BAZAR",
  rows: data.length,
  cols: 5,
  updatedAt: new Date().toISOString(),
  data: data
};

const outputPath = path.join(__dirname, 'main_bazar_preset.json');
fs.writeFileSync(outputPath, JSON.stringify(preset, null, 2));
console.log(`Successfully created MAIN BAZAR preset with ${data.length} rows and 5 columns (Mon to Fri).`);
