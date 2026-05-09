#!/bin/bash
# ============================================================
# deploy-hostinger.sh — Deploy DataRex to Hostinger Production
# Usage: ./deploy-hostinger.sh
# ============================================================
set -e

SSH_HOST="145.79.25.167"
SSH_PORT="65002"
SSH_USER="u713770290"
SSH_PASS="External2605."
REMOTE_PATH="domains/mediumturquoise-elephant-638443.hostingersite.com/public_html"
LIVE_URL="https://mediumturquoise-elephant-638443.hostingersite.com"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo ""
echo "========================================"
echo "  DataRex — Deploy to Hostinger"
echo "  Host: $SSH_HOST:$SSH_PORT"
echo "  Path: ~/$REMOTE_PATH"
echo "========================================"
echo ""

# Step 1: Confirm
read -p "Push latest code to Hostinger production? (y/N): " confirm
if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
  echo -e "${YELLOW}Deploy cancelled.${NC}"
  exit 0
fi

# Step 2: Rsync
echo -e "${GREEN}[1/3]${NC} Syncing files to Hostinger..."
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
  --exclude '*.pyc' \
  -e "sshpass -p '$SSH_PASS' ssh -o StrictHostKeyChecking=no -p $SSH_PORT" \
  ./ "$SSH_USER@$SSH_HOST:$REMOTE_PATH"

# Step 3: Verify
echo ""
echo -e "${GREEN}[2/3]${NC} Files deployed. Checking site response..."

HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' "$LIVE_URL")
if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}[3/3]${NC} Site is live — HTTP $HTTP_CODE"
else
  echo -e "${RED}[3/3] WARNING: Site returned HTTP $HTTP_CODE${NC}"
fi

echo ""
echo "========================================"
echo -e "  ${GREEN}Done!${NC}"
echo "  URL: $LIVE_URL"
echo "========================================"
