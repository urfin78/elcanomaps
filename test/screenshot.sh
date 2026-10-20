#!/usr/bin/env bash
# Screenshot der App (index.html) mit einem Zustand aus einer JSON-Datei.
# Wartet in Echtzeit (DevTools-Protokoll), damit Routing und Rendering wie im Browser ablaufen.
# Aufruf: test/screenshot.sh <state.json> [breite,höhe] [ausgabe.png] [query]
#   z. B. test/screenshot.sh test/demo-state.json 1400,900 .test/en.png "lang=en"
# Wartezeit in Sekunden über WAIT (Standard 15); optional JS über SCRIPT, das danach
# ausgeführt wird (z. B. SCRIPT="document.querySelector('#lang').value='en'; ...").
set -euo pipefail
STATE_FILE=$(realpath "$1")
SIZE=${2:-1400,900}
source "$(dirname "$0")/env.sh"
SHOT=${3:-$OUT/screenshot.png}
QUERY=${4:+?$4}
DEVTOOLS=$((PORT + 2))

# Zustand wie die App als base64url in den URL-Hash kodieren
HASH=$(jq -c . "$STATE_FILE" | base64 -w0 | tr '+/' '-_' | tr -d '=')
rm -f "$SHOT"
chrome --window-size="$SIZE" --hide-scrollbars --remote-debugging-port="$DEVTOOLS" \
    "$BASE/index.html$QUERY#r=$HASH" &
PIDS="$PIDS $!"
python3 -I test/cdp_screenshot.py "$DEVTOOLS" "${WAIT:-15}" "$SHOT" "${SCRIPT:-}" >/dev/null
ls -la "$SHOT"
