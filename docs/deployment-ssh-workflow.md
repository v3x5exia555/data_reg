# DataRex — SSH Deployment Workflow

## Overview

Push the `data_reg` codebase to **two production targets**:

| Target     | Type               | URL                                                   |
|-----------|--------------------|-------------------------------------------------------|
| **VPS**   | Root server (VPS)  | `http://76.13.183.75:8060`                            |
| **Hostinger** | Shared hosting | `https://mediumturquoise-elephant-638443.hostingersite.com` |

The project is a static site — no build step required. Just rsync the files.

---

## Hostinger (Shared Hosting)

### Connection Details

| Field          | Value                                                      |
|---------------|------------------------------------------------------------|
| SSH Host      | `145.79.25.167`                                            |
| SSH Port      | `65002`                                                    |
| SSH User      | `u713770290`                                               |
| SSH Password  | `External2605.`                                            |
| Web Root      | `~/domains/mediumturquoise-elephant-638443.hostingersite.com/public_html/` |

### Deploy

```bash
rsync -avz --delete \
  --exclude '.git' --exclude '.env' --exclude '__pycache__' \
  --exclude '.pytest_cache' --exclude 'venv' --exclude 'logs/' \
  --exclude '.DS_Store' --exclude 'scratch/' --exclude 'test_*' \
  --exclude '*.png' --exclude 'uat-test-suite.html' \
  -e "sshpass -p 'External2605.' ssh -o StrictHostKeyChecking=no -p 65002" \
  ./ u713770290@145.79.25.167:domains/mediumturquoise-elephant-638443.hostingersite.com/public_html/
```

### Pipeline Script

```bash
./deploy-hostinger.sh
```

> **Note:** Hostinger uses its own Apache/Nginx — no server restart needed. Just drop the files.

---

## VPS (Root Server)

### Connection Details

| Field        | Value                         |
|-------------|-------------------------------|
| SSH Host    | `76.13.183.75`                |
| SSH User    | `root`                        |
| SSH Port    | `22`                          |
| Password    | `Sunflower@7-bloom`           |
| Remote Path | `/root/data_reg`              |

---

## 2. Quick Deploy (rsync)

```bash
# From project root
rsync -avz --delete \
  --exclude '.git' \
  --exclude '.env' \
  --exclude '__pycache__' \
  --exclude 'venv' \
  --exclude '.pytest_cache' \
  --exclude 'node_modules' \
  --exclude 'test_*.py' \
  --exclude '*.md' \
  -e "ssh -o StrictHostKeyChecking=no" \
  ./ root@76.13.183.75:/root/data_reg/
```

### What it does

| Flag          | Meaning                              |
|---------------|--------------------------------------|
| `-a`          | Archive mode (preserves permissions) |
| `-v`          | Verbose output                       |
| `-z`          | Compress during transfer             |
| `--delete`    | Remove remote files not in source    |
| `--exclude`   | Skip unnecessary files               |

---

## 3. Deploy via Git (Alternative)

### 3a. On the remote server (one-time setup)

```bash
ssh root@76.13.183.75

# Install git if missing
apt update && apt install git -y

# Clone the repository
git clone https://github.com/v3x5exia555/data_reg.git /root/data_reg
cd /root/data_reg

# Set up SSH key for passwordless pulls (optional)
ssh-keygen -t rsa -b 4096 -C "deploy_key" -N "" -f ~/.ssh/id_rsa
cat ~/.ssh/id_rsa.pub
# → Add this key to GitHub: Settings → SSH and GPG keys → New SSH key
git remote set-url origin git@github.com:v3x5exia555/data_reg.git
```

### 3b. Daily deploy (pull latest)

```bash
ssh root@76.13.183.75 "cd /root/data_reg && git pull origin main"
```

Or from local machine in one line:

```bash
ssh -o StrictHostKeyChecking=no root@76.13.183.75 \
  "cd /root/data_reg && git pull origin main"
```

---

## 4. Environment Variables

After first deploy, copy `.env` to the remote server:

```bash
scp -o StrictHostKeyChecking=no .env root@76.13.183.75:/root/data_reg/.env
```

> **Never** commit `.env` to git. The `.gitignore` already excludes it.

---

## 5. Start / Restart the Server on Remote

```bash
ssh -o StrictHostKeyChecking=no root@76.13.183.75 \
  "cd /root/data_reg && \
   pkill -f 'python3 -m http.server 8060' 2>/dev/null; \
   nohup python3 -m http.server 8060 --directory . > server.log 2>&1 &"
```

### Verify it's running

```bash
ssh -o StrictHostKeyChecking=no root@76.13.183.75 \
  "curl -s -o /dev/null -w '%{http_code}' http://localhost:8060"
# Expected: 200
```

---

## 6. Full Deploy Script (`deploy.sh`)

Save this at the project root for one-command deployment:

```bash
#!/bin/bash
# deploy.sh — Deploy DataRex to production VPS
# Usage: ./deploy.sh [branch]

set -e

HOST="76.13.183.75"
REMOTE_PATH="/root/data_reg"
BRANCH="${1:-main}"

echo "========================================"
echo "  DataRex — Deploy to Production"
echo "  Host: $HOST"
echo "  Path: $REMOTE_PATH"
echo "  Branch: $BRANCH"
echo "========================================"

# Step 1: Push latest code to GitHub
echo "[1/4] Pushing to GitHub..."
git push origin "$BRANCH"

# Step 2: SSH in and pull on remote
echo "[2/4] Pulling on remote server..."
ssh -o StrictHostKeyChecking=no "root@$HOST" \
  "cd $REMOTE_PATH && git pull origin $BRANCH"

# Step 3: Copy .env file
echo "[3/4] Syncing .env..."
scp -o StrictHostKeyChecking=no .env "root@$HOST:$REMOTE_PATH/.env"

# Step 4: Restart server
echo "[4/4] Restarting server..."
ssh -o StrictHostKeyChecking=no "root@$HOST" \
  "cd $REMOTE_PATH && \
   pkill -f 'python3 -m http.server 8060' 2>/dev/null; \
   nohup python3 -m http.server 8060 --directory . > server.log 2>&1 &"

echo "========================================"
echo "  Done! Site running at:"
echo "  http://$HOST:8060"
echo "========================================"
```

Make it executable:

```bash
chmod +x deploy.sh
```

---

## 7. SSH Config Shortcut (Optional)

Add to `~/.ssh/config` for shorter commands:

```text
Host datarex
    HostName 76.13.183.75
    User root
    Port 22
```

Then deploy with:

```bash
rsync -avz --delete --exclude '.git' --exclude '.env' \
  ./ datarex:/root/data_reg/

ssh datarex "cd /root/data_reg && pkill -f 'http.server 8060'; nohup python3 -m http.server 8060 > server.log 2>&1 &"
```

---

## Architecture Summary

```
Local Machine
┌─────────────────┐
│  data_reg/      │
│  ├── index.html │
│  ├── js/        │
│  ├── css/       │
│  ├── pages/     │
│  └── env.json   │
└──────┬──────────┘
       │
       ├── rsync ──────────────────────────────────┐
       │                                           │
       ▼                                           ▼
┌───────────────────────────┐    ┌──────────────────────────────────────────────┐
│ VPS (76.13.183.75)        │    │ Hostinger Shared Hosting                     │
│ /root/data_reg/           │    │ ~/domains/.../public_html/                   │
│                           │    │                                              │
│ python3 -m http.server    │    │ Apache / Nginx (managed by Hostinger)         │
│ :8060                     │    │                                              │
│       │                   │    │       │                                      │
│       ▼                   │    │       ▼                                      │
│ http://76.13.183.75:8060  │    │ https://...hostingstersite.com                │
└───────────────────────────┘    └──────────────────────────────────────────────┘
```
