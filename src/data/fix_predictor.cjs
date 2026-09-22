const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'components', 'PredictorEngine.jsx');
let content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

console.log('Total lines:', lines.length);

// Find line 254 (index 253) which is after `});` and before `// --- PASS 1: Vertical Column Step & Harmonic Run ---`
// and find the second PASS 18 MULTI-PASS CONFLUENCE BOOST end

let newPassStart = -1;
let oldPassEnd = -1;

for (let i = 0; i < lines.length; i++) {
  // Find the FIRST occurrence of the old duplicate PASS 1
  if (newPassStart === -1 && lines[i].includes('// --- PASS 1: Vertical Column Step & Harmonic Run ---')) {
    newPassStart = i;
    console.log('First PASS 1 found at line:', i + 1);
  }
  
  // Find the second occurrence of PASS 18 MULTI-PASS CONFLUENCE BOOST end
  if (lines[i].includes('MULTI-PASS CONFLUENCE BOOST') && i > 600) {
    // find end of that forEach block
    for (let j = i; j < lines.length; j++) {
      if (lines[j].trim() === '});' && j > i) {
        oldPassEnd = j;
        console.log('Old confluence boost end at line:', j + 1);
        break;
      }
    }
    break;
  }
}

if (newPassStart !== -1 && oldPassEnd !== -1) {
  // Remove lines from newPassStart to oldPassEnd (inclusive)
  const before = lines.slice(0, newPassStart);
  const after = lines.slice(oldPassEnd + 1);
  const newContent = [...before, ...after].join('\n');
  fs.writeFileSync(filePath, newContent, 'utf8');
  console.log(`Removed ${oldPassEnd - newPassStart + 1} lines of duplicate code.`);
  console.log('New total lines:', before.length + after.length);
} else {
  console.log('Could not find boundaries. newPassStart:', newPassStart, 'oldPassEnd:', oldPassEnd);
}
