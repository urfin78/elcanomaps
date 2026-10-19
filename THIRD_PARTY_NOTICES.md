# Third-party components, data and services

ElcanoMaps' own code is licensed under the [MIT License](LICENSE).
The repository itself contains **no** third-party code. The libraries listed
below are loaded unmodified from a CDN at runtime; map data and services are
requested directly by the user's browser. Their respective licenses and terms
of use apply.

## Libraries (via CDN, unmodified)

| Component | Version | License | Source | Loaded via |
| :--- | :--- | :--- | :--- | :--- |
| MapLibre GL JS | 5.24.0 | BSD-3-Clause | <https://github.com/maplibre/maplibre-gl-js> | `unpkg.com` (`index.html`) |
| Mediabunny | 1.61.6 | MPL-2.0 | <https://github.com/Vanilagy/mediabunny> | `unpkg.com`, only when exporting a video (`js/export.js`) |

## Map data and map styles

| Source | License / terms | Required attribution |
| :--- | :--- | :--- |
| OpenStreetMap data | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) | © OpenStreetMap contributors |
| [OpenFreeMap](https://openfreemap.org) (vector tiles, styles Liberty, Bright, Positron, Dark, Fiord) | Project MIT; tile schema and styles based on [OpenMapTiles](https://openmaptiles.org) (code BSD-3-Clause, design CC BY 4.0) | © OpenFreeMap © OpenMapTiles © OpenStreetMap contributors |
| Fonts (Noto Sans, via OpenFreeMap) | [SIL Open Font License 1.1](https://openfontlicense.org) | – |
| OpenStreetMap raster tiles (`tile.openstreetmap.org`) | Data ODbL; [Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) | © OpenStreetMap contributors |
| [EOxCloudless / Sentinel-2 cloudless 2016](https://cloudless.eox.at) by EOX IT Services GmbH | The 2016 layer was published under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); current [EOX license terms](https://cloudless.eox.at/documentation/license): non-commercial use under CC BY-NC-SA 4.0, commercial use only with an EOX license | EOxCloudless – https://cloudless.eox.at by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016) |

The required attribution of the selected map style is burned into every
exported image and video (bottom right).
The live map additionally credits the routing service (“Routing: FOSSGIS
OSRM”) and links to <https://www.openstreetmap.org/fixthemap>.

Video export is disabled for the OpenStreetMap raster tiles: the
[Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) does
not allow loading tiles nobody is viewing, which the camera movement of a video
export would do.

## Services

| Service | Software license | Data | Terms of use |
| :--- | :--- | :--- | :--- |
| [Photon](https://photon.komoot.io) (place search, operated by komoot) | Apache-2.0 | OpenStreetMap (ODbL) | Fair use, extensive usage is throttled; search starts at 3 characters and is debounced |
| [FOSSGIS OSRM](https://routing.openstreetmap.de) (routing for car/bike/foot) | OSRM: BSD-2-Clause | OpenStreetMap (ODbL) | [FOSSGIS terms of use](https://routing.openstreetmap.de/about.html): max. one request per second (enforced by the app), no heavy usage, attribution and a “fix the map” link |

## Other

- **Vehicle icons** are emojis from the system font of the user's device; no
  emoji graphics are shipped.
- **Test tools** (`test/`) use only the Python standard library and a locally
  installed Google Chrome. In GitHub Actions, the tests additionally run with
  [Playwright](https://github.com/microsoft/playwright) (Apache-2.0), installed
  via npm on the runner. None of these are shipped with the app.
