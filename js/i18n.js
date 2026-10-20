// UI translations and language selection (URL ?lang= → stored choice → browser → English)

export const LANGUAGES = { de: 'Deutsch', en: 'English' };
const FALLBACK = 'en';
const STORAGE_KEY = 'elcanomaps:lang';

const MESSAGES = {
    de: {
        'app.title': 'ElcanoMaps – Reiserouten als Bild & Video',
        'app.tagline': 'Reiserouten als Bild & Video',
        'lang.label': 'Sprache',

        'section.route': 'Route',
        'search.placeholder': 'Ort suchen und hinzufügen …',
        'search.aria': 'Ort suchen',
        'search.failed': 'Suche fehlgeschlagen ({status})',
        'search.place': 'Ort',
        'empty.before': 'Noch keine Stopps. Suche einen Ort oder',
        'empty.demo': 'lade eine Beispielroute',
        'status.computing': 'Berechne Route …',
        'status.legs.one': '{n} Abschnitt · {km} km',
        'status.legs.other': '{n} Abschnitte · {km} km',
        'route.notFound': 'Keine Route gefunden',
        'route.fallback': 'Abschnitt {n}: {message} – Luftlinie verwendet',

        'stop.drag': 'Ziehen zum Sortieren',
        'stop.up': 'Nach oben',
        'stop.down': 'Nach unten',
        'stop.remove': 'Entfernen',
        'segment.mode': 'Verkehrsmittel',
        'segment.vehicle': 'Animationsfahrzeug',
        'segment.auto': 'automatisch',

        'mode.car': 'Auto',
        'mode.bike': 'Fahrrad',
        'mode.foot': 'Zu Fuß',
        'mode.train': 'Zug (Luftlinie)',
        'mode.ferry': 'Fähre (Luftlinie)',
        'mode.flight': 'Flug (Großkreis)',

        'vehicle.car': 'Auto',
        'vehicle.camper': 'Wohnmobil',
        'vehicle.moto': 'Motorrad',
        'vehicle.bus': 'Bus',
        'vehicle.bike': 'Fahrrad',
        'vehicle.foot': 'Fußgänger',
        'vehicle.train': 'Zug',
        'vehicle.ship': 'Schiff',
        'vehicle.plane': 'Flugzeug',
        'vehicle.pin': 'Punkt',

        'section.map': 'Karte',
        'map.style': 'Kartenstil',
        'map.title': 'Titel',
        'map.titlePlaceholder': 'z. B. Roadtrip 2026',
        'map.showLabels': 'Ortsnamen anzeigen',
        'map.colorByMode': 'Farbe nach Verkehrsmittel',
        'map.lineColor': 'Routenfarbe',

        'style.liberty': 'Liberty',
        'style.bright': 'Bright',
        'style.positron': 'Positron (hell)',
        'style.dark': 'Dark',
        'style.fiord': 'Fiord',
        'style.osm': 'OpenStreetMap (Raster)',
        'style.satellite': 'Satellit (Sentinel-2 2016)',

        'format.square': 'Quadrat',
        'format.story': 'Story 9:16',
        'format.landscape': 'Querformat 16:9',
        'format.hd': 'Querformat 16:9',
        'format.a4p': 'A4 hoch, 300 dpi',
        'format.a4l': 'A4 quer, 300 dpi',
        'format.custom': 'Benutzerdefiniert',

        'section.image': 'Bild-Export',
        'image.format': 'Format',
        'image.width': 'Breite',
        'image.height': 'Höhe',
        'image.type': 'Dateityp',
        'image.export': 'Bild exportieren',
        'image.exporting': 'Exportiere …',
        'image.noRoute': 'Keine Route vorhanden.',
        'image.failed': 'Bild konnte nicht erzeugt werden.',

        'section.video': 'Animation & Video',
        'video.format': 'Format',
        'video.camera': 'Kamera',
        'camera.follow': 'Fahrzeug folgen',
        'camera.overview': 'Gesamtansicht',
        'video.duration': 'Dauer (s)',
        'video.fps': 'FPS',
        'video.type': 'Dateityp',
        'video.preview': '▶ Vorschau',
        'video.stop': '■ Stopp',
        'video.export': 'Video exportieren',
        'video.cancel': 'Abbrechen',
        'video.foreground': 'Während des Exports den Tab im Vordergrund lassen.',
        'video.osmHint': 'Mit dem Stil OpenStreetMap (Raster) ist kein Video-Export möglich: '
            + 'Die Tile Usage Policy von OSM erlaubt nicht, Kartenkacheln zu laden, die niemand ansieht. '
            + 'Bitte einen anderen Kartenstil wählen, z. B. Liberty oder Bright.',
        'video.needTwo': 'Für ein Video werden mindestens zwei Stopps benötigt.',
        'video.needTwoAnim': 'Für die Animation werden mindestens zwei Stopps benötigt.',
        'video.noWebCodecs': 'Dieser Browser unterstützt kein WebCodecs (VideoEncoder).',
        'video.noCodec': 'Dieser Browser kann kein {type}-Video in {width}×{height} kodieren.',
        'video.done': 'Video exportiert.',
        'video.aborted': 'Export abgebrochen.',
        'route.addStopsFirst': 'Bitte zuerst Stopps hinzufügen.',

        'section.share': 'Speichern & Teilen',
        'share.link': 'Link kopieren',
        'share.copied': 'Link in die Zwischenablage kopiert.',
        'share.prompt': 'Link kopieren:',
        'share.saveJson': 'JSON speichern',
        'share.loadJson': 'JSON laden',
        'share.geojson': 'GeoJSON',
        'share.clear': 'Route leeren',
        'share.clearConfirm': 'Alle Stopps entfernen?',
        'share.loaded': 'Route geladen.',
        'share.fileError': 'Datei konnte nicht gelesen werden.',

        'footer.credits': 'Kartendaten © OpenStreetMap-Mitwirkende · Suche: Photon (komoot) · '
            + 'Routing: FOSSGIS OSRM · Karten: OpenFreeMap, EOX ·',
        'footer.licenses': 'Lizenzen',

        'demo.title': 'Europa-Reise 2026',
        'demo.stops': ['Hamburg', 'Berlin', 'Prag', 'Wien', 'Lissabon', 'Sintra'],
    },
    en: {
        'app.title': 'ElcanoMaps – travel routes as image & video',
        'app.tagline': 'Travel routes as image & video',
        'lang.label': 'Language',

        'section.route': 'Route',
        'search.placeholder': 'Search and add a place …',
        'search.aria': 'Search place',
        'search.failed': 'Search failed ({status})',
        'search.place': 'Place',
        'empty.before': 'No stops yet. Search for a place or',
        'empty.demo': 'load a sample route',
        'status.computing': 'Calculating route …',
        'status.legs.one': '{n} leg · {km} km',
        'status.legs.other': '{n} legs · {km} km',
        'route.notFound': 'No route found',
        'route.fallback': 'Leg {n}: {message} – straight line used',

        'stop.drag': 'Drag to reorder',
        'stop.up': 'Move up',
        'stop.down': 'Move down',
        'stop.remove': 'Remove',
        'segment.mode': 'Mode of transport',
        'segment.vehicle': 'Animated vehicle',
        'segment.auto': 'automatic',

        'mode.car': 'Car',
        'mode.bike': 'Bike',
        'mode.foot': 'Walking',
        'mode.train': 'Train (straight line)',
        'mode.ferry': 'Ferry (straight line)',
        'mode.flight': 'Flight (great circle)',

        'vehicle.car': 'Car',
        'vehicle.camper': 'Camper van',
        'vehicle.moto': 'Motorbike',
        'vehicle.bus': 'Bus',
        'vehicle.bike': 'Bike',
        'vehicle.foot': 'Pedestrian',
        'vehicle.train': 'Train',
        'vehicle.ship': 'Ship',
        'vehicle.plane': 'Plane',
        'vehicle.pin': 'Pin',

        'section.map': 'Map',
        'map.style': 'Map style',
        'map.title': 'Title',
        'map.titlePlaceholder': 'e.g. Road trip 2026',
        'map.showLabels': 'Show place names',
        'map.colorByMode': 'Colour by mode of transport',
        'map.lineColor': 'Route colour',

        'style.liberty': 'Liberty',
        'style.bright': 'Bright',
        'style.positron': 'Positron (light)',
        'style.dark': 'Dark',
        'style.fiord': 'Fiord',
        'style.osm': 'OpenStreetMap (raster)',
        'style.satellite': 'Satellite (Sentinel-2 2016)',

        'format.square': 'Square',
        'format.story': 'Story 9:16',
        'format.landscape': 'Landscape 16:9',
        'format.hd': 'Landscape 16:9',
        'format.a4p': 'A4 portrait, 300 dpi',
        'format.a4l': 'A4 landscape, 300 dpi',
        'format.custom': 'Custom',

        'section.image': 'Image export',
        'image.format': 'Format',
        'image.width': 'Width',
        'image.height': 'Height',
        'image.type': 'File type',
        'image.export': 'Export image',
        'image.exporting': 'Exporting …',
        'image.noRoute': 'No route available.',
        'image.failed': 'Could not create the image.',

        'section.video': 'Animation & video',
        'video.format': 'Format',
        'video.camera': 'Camera',
        'camera.follow': 'Follow vehicle',
        'camera.overview': 'Whole route',
        'video.duration': 'Duration (s)',
        'video.fps': 'FPS',
        'video.type': 'File type',
        'video.preview': '▶ Preview',
        'video.stop': '■ Stop',
        'video.export': 'Export video',
        'video.cancel': 'Cancel',
        'video.foreground': 'Keep this tab in the foreground while exporting.',
        'video.osmHint': 'Video export is not available with the OpenStreetMap (raster) style: '
            + 'the OSM tile usage policy does not allow loading map tiles that nobody is viewing. '
            + 'Please choose another map style, e.g. Liberty or Bright.',
        'video.needTwo': 'A video needs at least two stops.',
        'video.needTwoAnim': 'The animation needs at least two stops.',
        'video.noWebCodecs': 'This browser does not support WebCodecs (VideoEncoder).',
        'video.noCodec': 'This browser cannot encode {type} video at {width}×{height}.',
        'video.done': 'Video exported.',
        'video.aborted': 'Export cancelled.',
        'route.addStopsFirst': 'Please add stops first.',

        'section.share': 'Save & share',
        'share.link': 'Copy link',
        'share.copied': 'Link copied to the clipboard.',
        'share.prompt': 'Copy link:',
        'share.saveJson': 'Save JSON',
        'share.loadJson': 'Load JSON',
        'share.geojson': 'GeoJSON',
        'share.clear': 'Clear route',
        'share.clearConfirm': 'Remove all stops?',
        'share.loaded': 'Route loaded.',
        'share.fileError': 'Could not read the file.',

        'footer.credits': 'Map data © OpenStreetMap contributors · Search: Photon (komoot) · '
            + 'Routing: FOSSGIS OSRM · Maps: OpenFreeMap, EOX ·',
        'footer.licenses': 'Licenses',

        'demo.title': 'Europe trip 2026',
        'demo.stops': ['Hamburg', 'Berlin', 'Prague', 'Vienna', 'Lisbon', 'Sintra'],
    },
};

function readStored() {
    try {
        return localStorage.getItem(STORAGE_KEY);
    } catch {
        return null;
    }
}

function detect() {
    const param = new URLSearchParams(location.search).get('lang');
    const candidates = [param, readStored(), ...(navigator.languages || [navigator.language])];
    for (const c of candidates) {
        const code = String(c || '').toLowerCase().split('-')[0];
        if (MESSAGES[code]) return code;
    }
    return FALLBACK;
}

let current = detect();
const listeners = new Set();

export const getLang = () => current;

export function t(key, params = {}) {
    const msg = MESSAGES[current][key] ?? MESSAGES[FALLBACK][key] ?? key;
    if (typeof msg !== 'string') return msg;
    return msg.replace(/\{(\w+)\}/g, (m, name) => (name in params ? params[name] : m));
}

// Static texts in the DOM: data-i18n (text), data-i18n-placeholder, data-i18n-title, data-i18n-aria-label
export function translateDom(root = document) {
    document.documentElement.lang = current;
    document.title = t('app.title');
    for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
    for (const attr of ['placeholder', 'title', 'aria-label']) {
        for (const el of root.querySelectorAll(`[data-i18n-${attr}]`)) {
            el.setAttribute(attr, t(el.getAttribute(`data-i18n-${attr}`)));
        }
    }
}

export function setLang(lang) {
    if (!MESSAGES[lang] || lang === current) return;
    current = lang;
    try {
        localStorage.setItem(STORAGE_KEY, lang);
    } catch {
        // the choice then only lasts until the next reload
    }
    for (const fn of listeners) fn(lang);
}

export function onLangChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

// Numbers in the format of the selected language
export const formatNumber = (n) => n.toLocaleString(current);
