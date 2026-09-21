const https = require('https');
const fs = require('fs');
const path = require('path');

const url = 'https://dpboss.tax/panel-chart-record/sridevi.php';

console.log('Fetching full Sridevi Panel chart from DPBoss:', url);

https.get(url, (res) => {
  let html = '';
  res.on('data', chunk => html += chunk);
  res.on('end', () => {
    console.log('HTML length:', html.length);

    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;

    let match;
    const parsedRows = [];

    while ((match = trRegex.exec(html)) !== null) {
      const trContent = match[1];
      const tds = [];
      let tdMatch;
      while ((tdMatch = tdRegex.exec(trContent)) !== null) {
        let text = tdMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        tds.push(text);
      }
      if (tds.length >= 7) {
        parsedRows.push(tds);
      }
    }

    console.log('Total parsed table rows from DPBoss:', parsedRows.length);

    const grid = [];
    let rIdx = 0;

    parsedRows.forEach(row => {
      // Skip header rows if any
      const rowText = row.join(' ').toUpperCase();
      if (rowText.includes('MON') || rowText.includes('DATE') || rowText.includes('SRIDEVI MATKA')) return;

      let dayCells = row;
      if (row.length >= 8) {
        dayCells = row.slice(1, 8);
      } else if (row.length === 7) {
        dayCells = row.slice(0, 7);
      }

      const rowData = [];
      for (let cIdx = 0; cIdx < 7; cIdx++) {
        const rawCell = (dayCells[cIdx] || '').trim();
        
        // Split by whitespace/newlines or sanitize
        const parts = rawCell.split(/\s+/).filter(Boolean);
        let val = rawCell;
        let openPana = '';
        let jodi = '';
        let closePana = '';

        if (parts.length === 3) {
          openPana = parts[0];
          jodi = parts[1];
          closePana = parts[2];
          val = `${openPana}-${jodi}-${closePana}`;
        } else if (parts.length === 1 && parts[0].includes('-')) {
          val = parts[0];
          const sub = val.split('-');
          if (sub.length === 3) {
            openPana = sub[0];
            jodi = sub[1];
            closePana = sub[2];
          }
        } else if (rawCell === '**' || rawCell === '*' || rawCell.toUpperCase() === 'XX') {
          val = '**';
        }

        rowData.push({
          r: rIdx,
          c: cIdx,
          val: val,
          openPana: openPana,
          jodi: jodi,
          closePana: closePana
        });
      }

      // Check if row has valid content
      if (rowData.some(cell => cell.val && cell.val !== '')) {
        grid.push(rowData);
        rIdx++;
      }
    });

    console.log(`Parsed ${grid.length} FULL historical week rows for Sridevi Panel Chart!`);

    const preset = {
      name: 'SRIDEVI PANEL',
      chartType: 'pana',
      rows: grid.length,
      cols: 7,
      updatedAt: new Date().toISOString(),
      data: grid
    };

    const targetFile = path.join(__dirname, 'sridevi_panel_preset.json');
    fs.writeFileSync(targetFile, JSON.stringify(preset, null, 2));
    console.log('Successfully saved FULL DPBoss Sridevi Panel preset to:', targetFile);
  });
}).on('error', (err) => {
  console.error('Error fetching DPBoss:', err.message);
});
