#!/bin/bash
# Deploy SyncMind demo with public cloudflared tunnels
# Usage: ./deploy-demo.sh [start|stop|status]

set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_DIR="$SCRIPT_DIR/.demo-pids"
URL_FILE="$SCRIPT_DIR/.demo-urls"

mkdir -p "$PID_DIR"

start() {
  echo "Starting SyncMind demo deployment..."

  # Check Docker services are running
  if ! docker ps | grep -q syncmind-backend; then
    echo "Starting Docker services..."
    docker compose up -d
    sleep 5
  fi

  # Start cloudflared tunnels
  echo "Starting tunnels..."

  cloudflared tunnel --url http://localhost:6061 > /tmp/cf-backend.log 2>&1 &
  echo $! > "$PID_DIR/cf-backend.pid"

  cloudflared tunnel --url http://localhost:8089 > /tmp/cf-powersync.log 2>&1 &
  echo $! > "$PID_DIR/cf-powersync.pid"

  # Wait for tunnel URLs
  sleep 10

  BACKEND_URL=$(grep -o 'https://[^ ]*\.trycloudflare\.com' /tmp/cf-backend.log | head -1)
  POWERSYNC_URL=$(grep -o 'https://[^ ]*\.trycloudflare\.com' /tmp/cf-powersync.log | head -1)

  if [ -z "$BACKEND_URL" ] || [ -z "$POWERSYNC_URL" ]; then
    echo "ERROR: Failed to get tunnel URLs"
    stop
    exit 1
  fi

  echo "Backend tunnel: $BACKEND_URL"
  echo "PowerSync tunnel: $POWERSYNC_URL"

  # Build frontend with tunnel URLs
  echo "Building frontend..."
  cd "$SCRIPT_DIR/frontend"
  VITE_BACKEND_URL="$BACKEND_URL" VITE_POWERSYNC_URL="$POWERSYNC_URL" npm run build 2>&1 | tail -3

  # Kill existing serve process
  if [ -f "$PID_DIR/serve.pid" ]; then
    kill "$(cat "$PID_DIR/serve.pid")" 2>/dev/null || true
  fi

  # Start static server
  npx serve dist -l 5173 &>/dev/null &
  echo $! > "$PID_DIR/serve.pid"
  sleep 2

  # Start frontend tunnel
  cloudflared tunnel --url http://localhost:5173 > /tmp/cf-frontend.log 2>&1 &
  echo $! > "$PID_DIR/cf-frontend.pid"
  sleep 8

  FRONTEND_URL=$(grep -o 'https://[^ ]*\.trycloudflare\.com' /tmp/cf-frontend.log | head -1)

  # Save URLs
  cat > "$URL_FILE" << EOF
FRONTEND_URL=$FRONTEND_URL
BACKEND_URL=$BACKEND_URL
POWERSYNC_URL=$POWERSYNC_URL
EOF

  echo ""
  echo "=== SyncMind Demo Live ==="
  echo "Frontend: $FRONTEND_URL"
  echo "Backend:  $BACKEND_URL"
  echo "PowerSync: $POWERSYNC_URL"
  echo "=========================="
}

stop() {
  echo "Stopping demo..."
  for pidfile in "$PID_DIR"/*.pid; do
    if [ -f "$pidfile" ]; then
      PID=$(cat "$pidfile")
      kill "$PID" 2>/dev/null || true
      rm "$pidfile"
    fi
  done
  rm -f "$URL_FILE"
  echo "Demo stopped."
}

status() {
  if [ -f "$URL_FILE" ]; then
    echo "=== Demo URLs ==="
    cat "$URL_FILE"
    echo ""
    echo "=== Processes ==="
    for pidfile in "$PID_DIR"/*.pid; do
      if [ -f "$pidfile" ]; then
        PID=$(cat "$pidfile")
        NAME=$(basename "$pidfile" .pid)
        if kill -0 "$PID" 2>/dev/null; then
          echo "  $NAME: running (PID $PID)"
        else
          echo "  $NAME: DEAD (PID $PID)"
        fi
      fi
    done
  else
    echo "Demo not running."
  fi
}

case "${1:-start}" in
  start) start ;;
  stop) stop ;;
  status) status ;;
  *) echo "Usage: $0 [start|stop|status]" ;;
esac
