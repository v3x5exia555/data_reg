---
description: Run the full weekly scraping, update the Word report, and restart the dashboard tunnels
---

This workflow automates the end-to-end hotel intelligence process. It captures new market data, generates a fresh business report, and ensures the remote dashboard is live.

// turbo-all

1. Run the Weekly Scraping Pipeline (7-day window)

```bash
./venv/bin/python3 main.py --week
```

2. Generate the Updated Business Presentation Guide (.docx)

```bash
./venv/bin/python3 scripts/convert_to_word.py docs/PRESENTATION_GUIDE_LITE.md docs/Hotel_Intelligence_Presentation_Lite.docx
```

3. Synchronize Cloud Data to Local Dashboard (Ensure 5,070+ records)

```bash
./venv/bin/python3 scripts/full_sync_down.py --days 7
```

4. Launch/Restart the V3 Dashboard and Remote Access Tunnels

```bash
bash scripts/up.sh --force
```
