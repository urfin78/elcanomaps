# Shared test environment: local test server, proxy forwarder if needed, Chrome launcher.
# Included by the test scripts via `source`. Everything stays in .test/.

cd "$(dirname "${BASH_SOURCE[0]}")/.."
OUT=.test
PORT=8765
BASE="http://127.0.0.1:$PORT"
# Fresh Chrome profile per run (avoids profiles locked by leftover processes)
PROFILE="$OUT/chrome-$$"
mkdir -p "$OUT/home" "$PROFILE"

python3 -I test/server.py "$PORT" >"$OUT/server.log" 2>&1 &
PIDS=$!
trap 'kill $PIDS 2>/dev/null; sleep 0.5; rm -rf "$PROFILE"' EXIT

# Behind an authenticated HTTPS proxy (e.g. a sandbox), use a local forwarder
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

# Chrome profile and HOME stay inside the project; Chrome's own Google requests are disabled.
# exec: when started in the background, $! is then really the Chrome process (for kill in the trap)
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
