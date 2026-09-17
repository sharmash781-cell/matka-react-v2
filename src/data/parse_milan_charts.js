import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. MILAN DAYY (7 Cols)
const dayyRawPath = path.join(__dirname, 'milan_dayy_raw.txt');
const dayyRaw = fs.readFileSync(dayyRawPath, 'utf8');
const dayyLines = dayyRaw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

const dayyData = dayyLines.map((line, rIdx) => {
  const tokens = line.split(/\s+/);
  const row = [];
  for (let cIdx = 0; cIdx < 7; cIdx++) {
    let val = tokens[cIdx] || '';
    if (val === '**' || val === '*') val = '';
    row.push({ r: rIdx, c: cIdx, val });
  }
  return row;
});

const dayyPreset = {
  name: "MILAN DAYY",
  rows: dayyData.length,
  cols: 7,
  updatedAt: new Date().toISOString(),
  data: dayyData
};

fs.writeFileSync(path.join(__dirname, 'milan_dayy_preset.json'), JSON.stringify(dayyPreset, null, 2));
console.log(`Created MILAN DAYY preset with ${dayyData.length} rows and 7 columns.`);

// 2. MILAN NIGHTT (6 Cols)
const nighttRawPath = path.join(__dirname, 'milan_nightt_raw.txt');
const nighttRaw = fs.readFileSync(nighttRawPath, 'utf8');
const nighttLines = nighttRaw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

const nighttData = nighttLines.map((line, rIdx) => {
  const tokens = line.split(/\s+/);
  const row = [];
  for (let cIdx = 0; cIdx < 6; cIdx++) {
    let val = tokens[cIdx] || '';
    if (val === '**' || val === '*') val = '';
    row.push({ r: rIdx, c: cIdx, val });
  }
  return row;
});

const nighttPreset = {
  name: "MILAN NIGHTT",
  rows: nighttData.length,
  cols: 6,
  updatedAt: new Date().toISOString(),
  data: nighttData
};

fs.writeFileSync(path.join(__dirname, 'milan_nightt_preset.json'), JSON.stringify(nighttPreset, null, 2));
console.log(`Created MILAN NIGHTT preset with ${nighttData.length} rows and 6 columns.`);
