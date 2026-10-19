# ElcanoMaps

[![JS syntax](https://github.com/urfin78/elcanomaps/actions/workflows/js-syntax.yml/badge.svg?branch=main)](https://github.com/urfin78/elcanomaps/actions/workflows/js-syntax.yml) [![Smoke tests](https://github.com/urfin78/elcanomaps/actions/workflows/smoke.yml/badge.svg?branch=main)](https://github.com/urfin78/elcanomaps/actions/workflows/smoke.yml) [![Export self-test](https://github.com/urfin78/elcanomaps/actions/workflows/export.yml/badge.svg?branch=main)](https://github.com/urfin78/elcanomaps/actions/workflows/export.yml)

Travel routes as images and animated videos – right in the browser, no server,
no build step, using open data from OpenStreetMap.

**Try it online:** <https://urfin78.github.io/elcanomaps/>

## Features

- **Build a route:** search for places, add them as stops, reorder them by
  drag & drop or with the arrow buttons.
- **Mode of transport per leg:** car, bike and walking are routed along roads;
  train, ferry and flight are drawn as straight lines or great-circle arcs.
- **Map styles:** Liberty, Bright, Positron, Dark, Fiord (OpenFreeMap),
  OpenStreetMap raster, satellite (Sentinel-2).
- **Styling:** title, place names, a single route colour or one colour per mode
  of transport.
- **Image export:** PNG, JPEG or WebP using presets (square, story 9:16, 16:9,
  A4 at 300 dpi) or a custom size.
- **Video export:** MP4 or WebM; animated vehicle per leg, camera follows the
  vehicle or shows the whole route; live preview.
- **Save & share:** state is stored in the link (URL hash) and in the browser;
  import/export as JSON, export as GeoJSON.

The user interface is in German.

## Running locally

The app consists of static files only. ES modules don't work over `file://`,
so use any local web server, for example:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000> and start with „lade eine Beispielroute“
(load a sample route).

Any static web hosting is enough to host it.

## Requirements

- A current browser with WebGL. Video export needs WebCodecs (current versions
  of Chrome, Edge, Firefox and Safari).
- Keep the tab in the foreground while exporting a video: browsers throttle
  rendering in background tabs.

## How it works

A central data model (`js/state.js`) holds stops, legs and settings. From it
the geometries are computed (`js/routing.js`), drawn on a
[MapLibre](https://maplibre.org) map (`js/map.js`) and exported
(`js/export.js`).

For exports, a hidden second map renders at the target resolution. For videos,
every frame is computed deterministically (`js/animation.js`): point in time →
vehicle position and camera → wait until all tiles are loaded → frame to the
browser's video encoder. The video therefore never stutters, even on slow
devices – the export just takes longer there.

| File | Purpose |
| :--- | :--- |
| `index.html`, `css/style.css` | Layout and user interface |
| `js/state.js` | Data model, validation, persistence |
| `js/routing.js` | Place search, routing, great circle |
| `js/geo.js` | Geometry helpers |
| `js/map.js` | Map styles, custom layers, offscreen map |
| `js/animation.js` | Timeline and camera movement |
| `js/export.js` | Image and video export |
| `js/main.js` | UI wiring |

## External services and privacy

The user's browser sends requests directly to these services (which transmits
the IP address):

- `unpkg.com` – JavaScript libraries
- `tiles.openfreemap.org` – vector tiles and fonts
- `tile.openstreetmap.org`, `tiles.maps.eox.at` – raster tiles (only when
  selected)
- `photon.komoot.io` – place search
- `routing.openstreetmap.de` – routing

There is no backend; routes are stored only in the browser (`localStorage`)
and in the link.

## Tests

A self-test checks routing, image and video export in headless Chrome (needs
only Python 3 and Google Chrome):

```bash
test/run-selftest.sh                     # default
test/run-selftest.sh "style=dark&type=webm&camera=overview"
test/screenshot.sh test/demo-state.json  # screenshot of the UI
```

Results end up in `.test/` (not versioned).

On every push to `main` and on pull requests, GitHub Actions runs:

- **JS syntax** – `node --check` for all scripts,
- **Smoke tests** – the UI with Playwright (`test/smoke.spec.js`): startup,
  sample route, editing stops, state from link,
- **Export self-test** – `test/selftest.html` with Playwright
  (`test/export.spec.js`) as MP4 and WebM; the exported files are attached to
  the workflow run as an artifact.

To run the Playwright tests locally (needs Node.js and Google Chrome):

```bash
npm install --prefix .github
NODE_PATH=.github/node_modules .github/node_modules/.bin/playwright test --config test/playwright.config.js
```

## Known limitations

- Train routes are drawn as straight lines – there is no free routing service
  for railways.
- Markers overlap when stops are very close together.
- The public services (Photon, FOSSGIS, OSM tiles) are meant for moderate use;
  for heavy load, use your own instances or commercial providers.

## License

Own code: [MIT](LICENSE). Third-party libraries, map data and services with
their licenses: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
