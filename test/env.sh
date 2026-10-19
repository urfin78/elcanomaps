# Gemeinsame Testumgebung: lokaler Testserver, ggf. Proxy-Weiterleiter, Chrome-Aufruf.
# Wird von den Testskripten per `source` eingebunden. Alles bleibt in .test/.

cd "$(dirname "${BASH_SOURCE[0]}")/.."
OUT=.test
PORT=8765
BASE="http://127.0.0.1:$PORT"
# Frisches Chrome-Profil pro Lauf (verhindert gesperrte Profile durch Altprozesse)
PROFILE="$OUT/chrome-$$"
mkdir -p "$OUT/home" "$PROFILE"

python3 -I test/server.py "$PORT" >"$OUT/server.log" 2>&1 &
PIDS=$!
trap 'kill $PIDS 2>/dev/null; sleep 0.5; rm -rf "$PROFILE"' EXIT

# In einer Umgebung mit authentifiziertem HTTPS-Proxy (z. B. Sandbox) einen lokalen Weiterleiter nutzen
PROXY_ARGS=()
if [[ -n "${HTTPS_PROXY:-}" ]]; then
    python3 -I test/auth_proxy.py $((PORT + 1)) >"$OUT/proxy.log" 2>&1 &
    PIDS="$PIDS $!"
    PROXY_ARGS=(--proxy-server="http://127.0.0.1:$((PORT + 1))")
fi

for _ in $(seq 50); do
    curl -s --noproxy '*' -o /dev/null "$BASE/" && break
    sleep 0.1
done

# Chrome-Profil und HOME bleiben im Projekt; Chromes eigene Google-Anfragen sind abgeschaltet.
# exec: im Hintergrund gestartet ist $! dann wirklich der Chrome-Prozess (für kill im trap)
chrome() {
    HOME="$PWD/$OUT/home" XDG_CONFIG_HOME="$PWD/$OUT/home" XDG_CACHE_HOME="$PWD/$OUT/home" \
    exec google-chrome \
        --headless=new --no-sandbox --disable-dev-shm-usage --no-first-run \
        --disable-background-networking --disable-component-update --disable-sync \
        --disable-default-apps --disable-features=OptimizationHints,MediaRouter,OnDeviceModelService \
        --user-data-dir="$PWD/$PROFILE" \
        --use-angle=swiftshader --enable-unsafe-swiftshader \
        "${PROXY_ARGS[@]}" \
        "$@" 2>>"$OUT/chrome.log"
}
