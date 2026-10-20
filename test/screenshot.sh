#!/usr/bin/env bash
# Screenshot of the app (index.html) with a state from a JSON file.
# Waits in real time (DevTools protocol) so routing and rendering behave as in a browser.
# Usage: test/screenshot.sh <state.json> [width,height] [output.png] [query]
#   e.g. test/screenshot.sh test/demo-state.json 1400,900 .test/en.png "lang=en"
# Wait time in seconds via WAIT (default 15); optional JS via SCRIPT, which runs
# afterwards (e.g. SCRIPT="document.querySelector('#lang').value='en'; ...").
set -euo pipefail
STATE_FILE=$(realpath "$1")
SIZE=${2:-1400,900}
source "$(dirname "$0")/env.sh"
SHOT=${3:-$OUT/screenshot.png}
QUERY=${4:+?$4}
DEVTOOLS=$((PORT + 2))

# Encode the state as base64url in the URL hash like the app does
HASH=$(jq -c . "$STATE_FILE" | base64 -w0 | tr '+/' '-_' | tr -d '=')
rm -f "$SHOT"
chrome --window-size="$SIZE" --hide-scrollbars --remote-debugging-port="$DEVTOOLS" \
    "$BASE/index.html$QUERY#r=$HASH" &
PIDS="$PIDS $!"
python3 -I test/cdp_screenshot.py "$DEVTOOLS" "${WAIT:-15}" "$SHOT" "${SCRIPT:-}" >/dev/null
ls -la "$SHOT"
