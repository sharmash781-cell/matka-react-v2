export const DPBOSS_URL_MAP = {
  "TIME BAZAR": "https://dpboss.tax/jodi-chart-record/time-bazar.php",
  "KALYAN": "https://dpboss.tax/jodi-chart-record/kalyan.php",
  "SRIDEVI NIGHT": "https://dpboss.tax/jodi-chart-record/sridevi-night.php",
  "SRIDEVI": "https://dpboss.tax/jodi-chart-record/sridevi.php",
  "MAIN BAZAR": "https://dpboss.tax/jodi-chart-record/main-bazar.php",
  "MILAN DAY": "https://dpboss.tax/jodi-chart-record/milan-day.php",
  "MILAN DAYY": "https://dpboss.tax/jodi-chart-record/milan-day.php",
  "MILAN NIGHT": "https://dpboss.tax/jodi-chart-record/milan-night.php",
  "MILAN NIGHTT": "https://dpboss.tax/jodi-chart-record/milan-night.php"
};

export const GITHUB_RAW_MAP = {
  "KALYAN": "https://raw.githubusercontent.com/sharmash781-cell/matka-react-v2/main/src/data/kalyan_preset.json",
  "MAIN BAZAR": "https://raw.githubusercontent.com/sharmash781-cell/matka-react-v2/main/src/data/main_bazar_preset.json",
  "TIME BAZAR": "https://raw.githubusercontent.com/sharmash781-cell/matka-react-v2/main/src/data/time_bazar_preset.json",
  "SRIDEVI NIGHT": "https://raw.githubusercontent.com/sharmash781-cell/matka-react-v2/main/src/data/sridevi_night_preset.json",
  "SRIDEVI": "https://raw.githubusercontent.com/sharmash781-cell/matka-react-v2/main/src/data/sridevi_preset.json",
  "MILAN DAY": "https://raw.githubusercontent.com/sharmash781-cell/matka-react-v2/main/src/data/milan_dayy_preset.json",
  "MILAN DAYY": "https://raw.githubusercontent.com/sharmash781-cell/matka-react-v2/main/src/data/milan_dayy_preset.json",
  "MILAN NIGHT": "https://raw.githubusercontent.com/sharmash781-cell/matka-react-v2/main/src/data/milan_nightt_preset.json",
  "MILAN NIGHTT": "https://raw.githubusercontent.com/sharmash781-cell/matka-react-v2/main/src/data/milan_nightt_preset.json"
};

export const parseDpbossHtml = (htmlText, cleanName) => {
  if (!htmlText || !htmlText.includes('<tr')) return null;
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

  if (parsedGridValues.length === 0) return null;

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

export const fetchLiveChartData = async (chartName) => {
  const cleanName = chartName ? chartName.trim().toUpperCase() : 'MAIN BAZAR';
  const targetUrl = DPBOSS_URL_MAP[cleanName] || DPBOSS_URL_MAP['MAIN BAZAR'];
  const rawUrl = GITHUB_RAW_MAP[cleanName] || GITHUB_RAW_MAP['MAIN BAZAR'];

  // Helper fetcher for AllOrigins JSON endpoint
  const fetchAllOrigins = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (data && data.contents) return data.contents;
    }
    throw new Error('AllOrigins failed');
  };

  // Helper fetcher for CodeTabs endpoint
  const fetchCodeTabs = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(targetUrl)}`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const text = await res.text();
      if (text) return text;
    }
    throw new Error('CodeTabs failed');
  };

  // Helper fetcher for CorsProxy endpoint
  const fetchCorsProxy = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(targetUrl)}`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const text = await res.text();
      if (text) return text;
    }
    throw new Error('CorsProxy failed');
  };

  // Try DPBoss proxies in parallel race for fastest response!
  try {
    const htmlText = await Promise.any([
      fetchAllOrigins(),
      fetchCodeTabs(),
      fetchCorsProxy()
    ]);
    const parsed = parseDpbossHtml(htmlText, cleanName);
    if (parsed) return parsed;
  } catch (e) {
    // Proxies timed out or blocked
  }

  // GitHub Live Raw Feed (Instant 100ms response, 100% reliable)
  try {
    const res = await fetch(`${rawUrl}?t=${Date.now()}`);
    if (res.ok) {
      const json = await res.json();
      if (json && json.data) {
        return {
          ...json,
          name: cleanName,
          updatedAt: new Date().toISOString(),
          isLive: true
        };
      }
    }
  } catch (e) {}

  return null;
};
