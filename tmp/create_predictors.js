import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcPath = path.join(__dirname, '../src/components/PredictorEngine.jsx');
let code = fs.readFileSync(srcPath, 'utf8');

// Remove routing block from base code
code = code.replace(/  \/\/ Route strictly to dedicated SrideviPredictor ONLY for SRIDEVI chart[\s\S]*?  if \(isSrideviChart\) \{\s*return <SrideviPredictor \/>;\s*\}/, '');
code = code.replace("import { SrideviPredictor } from './SrideviPredictor';", '');

const predictors = [
  { name: 'TimeBazarPredictor', title: 'TIME BAZAR' },
  { name: 'MilanDayPredictor', title: 'MILAN DAY' },
  { name: 'MilanNightPredictor', title: 'MILAN NIGHT' },
  { name: 'KalyanPredictor', title: 'KALYAN' },
  { name: 'MainBazarPredictor', title: 'MAIN BAZAR' }
];

predictors.forEach(p => {
  let fileCode = code.replace(/export const PredictorEngine = \(\) => \{/g, `export const ${p.name} = () => {`);
  fileCode = fileCode.replace(/⚡ MASTER PREDICTION ENGINE/g, `⚡ DEDICATED ${p.title} PREDICTION ENGINE`);
  
  const destPath = path.join(__dirname, `../src/components/${p.name}.jsx`);
  fs.writeFileSync(destPath, fileCode, 'utf8');
  console.log(`Created ${p.name}.jsx successfully!`);
});
