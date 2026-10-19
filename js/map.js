// Kartenstile, eigene Layer (Route, Stopps, Fahrzeug) und Offscreen-Karten für den Export

import { MODES, VEHICLES } from './state.js';
import { sliceLine } from './geo.js';

const OSM = '© OpenStreetMap contributors';
const OFM = `© OpenFreeMap © OpenMapTiles ${OSM}`;
const GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
const FONT = ['Noto Sans Bold'];
const EOX = 'EOxCloudless – https://cloudless.eox.at by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016)';
// Pflichtangaben der Dienste ohne eigene Kartenquelle (FOSSGIS-Nutzungsbedingungen, OSM Tile Usage Policy)
const LINK = (href, text) => `<a href="${href}" target="_blank" rel="noopener">${text}</a>`;
const SERVICE_ATTRIBUTION = [
    LINK('https://routing.openstreetmap.de/about.html', 'Routing: FOSSGIS OSRM'),
    LINK('https://www.openstreetmap.org/fixthemap', 'Fix the map'),
];

function rasterStyle(tiles, attribution, maxzoom) {
    return {
        version: 8,
        glyphs: GLYPHS,
        sources: { base: { type: 'raster', tiles: [tiles], tileSize: 256, maxzoom, attribution } },
        layers: [{ id: 'base', type: 'raster', source: 'base' }],
    };
}

export const STYLES = {
    liberty: { label: 'Liberty', style: 'https://tiles.openfreemap.org/styles/liberty', attribution: OFM },
    bright: { label: 'Bright', style: 'https://tiles.openfreemap.org/styles/bright', attribution: OFM },
    positron: { label: 'Positron (hell)', style: 'https://tiles.openfreemap.org/styles/positron', attribution: OFM },
    dark: { label: 'Dark', style: 'https://tiles.openfreemap.org/styles/dark', attribution: OFM },
    fiord: { label: 'Fiord', style: 'https://tiles.openfreemap.org/styles/fiord', attribution: OFM },
    osm: {
        label: 'OpenStreetMap (Raster)',
        style: rasterStyle('https://tile.openstreetmap.org/{z}/{x}/{y}.png', OSM, 19),
        attribution: OSM,
        // Tile Usage Policy: keine Kacheln laden, die niemand ansieht (Kamerafahrt im Video-Export)
        noVideo: true,
    },
    satellite: {
        label: 'Satellit (Sentinel-2 2016)',
        style: rasterStyle(
            'https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg',
            EOX,
            15,
        ),
        attribution: EOX,
    },
};

const styleEntry = (id) => STYLES[id] || STYLES.liberty;
export const attributionFor = (id) => styleEntry(id).attribution;
export const videoAllowed = (id) => !styleEntry(id).noVideo;

// --- Fahrzeug-Icons: Emoji in einem runden Badge ---

function vehicleImage(id) {
    const size = 72;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#1d3557';
    ctx.stroke();
    ctx.font = `${size * 0.5}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(VEHICLES[id]?.emoji ?? '●', size / 2, size / 2 + 2);
    return ctx.getImageData(0, 0, size, size);
}

// --- Eigene Layer ---

const EMPTY = { type: 'FeatureCollection', features: [] };

function lineLayers(prefix, source) {
    const layout = { 'line-join': 'round', 'line-cap': 'round' };
    return [
        {
            id: `${prefix}-casing`, type: 'line', source, layout,
            filter: ['!', ['get', 'dashed']],
            paint: { 'line-color': '#ffffff', 'line-width': 8 },
        },
        {
            id: `${prefix}-line`, type: 'line', source, layout,
            filter: ['!', ['get', 'dashed']],
            paint: { 'line-color': ['get', 'color'], 'line-width': 4.5 },
        },
        {
            id: `${prefix}-dashed`, type: 'line', source,
            layout: { 'line-join': 'round', 'line-cap': 'butt' },
            filter: ['get', 'dashed'],
            paint: { 'line-color': ['get', 'color'], 'line-width': 4, 'line-dasharray': [2, 1.5] },
        },
    ];
}

function addOverlayLayers(map) {
    if (map.getSource('route')) return;
    for (const id of ['route', 'progress', 'stops', 'vehicle']) {
        map.addSource(id, { type: 'geojson', data: EMPTY });
    }
    const layers = [
        ...lineLayers('route', 'route'),
        ...lineLayers('progress', 'progress'),
        {
            id: 'stops-circle', type: 'circle', source: 'stops',
            paint: {
                'circle-radius': 10,
                'circle-color': '#1d3557',
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 2.5,
            },
        },
        {
            id: 'stops-number', type: 'symbol', source: 'stops',
            layout: {
                'text-field': ['get', 'num'],
                'text-font': FONT,
                'text-size': 11,
                // Immer sichtbar, verdrängt aber überlappende Labels der Grundkarte
                'text-allow-overlap': true,
                'text-padding': 8,
            },
            paint: { 'text-color': '#ffffff' },
        },
        {
            id: 'stops-label', type: 'symbol', source: 'stops',
            layout: {
                'text-field': ['get', 'name'],
                'text-font': FONT,
                'text-size': 14,
                'text-anchor': 'top',
                'text-offset': [0, 1.1],
                'text-max-width': 10,
            },
            paint: { 'text-color': '#1d3557', 'text-halo-color': '#ffffff', 'text-halo-width': 2 },
        },
        {
            id: 'vehicle', type: 'symbol', source: 'vehicle',
            layout: {
                'icon-image': ['get', 'icon'],
                'icon-rotate': ['get', 'rotate'],
                'icon-rotation-alignment': 'map',
                'icon-allow-overlap': true,
            },
        },
    ];
    for (const layer of layers) map.addLayer(layer);
}

function routeFeatures(route, state, lengths) {
    return {
        type: 'FeatureCollection',
        features: route.segments.map((seg, i) => {
            const mode = MODES[seg.mode];
            let coords = seg.coords;
            if (lengths) {
                if (lengths[i] <= 0) return null;
                coords = sliceLine(seg.coords, seg.cum, lengths[i]);
            }
            return {
                type: 'Feature',
                properties: { color: state.colorByMode ? mode.color : state.lineColor, dashed: !!mode.dashed },
                geometry: { type: 'LineString', coordinates: coords },
            };
        }).filter(Boolean),
    };
}

function stopFeatures(state, route) {
    return {
        type: 'FeatureCollection',
        features: state.stops.map((p, i) => {
            // Position aus der Route übernehmen (evtl. über die Datumsgrenze verschoben), falls aktuell
            const r = route?.stops[i];
            const coords = r && r[1] === p.lat && (r[0] - p.lng) % 360 === 0 ? r : [p.lng, p.lat];
            return {
                type: 'Feature',
                properties: { num: String(i + 1), name: p.name },
                geometry: { type: 'Point', coordinates: coords },
            };
        }),
    };
}

function setData(map, id, data) {
    map.getSource(id)?.setData(data);
}

// Kartenlayer mit Zustand und berechneter Route abgleichen
export function syncMap(map, state, route) {
    map._elcano = { state, route };
    if (!map.getSource('route')) return;
    setData(map, 'route', route ? routeFeatures(route, state) : EMPTY);
    setData(map, 'stops', stopFeatures(state, route));
    map.setLayoutProperty('stops-label', 'visibility', state.showLabels ? 'visible' : 'none');
}

// Animationszustand: Route gedimmt, gefahrener Teil voll, Fahrzeug an Position
export function setAnimationFrame(map, frame) {
    const { state, route } = map._elcano || {};
    if (!map.getSource('route') || !route) return;
    const dim = frame ? 0.3 : 1;
    for (const id of ['route-casing', 'route-line', 'route-dashed']) {
        map.setPaintProperty(id, 'line-opacity', dim);
    }
    if (!frame) {
        setData(map, 'progress', EMPTY);
        setData(map, 'vehicle', EMPTY);
        return;
    }
    const lengths = route.segments.map((seg, i) => {
        if (i < frame.index) return seg.length;
        if (i === frame.index) return frame.distance;
        return 0;
    });
    setData(map, 'progress', routeFeatures(route, state, lengths));
    const v = VEHICLES[frame.vehicle] || VEHICLES.pin;
    setData(map, 'vehicle', {
        type: 'Feature',
        properties: { icon: `veh-${frame.vehicle}`, rotate: v.rotate ? frame.bearing + v.offset : 0 },
        geometry: { type: 'Point', coordinates: frame.point },
    });
}

function registerHandlers(map) {
    map.on('styleimagemissing', (e) => {
        if (e.id.startsWith('veh-') && !map.hasImage(e.id)) {
            map.addImage(e.id, vehicleImage(e.id.slice(4)), { pixelRatio: 2 });
        }
    });
    map.on('style.load', () => {
        addOverlayLayers(map);
        if (map._elcano) syncMap(map, map._elcano.state, map._elcano.route);
    });
}

export function createMap(container, state) {
    const map = new maplibregl.Map({
        container,
        style: styleEntry(state.style).style,
        center: [10, 50],
        zoom: 3.5,
        attributionControl: { compact: false, customAttribution: SERVICE_ATTRIBUTION },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map._elcano = { state, route: null };
    registerHandlers(map);
    return map;
}

export function setMapStyle(map, id) {
    map.setStyle(styleEntry(id).style, { diff: false });
}

// Logische Größe so wählen, dass die Karte ähnlich detailliert wirkt wie am Bildschirm
const LOGICAL_MAX = 1280;

export async function createOffscreenMap(state, route, width, height) {
    const scale = Math.max(1, Math.max(width, height) / LOGICAL_MAX);
    const lw = Math.round(width / scale);
    const lh = Math.round(height / scale);
    const el = document.createElement('div');
    el.style.cssText = `position:fixed;left:-30000px;top:0;width:${lw}px;height:${lh}px;`;
    document.body.append(el);
    const map = new maplibregl.Map({
        container: el,
        style: styleEntry(state.style).style,
        interactive: false,
        attributionControl: false,
        pixelRatio: width / lw,
        fadeDuration: 0,
        maxCanvasSize: [8192, 8192],
        canvasContextAttributes: { preserveDrawingBuffer: true, antialias: true },
    });
    map._elcano = { state, route };
    registerHandlers(map);
    await new Promise((resolve) => map.once('load', resolve));
    syncMap(map, state, route);
    return {
        map,
        width: lw,
        height: lh,
        destroy() {
            map.remove();
            el.remove();
        },
    };
}

// Warten bis alle Kacheln/Daten geladen und gerendert sind (mit Zeitlimit)
export function waitIdle(map, timeout = 20000) {
    return new Promise((resolve) => {
        let done = false;
        const finish = () => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            resolve();
        };
        const timer = setTimeout(finish, timeout);
        map.once('idle', finish);
        map.triggerRepaint();
    });
}
