# ElcanoMaps

Reiserouten als Bild und animiertes Video – direkt im Browser, ohne Server,
ohne Build-Schritt, mit freien Daten aus OpenStreetMap.

## Funktionen

- **Route zusammenstellen:** Orte suchen, als Stopps hinzufügen, per Drag & Drop
  oder Pfeiltasten sortieren.
- **Verkehrsmittel je Abschnitt:** Auto, Fahrrad und zu Fuß werden über Straßen
  geroutet; Zug, Fähre und Flug als Luftlinie bzw. Großkreisbogen.
- **Kartenstile:** Liberty, Bright, Positron, Dark, Fiord (OpenFreeMap),
  OpenStreetMap-Raster, Satellit (Sentinel-2).
- **Gestaltung:** Titel, Ortsnamen, eine Routenfarbe oder Farbe je Verkehrsmittel.
- **Bild-Export:** PNG, JPEG oder WebP in Vorlagen (Quadrat, Story 9:16,
  16:9, A4 mit 300 dpi) oder eigener Größe.
- **Video-Export:** MP4 oder WebM; Animationsfahrzeug je Abschnitt, Kamera folgt
  dem Fahrzeug oder zeigt die Gesamtansicht; Live-Vorschau.
- **Speichern & Teilen:** Zustand im Link (URL-Hash) und im Browser gespeichert,
  Export/Import als JSON, Export als GeoJSON.

## Starten

Die App besteht nur aus statischen Dateien. ES-Module funktionieren nicht über
`file://`, daher einen beliebigen lokalen Webserver verwenden, z. B.:

```bash
python3 -m http.server 8000
```

Dann <http://localhost:8000> öffnen und mit „lade eine Beispielroute“ beginnen.

Für das Hosting genügt jeder statische Webspace (z. B. GitHub Pages).

## Voraussetzungen

- Aktueller Browser mit WebGL. Für den Video-Export wird WebCodecs benötigt
  (aktuelle Versionen von Chrome, Edge, Firefox und Safari).
- Während des Video-Exports den Tab im Vordergrund lassen: Browser drosseln das
  Rendering in Hintergrund-Tabs.

## Wie es funktioniert

Ein zentrales Datenmodell (`js/state.js`) enthält Stopps, Abschnitte und
Einstellungen. Daraus werden die Geometrien berechnet (`js/routing.js`), auf
einer [MapLibre](https://maplibre.org)-Karte dargestellt (`js/map.js`) und
exportiert (`js/export.js`).

Für Exporte rendert eine unsichtbare zweite Karte in Zielauflösung. Beim Video
wird jeder Frame deterministisch berechnet (`js/animation.js`): Zeitpunkt →
Fahrzeugposition und Kamera → warten, bis alle Kacheln geladen sind → Bild an
den Video-Encoder des Browsers. Dadurch ruckelt das Video nie, auch auf
langsamen Geräten – der Export dauert dort nur länger.

| Datei | Aufgabe |
| :--- | :--- |
| `index.html`, `css/style.css` | Layout und Oberfläche |
| `js/state.js` | Datenmodell, Validierung, Speicherung |
| `js/routing.js` | Ortssuche, Routing, Großkreis |
| `js/geo.js` | Geometrie-Hilfsfunktionen |
| `js/map.js` | Kartenstile, eigene Layer, Offscreen-Karte |
| `js/animation.js` | Zeitleiste und Kameraführung |
| `js/export.js` | Bild- und Video-Export |
| `js/main.js` | UI-Verdrahtung |

## Externe Dienste und Datenschutz

Der Browser der Nutzer fragt direkt bei diesen Diensten an (dabei wird die
IP-Adresse übertragen):

- `unpkg.com` – JavaScript-Bibliotheken
- `tiles.openfreemap.org` – Vektorkarten und Schriften
- `tile.openstreetmap.org`, `tiles.maps.eox.at` – Rasterkarten (nur bei Auswahl)
- `photon.komoot.io` – Ortssuche
- `routing.openstreetmap.de` – Routing

Es gibt kein eigenes Backend; Routen werden nur im Browser (`localStorage`) und
im Link gespeichert.

## Tests

Ein Selbsttest prüft Routing, Bild- und Video-Export in Headless-Chrome
(benötigt nur Python 3 und Google Chrome):

```bash
test/run-selftest.sh                     # Standard
test/run-selftest.sh "style=dark&type=webm&camera=overview"
test/screenshot.sh test/demo-state.json  # Screenshot der Oberfläche
```

Ergebnisse landen in `.test/` (wird nicht versioniert).

## Bekannte Einschränkungen

- Zugstrecken werden als Luftlinie gezeichnet – es gibt keinen freien
  Routing-Dienst für Bahnstrecken.
- Bei sehr nah beieinanderliegenden Stopps überlappen sich die Markierungen.
- Die öffentlichen Dienste (Photon, FOSSGIS, OSM-Kacheln) sind für moderate
  Nutzung gedacht; für hohe Last eigene Instanzen oder kommerzielle Anbieter
  verwenden.

## Lizenz

Eigener Code: [MIT](LICENSE). Bibliotheken, Kartendaten und Dienste Dritter mit
ihren Lizenzen: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
