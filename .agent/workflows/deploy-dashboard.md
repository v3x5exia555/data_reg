---
description: Deploy or restart the V3 Hotel Intelligence Dashboard and tunnels
---

This workflow ensures the V3 dashboard is correctly launched on the remote server with the latest 5,070+ property dataset and live Cloudflare tunnels.

// turbo-all

1. Synchronize Cloud Data (Incremental 7-day refresh)

It is recommended to run a quick sync before deploying to ensure local data is fresh.

```bash
./venv/bin/python3 scripts/full_sync_down.py --days 7
```

2. Force Restart Unified Services

This command kills all old dashboard processes, restarts Gunicorn on port 8050, and re-initializes both the SSH and Web tunnels.

```bash
bash scripts/up.sh --force
```

3. Verify Live Status

Check the logs to ensure the server responded with "Refresh complete" and the tunnels are active.

```bash
tail -n 20 logs/dashboard.log
tail -n 20 logs/dashboard_tunnel.log
```

4. Retrieve Public URL

Capture the latest Cloudflare URL generated for this session:

```bash
grep -oE "https://[a-zA-Z0-9-]+\.trycloudflare\.com" logs/dashboard_tunnel.log | head -n 1
```
