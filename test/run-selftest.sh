#!/usr/bin/env bash
# Runs test/selftest.html (routing, image and video export) in headless Chrome.
# Results: .test/result.json, .test/export.*
# Usage: test/run-selftest.sh [query]   e.g. test/run-selftest.sh "style=dark&type=webm"
set -euo pipefail
source "$(dirname "$0")/env.sh"

rm -f "$OUT/result.json" "$OUT"/export.*
chrome --window-size=1280,900 --remote-debugging-port=$((PORT + 2)) \
    "$BASE/test/selftest.html?${1:-}" &
PIDS="$PIDS $!"

# Wait for the result (max. 5 min)
for _ in $(seq 600); do
    [[ -s "$OUT/result.json" ]] && break
    sleep 0.5
done

if ! jq -e . "$OUT/result.json" >/dev/null 2>&1; then
    echo "No result. Chrome log: $OUT/chrome.log"
    exit 1
fi
jq . "$OUT/result.json"
ls -la "$OUT"/export.* 2>/dev/null || true
