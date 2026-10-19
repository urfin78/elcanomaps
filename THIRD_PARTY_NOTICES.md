# Komponenten, Daten und Dienste Dritter

Der eigene Code von ElcanoMaps steht unter der [MIT-Lizenz](LICENSE).
ElcanoMaps enthält selbst **keinen** Fremdcode im Repository. Die unten genannten
Bibliotheken werden zur Laufzeit unverändert per CDN geladen, Kartendaten und
Dienste werden direkt vom Browser der Nutzer abgefragt. Für diese gelten die
jeweiligen Lizenzen und Nutzungsbedingungen.

## Bibliotheken (per CDN, unverändert)

| Komponente | Version | Lizenz | Quelle | Eingebunden über |
| :--- | :--- | :--- | :--- | :--- |
| MapLibre GL JS | 5.24.0 | BSD-3-Clause | <https://github.com/maplibre/maplibre-gl-js> | `unpkg.com` (`index.html`) |
| Mediabunny | 1.61.6 | MPL-2.0 | <https://github.com/Vanilagy/mediabunny> | `unpkg.com`, erst beim Video-Export (`js/export.js`) |

## Kartendaten und Kartenstile

| Quelle | Lizenz / Bedingungen | Pflichtangabe |
| :--- | :--- | :--- |
| OpenStreetMap-Daten | [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/) | © OpenStreetMap contributors |
| [OpenFreeMap](https://openfreemap.org) (Vektorkacheln, Stile Liberty, Bright, Positron, Dark, Fiord) | Projekt MIT; Kachelschema und Stile auf Basis von [OpenMapTiles](https://openmaptiles.org) (Code BSD-3-Clause, Design CC BY 4.0) | © OpenFreeMap © OpenMapTiles © OpenStreetMap contributors |
| Schriften (Noto Sans, über OpenFreeMap) | [SIL Open Font License 1.1](https://openfontlicense.org) | – |
| OpenStreetMap-Rasterkacheln (`tile.openstreetmap.org`) | Daten ODbL; [Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) | © OpenStreetMap contributors |
| [Sentinel-2 cloudless 2016](https://s2maps.eu) von EOX IT Services GmbH | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) | Sentinel-2 cloudless – s2maps.eu by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016) |

Die Pflichtangabe des gewählten Kartenstils wird in jedes exportierte Bild und
Video eingebrannt (unten rechts).

## Dienste

| Dienst | Software-Lizenz | Daten | Nutzungsbedingungen |
| :--- | :--- | :--- | :--- |
| [Photon](https://photon.komoot.io) (Ortssuche, betrieben von komoot) | Apache-2.0 | OpenStreetMap (ODbL) | Faire Nutzung, keine Massenabfragen |
| [FOSSGIS OSRM](https://routing.openstreetmap.de) (Routing Auto/Rad/Fuß) | OSRM: BSD-2-Clause | OpenStreetMap (ODbL) | [Nutzungsbedingungen FOSSGIS](https://routing.openstreetmap.de/about.html) |

## Sonstiges

- **Fahrzeug-Icons** sind Emojis aus der Systemschrift des jeweiligen Geräts; es
  werden keine Emoji-Grafiken mit ausgeliefert.
- **Testwerkzeuge** (`test/`) nutzen nur die Python-Standardbibliothek und ein
  lokal installiertes Google Chrome; beides wird nicht mit ausgeliefert.
