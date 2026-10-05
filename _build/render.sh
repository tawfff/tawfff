#!/bin/bash
# Render a card page to a PNG at 2x. Usage: _build/render.sh page.html out.png WIDTH HEIGHT [?query]
# Headless Chrome writes the file but does not always exit, so wait for the file, then stop it.
set -euo pipefail
PROFILE="$(mktemp -d)"; rm -f "$2"
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu ${CHROME_FLAGS:-} --hide-scrollbars \
  --user-data-dir="$PROFILE" --force-device-scale-factor=2 --window-size="$3,$4" \
  --virtual-time-budget=${VT:-3000} --screenshot="$2" "$( [[ $1 == http* ]] && echo "$1" || echo "file://$(cd "$(dirname "$1")" && pwd)/$(basename "$1")${5:-}" )" 2>/dev/null &
for _ in $(seq 60); do [ -s "$2" ] && break; sleep 0.5; done
sleep 1; pkill -f "user-data-dir=$PROFILE" || true; sleep 1; rm -rf "$PROFILE" 2>/dev/null || true
[ -s "$2" ] && echo "wrote $2"
