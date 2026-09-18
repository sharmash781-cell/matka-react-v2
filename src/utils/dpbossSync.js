export const DPBOSS_URL_MAP = {
  "TIME BAZAR": "https://dpboss.tax/jodi-chart-record/time-bazar.php",
  "KALYAN": "https://dpboss.tax/jodi-chart-record/kalyan.php",
  "SRIDEVI NIGHT": "https://dpboss.tax/jodi-chart-record/sridevi-night.php",
  "SRIDEVI": "https://dpboss.tax/jodi-chart-record/sridevi.php",
  "SRIDEVIIII": "https://dpboss.tax/jodi-chart-record/sridevi.php",
  "MAIN BAZAR": "https://dpboss.tax/jodi-chart-record/main-bazar.php",
  "MILAN DAY": "https://dpboss.tax/jodi-chart-record/milan-day.php",
  "MILAN DAYY": "https://dpboss.tax/jodi-chart-record/milan-day.php",
  "MILAN NIGHT": "https://dpboss.tax/jodi-chart-record/milan-night.php",
  "MILAN NIGHTT": "https://dpboss.tax/jodi-chart-record/milan-night.php"
};

export const fetchLiveChartData = async (chartName) => {
  const cleanName = chartName ? chartName.trim().toUpperCase() : 'MAIN BAZAR';
  const targetUrl = DPBOSS_URL_MAP[cleanName] || DPBOSS_URL_MAP['MAIN BAZAR'];

  let htmlText = null;

  // 1. Try AllOrigins JSON API wrapper (most reliable in browser)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (data && data.contents && data.contents.includes('<tr')) {
        htmlText = data.contents;
      }
    }
  } catch (e) {}

  // 2. Try CodeTabs CORS proxy wrapper
  if (!htmlText) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const text = await res.text();
        if (text && text.includes('<tr')) {
          htmlText = text;
        }
      }
    } catch (e) {}
  }

  // 3. Try Direct fetch / CorsProxy.io
  if (!htmlText) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(targetUrl)}`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const text = await res.text();
        if (text && text.includes('<tr')) {
          htmlText = text;
        }
      }
    } catch (e) {}
  }

  if (!htmlText) {
    return null; // Return null so caller can seamlessly fallback to preset restoration!
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, 'text/html');
  const trs = Array.from(doc.querySelectorAll('tr'));
  
  const parsedGridValues = [];
  trs.forEach((tr) => {
    const tds = Array.from(tr.querySelectorAll('td'));
    if (tds.length === 0) return;
    const rowVals = tds
      .map(td => td.textContent.replace(/\s+/g, ' ').trim())
      .filter(v => v !== '');
      
    if (rowVals.length > 0 && rowVals.some(v => /^\d{2}$|^\*\*$/.test(v))) {
      parsedGridValues.push(rowVals);
    }
  });

  if (parsedGridValues.length === 0) {
    return null;
  }

  const cols = Math.max(...parsedGridValues.map(r => r.length));
  
  const data = parsedGridValues.map((rowVals, rIdx) => {
    const row = [];
    for (let cIdx = 0; cIdx < cols; cIdx++) {
      const val = rowVals[cIdx] || '';
      row.push({ r: rIdx, c: cIdx, val });
    }
    return row;
  });

  return {
    name: cleanName,
    rows: data.length,
    cols: cols,
    updatedAt: new Date().toISOString(),
    data: data,
    isLive: true
  };
};
