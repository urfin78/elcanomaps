#!/usr/bin/env bash
# Screenshot der App (index.html) mit einem Zustand aus einer JSON-Datei.
# Aufruf: test/screenshot.sh <state.json> [breite,höhe] [ausgabe.png]
set -euo pipefail
STATE_FILE=$(realpath "$1")
SIZE=${2:-1400,900}
source "$(dirname "$0")/env.sh"
SHOT=${3:-$OUT/screenshot.png}

# Zustand wie die App als base64url in den URL-Hash kodieren
HASH=$(jq -c . "$STATE_FILE" | base64 -w0 | tr '+/' '-_' | tr -d '=')
rm -f "$SHOT"
(chrome --window-size="$SIZE" --hide-scrollbars \
    --virtual-time-budget=15000 --screenshot="$PWD/$SHOT" \
    "$BASE/index.html#r=$HASH")
ls -la "$SHOT"
