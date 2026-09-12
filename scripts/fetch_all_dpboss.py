import urllib.request
import re
import json

dpboss_charts = {
    "TIME BAZAR": "https://dpboss.tax/jodi-chart-record/time-bazar.php",
    "SRIDEVI": "https://dpboss.tax/jodi-chart-record/sridevi.php",
    "KALYAN MORNING": "https://dpboss.tax/jodi-chart-record/kalyan-morning.php",
    "KALYAN": "https://dpboss.tax/jodi-chart-record/kalyan.php",
    "SRIDEVI NIGHT": "https://dpboss.tax/jodi-chart-record/sridevi-night.php",
    "KALYAN NIGHT": "https://dpboss.tax/jodi-chart-record/kalyan-night.php",
    "MAIN BAZAR": "https://dpboss.tax/jodi-chart-record/main-bazar.php",
    "MILAN MORNING": "https://dpboss.tax/jodi-chart-record/milan-morning.php",
    "MILAN DAY": "https://dpboss.tax/jodi-chart-record/milan-day.php",
    "MILAN NIGHT": "https://dpboss.tax/jodi-chart-record/milan-night.php",
    "RAJDHANI NIGHT": "https://dpboss.tax/jodi-chart-record/rajdhani-night.php",
    "MADHURI": "https://dpboss.tax/jodi-chart-record/madhuri.php",
    "MADHURI NIGHT": "https://dpboss.tax/jodi-chart-record/madhuri-night.php",
    "MADHUR MORNING": "https://dpboss.tax/jodi-chart-record/madhur-morning.php",
    "MADHUR DAY": "https://dpboss.tax/jodi-chart-record/madhur-day.php",
    "MADHUR NIGHT": "https://dpboss.tax/jodi-chart-record/madhur-night.php"
}

def fetch_chart_data(url):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        html = urllib.request.urlopen(req, timeout=10).read().decode('utf-8')
        rows = re.findall(r'<tr.*?>(.*?)</tr>', html, re.DOTALL)
        parsed_grid = []
        for r in rows:
            cells = re.findall(r'<td.*?>(.*?)</td>', r, re.DOTALL)
            if cells:
                row_vals = []
                for c in cells:
                    clean = re.sub(r'<.*?>', '', c).strip()
                    if clean:
                        row_vals.append(clean)
                if row_vals and any(re.match(r'^\d{2}$|^\*\*$', v) for v in row_vals):
                    parsed_grid.append(row_vals)
        return parsed_grid
    except Exception as e:
        print(f"Error fetching {url}: {e}")
        return None

results = {}
for market_name, chart_url in dpboss_charts.items():
    print(f"Fetching {market_name}...")
    grid = fetch_chart_data(chart_url)
    if grid:
        results[market_name] = {
            "name": market_name,
            "rows": len(grid),
            "cols": max(len(r) for r in grid) if grid else 7,
            "data": grid
        }

print(f"Successfully scraped {len(results)} DPBoss charts!")

with open("src/data/dpboss_scraped.json", "w") as f:
    json.dump(results, f, indent=2)

print("Saved to src/data/dpboss_scraped.json")
