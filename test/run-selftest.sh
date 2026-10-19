#!/usr/bin/env bash
# Führt test/selftest.html (Routing, Bild- und Video-Export) in Headless-Chrome aus.
# Ergebnisse: .test/result.json, .test/export.*
# Aufruf: test/run-selftest.sh [query]   z. B. test/run-selftest.sh "style=dark&type=webm"
set -euo pipefail
source "$(dirname "$0")/env.sh"

rm -f "$OUT/result.json" "$OUT"/export.*
chrome --window-size=1280,900 --remote-debugging-port=$((PORT + 2)) \
    "$BASE/test/selftest.html?${1:-}" &
PIDS="$PIDS $!"

# Auf das Ergebnis warten (max. 5 min)
for _ in $(seq 600); do
    [[ -s "$OUT/result.json" ]] && break
    sleep 0.5
done

if ! jq -e . "$OUT/result.json" >/dev/null 2>&1; then
    echo "Kein Ergebnis. Chrome-Log: $OUT/chrome.log"
    exit 1
fi
jq . "$OUT/result.json"
ls -la "$OUT"/export.* 2>/dev/null || true
