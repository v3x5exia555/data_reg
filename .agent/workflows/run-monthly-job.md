---
description: Run the comprehensive monthly hotel scraping and Supabase synchronization
---

This workflow executes the full-scale monthly audit (30-day window). It can run platforms
**sequentially** (one after another) or **in parallel** (all 3 at the same time).

// turbo-all

---

## Option A — Parallel (Recommended: 3× faster)

Launches Booking, Agoda, and Traveloka simultaneously. Each gets its own process pool
with 3 workers. Supabase sync runs automatically at the end.

```bash
python3 scripts/run_parallel_platforms.py --monthly --workers 3
```

> Use `--no-sync` to skip the Supabase push.
> Use `--platforms booking agoda` to run only specific platforms.

---

## Option B — Sequential (Original single-platform flow)

This command handles data sync to Supabase and starts the 2-worker scraping pipeline
for the next 30 days, one platform at a time.

```bash
python3 scripts/process_job.py --monthly
```

---

### After either run:

### 2. Synchronize Cloud Data to Local Dashboard (Monthly Refresh)

Ensure your local dashboard has the latest 30-day history from Supabase:

```bash
./venv/bin/python3 scripts/full_sync_down.py --days 31
```

### 3. Verify Dashboard Services

Restart the V3 dashboard and tunnels to reflect the new dataset:

```bash
bash scripts/up.sh --force
```

Check the 30-day supply trends at your public URL.
