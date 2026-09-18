import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function parseChart(rawFilename, cols, chartName) {
  const rawPath = path.join(__dirname, rawFilename);
  const raw = fs.readFileSync(rawPath, 'utf8');
  let lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // Trim trailing rows that are purely placeholders (e.g. ** ** **) at the very end of the file
  while (lines.length > 0) {
    const tokens = lines[lines.length - 1].split(/\s+/);
    const isAllPlaceholder = tokens.every(t => t === '**' || t === '*' || t === 'XX' || t === '');
    if (isAllPlaceholder) {
      lines.pop();
    } else {
      break;
    }
  }

  const data = lines.map((line, rIdx) => {
    const tokens = line.split(/\s+/);
    const row = [];
    for (let cIdx = 0; cIdx < cols; cIdx++) {
      // Keep exact token (e.g. '08', '**', '*', '62'), or empty string if beyond line tokens
      const val = tokens[cIdx] || '';
      row.push({ r: rIdx, c: cIdx, val });
    }
    return row;
  });

  return {
    name: chartName,
    rows: data.length,
    cols: cols,
    updatedAt: new Date().toISOString(),
    data: data
  };
}

// 1. MAIN BAZAR (5 Cols)
const mainBazarPreset = parseChart('main_bazar_raw.txt', 5, 'MAIN BAZAR');
fs.writeFileSync(path.join(__dirname, 'main_bazar_preset.json'), JSON.stringify(mainBazarPreset, null, 2));
console.log(`MAIN BAZAR: ${mainBazarPreset.rows} rows, 5 cols.`);

// 2. SRIDEVIIII (7 Cols)
const srideviiiiPreset = parseChart('srideviiii_raw.txt', 7, 'SRIDEVIIII');
fs.writeFileSync(path.join(__dirname, 'srideviiii_preset.json'), JSON.stringify(srideviiiiPreset, null, 2));
console.log(`SRIDEVIIII: ${srideviiiiPreset.rows} rows, 7 cols.`);

// 3. MILAN DAYY (7 Cols)
const milanDayyPreset = parseChart('milan_dayy_raw.txt', 7, 'MILAN DAYY');
fs.writeFileSync(path.join(__dirname, 'milan_dayy_preset.json'), JSON.stringify(milanDayyPreset, null, 2));
console.log(`MILAN DAYY: ${milanDayyPreset.rows} rows, 7 cols.`);

// 4. MILAN NIGHTT (6 Cols)
const milanNighttPreset = parseChart('milan_nightt_raw.txt', 6, 'MILAN NIGHTT');
fs.writeFileSync(path.join(__dirname, 'milan_nightt_preset.json'), JSON.stringify(milanNighttPreset, null, 2));
console.log(`MILAN NIGHTT: ${milanNighttPreset.rows} rows, 6 cols.`);

// 5. KALYAN (6 Cols)
const kalyanPreset = parseChart('kalyan_raw.txt', 6, 'KALYAN');
fs.writeFileSync(path.join(__dirname, 'kalyan_preset.json'), JSON.stringify(kalyanPreset, null, 2));
console.log(`KALYAN: ${kalyanPreset.rows} rows, 6 cols.`);
