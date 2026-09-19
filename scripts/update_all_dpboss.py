import urllib.request
import re
import json
import os

markets = [
    ("KALYAN", "https://dpboss.tax/jodi-chart-record/kalyan.php", "kalyan_raw.txt", "kalyan_preset.json", 6),
    ("MAIN BAZAR", "https://dpboss.tax/jodi-chart-record/main-bazar.php", "main_bazar_raw.txt", "main_bazar_preset.json", 5),
    ("TIME BAZAR", "https://dpboss.tax/jodi-chart-record/time-bazar.php", "time_bazar_raw.txt", "time_bazar_preset.json", 7),
    ("SRIDEVI NIGHT", "https://dpboss.tax/jodi-chart-record/sridevi-night.php", "sridevi_night_raw.txt", "sridevi_night_preset.json", 7),
    ("SRIDEVIIII", "https://dpboss.tax/jodi-chart-record/sridevi.php", "srideviiii_raw.txt", "srideviiii_preset.json", 7),
    ("MILAN DAYY", "https://dpboss.tax/jodi-chart-record/milan-day.php", "milan_dayy_raw.txt", "milan_dayy_preset.json", 7),
    ("MILAN NIGHTT", "https://dpboss.tax/jodi-chart-record/milan-night.php", "milan_nightt_raw.txt", "milan_nightt_preset.json", 6),
]

data_dir = "src/data"

def fetch_chart(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
    html = urllib.request.urlopen(req, timeout=12).read().decode('utf-8')
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

for name, url, raw_file, preset_file, expected_cols in markets:
    print(f"Fetching {name} from {url}...")
    grid = fetch_chart(url)
    if grid:
        # Write raw text file
        raw_path = os.path.join(data_dir, raw_file)
        with open(raw_path, "w", encoding="utf-8") as f:
            f.write("\n".join(["\t".join(row) for row in grid]))
        
        # Build preset JSON object
        cols = max(len(r) for r in grid)
        formatted_data = []
        for r_idx, row_vals in enumerate(grid):
            row_obj = []
            for c_idx in range(cols):
                val = row_vals[c_idx] if c_idx < len(row_vals) else ""
                row_obj.append({"r": r_idx, "c": c_idx, "val": val})
            formatted_data.append(row_obj)
            
        preset_obj = {
            "name": name,
            "rows": len(formatted_data),
            "cols": cols,
            "updatedAt": "2026-09-18T21:05:00Z",
            "data": formatted_data
        }
        
        preset_path = os.path.join(data_dir, preset_file)
        with open(preset_path, "w", encoding="utf-8") as f:
            json.dump(preset_obj, f, indent=2)
            
        print(f"✅ {name}: {len(formatted_data)} rows, {cols} cols (Last row: {' '.join(grid[-1])})")
    else:
        print(f"❌ Failed to fetch {name}")

print("All DPBoss charts updated to latest live state!")
