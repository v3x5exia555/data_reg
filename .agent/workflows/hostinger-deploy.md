---
description: Deploy the latest code changes to Hostinger production hosting via SSH
---

# Hostinger Deploy Workflow

Push the latest `data_reg` codebase to Hostinger shared hosting via SSH + rsync.

## Connection Details

| Field          | Value                                                      |
|---------------|------------------------------------------------------------|
| SSH Host      | `145.79.25.167`                                            |
| SSH Port      | `65002`                                                    |
| SSH User      | `u713770290`                                               |
| SSH Password  | `External2605.`                                            |
| Web Root      | `~/domains/mediumturquoise-elephant-638443.hostingersite.com/public_html/` |
| Live URL      | `https://mediumturquoise-elephant-638443.hostingersite.com` |

## Deploy Steps

### 1. Quick Deploy (rsync)

From the project root:

```bash
rsync -avz --delete \
  --exclude '.git' \
  --exclude '.env' \
  --exclude '__pycache__' \
  --exclude '.pytest_cache' \
  --exclude 'venv' \
  --exclude 'logs/' \
  --exclude '.DS_Store' \
  --exclude 'scratch/' \
  --exclude 'test_*' \
  --exclude '*.png' \
  --exclude 'uat-test-suite.html' \
  -e "sshpass -p 'External2605.' ssh -o StrictHostKeyChecking=no -p 65002" \
  ./ u713770290@145.79.25.167:domains/mediumturquoise-elephant-638443.hostingersite.com/public_html/
```

### 2. Verify

```bash
curl -s -o /dev/null -w 'HTTP %{http_code}' \
  https://mediumturquoise-elephant-638443.hostingersite.com/
# Expected: HTTP 200
```

## Important Notes

- **Static site only** — no server restart needed (Hostinger serves files directly via Apache/Nginx).
- **`env.json`** must exist in the web root with valid Supabase keys. It is NOT gitignored so it syncs automatically. Check manually if auth breaks.
- **No `npm`/`python` server** — Hostinger shared hosting uses its own web server. Just drop the static files.
- **Passwords never committed to git** — stored in SSH config or interactive prompt only.
