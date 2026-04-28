#!/bin/bash
# Data-Reg - Unified Startup & Watchdog
# Use: ./up.sh (automatic check & start) or ./up.sh --force (reset everything)

# Configuration
PORT=8060
LOG_DIR="logs"
SERVER_LOG="$LOG_DIR/server.log"
BOOT_LOCK="/tmp/data_reg_booting.lock"

# 0. Environment Setup
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT" || exit
mkdir -p "$LOG_DIR"

# 1. Check for Force Flag
FORCE=0
if [[ "$*" == *"--force"* ]]; then FORCE=1; fi

# 2. Watchdog Logic (Skip if everything is already UP and NO force flag)
SERVER_UP=$(pgrep -f "http.server $PORT")

if [ $FORCE -eq 0 ] && [ -n "$SERVER_UP" ]; then
    # If run manually in a terminal, provide feedback
    if [ -t 1 ]; then
        echo "✅ Services are already healthy and running in the background."
        echo "💡 Use 'bash script/up.sh --force' to reset."
    fi
    exit 0
fi

# 3. Prevent race conditions
if [ -f "$BOOT_LOCK" ]; then
    if [ $FORCE -eq 1 ]; then
        echo "⚠️ Force flag detected. Removing stale boot lock..."
        rm -f "$BOOT_LOCK"
    else
        echo "⏳ System is already booting. Waiting..."
        exit 0
    fi
fi

# 4. Start Sequence
echo $$ > "$BOOT_LOCK"
trap "rm -f $BOOT_LOCK" EXIT

echo "🚀 [$(date)] Starting Data-Reg Services..."
if [ $FORCE -eq 1 ]; then echo "🧹 Force reset requested. Cleaning up old processes..."; fi

# Cleanup
# We kill any processes listening on our port and specifically our python server.
lsof -ti :$PORT | xargs kill -9 2>/dev/null || true
pkill -f "http.server $PORT"
sleep 2

# Start Python HTTP Server
echo "📊 Launching Python HTTP Server on port $PORT..."
nohup python3 -m http.server $PORT > "$SERVER_LOG" 2>&1 &

# Step 4.1: Verify health
echo "⏳ Waiting for server to respond..."
MAX_ATTEMPTS=5
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if curl -s -I http://localhost:$PORT | grep -q "200"; then
        echo "✅ Server is responding on localhost:$PORT"
        break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    echo "   Attempt $ATTEMPT/$MAX_ATTEMPTS... waiting"
    sleep 2
done

# 5. Result Reporting
echo -e "\n=============================================="
echo -e "✅ SERVICES ARE UP AND RUNNING"
echo -e "=============================================="
echo -e "📍 LOCAL ADDRESS: http://localhost:$PORT"
echo -e "=============================================="
