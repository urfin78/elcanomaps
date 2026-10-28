// Map styles, custom layers (route, stops, vehicle) and offscreen maps for export

import { MODES, VEHICLES } from './state.js';
import { sliceLine } from './geo.js';
import { getLang } from './i18n.js';

const OSM = '© OpenStreetMap contributors';
const OFM = `© OpenFreeMap © OpenMapTiles ${OSM}`;
const GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf';
const FONT = ['Noto Sans Bold'];
const EOX = 'EOxCloudless – https://cloudless.eox.at by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016)';
// Required attribution of services without their own map source (FOSSGIS terms of use, OSM tile usage policy)
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

// Style labels come from js/i18n.js (style.<id>)
export const STYLES = {
    liberty: { style: 'https://tiles.openfreemap.org/styles/liberty', attribution: OFM },
    bright: { style: 'https://tiles.openfreemap.org/styles/bright', attribution: OFM },
    positron: { style: 'https://tiles.openfreemap.org/styles/positron', attribution: OFM },
    dark: { style: 'https://tiles.openfreemap.org/styles/dark', attribution: OFM },
    fiord: { style: 'https://tiles.openfreemap.org/styles/fiord', attribution: OFM },
    osm: {
        style: rasterStyle('https://tile.openstreetmap.org/{z}/{x}/{y}.png', OSM, 19),
        attribution: OSM,
        // Tile usage policy: don't load tiles nobody is viewing (camera movement in video export)
        noVideo: true,
    },
    satellite: {
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

// --- Place names of the base map in the selected language ---

const OVERLAY_SOURCES = new Set(['route', 'progress', 'stops', 'vehicle']);

// Vector tiles (OpenMapTiles schema) contain name:<lang>; otherwise the styles show name_en.
// The original expression is kept as fallback (e.g. latin + non-latin).
export function localizeLabels(map, lang = getLang()) {
    if (!map._labelFields) {
        map._labelFields = new Map();
        for (const layer of map.getStyle()?.layers || []) {
            const field = layer.layout?.['text-field'];
            if (layer.type !== 'symbol' || !field || OVERLAY_SOURCES.has(layer.source)) continue;
            if (/["{]name/.test(JSON.stringify(field))) map._labelFields.set(layer.id, field);
        }
    }
    for (const [id, field] of map._labelFields) {
        const fallback = Array.isArray(field) ? field : ['get', 'name'];
        map.setLayoutProperty(id, 'text-field', ['coalesce', ['get', `name:${lang}`], fallback]);
    }
}

// --- Vehicle icons: emoji in a round badge ---

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

// --- Custom layers ---

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
                // Always visible, but pushes aside overlapping labels of the base map
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
            // Take the position from the route (possibly shifted across the antimeridian) if up to date
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

// Sync map layers with the state and the computed route
export function syncMap(map, state, route) {
    map._elcano = { state, route };
    if (!map.getSource('route')) return;
    setData(map, 'route', route ? routeFeatures(route, state) : EMPTY);
    setData(map, 'stops', stopFeatures(state, route));
    map.setLayoutProperty('stops-label', 'visibility', state.showLabels ? 'visible' : 'none');
}

// Animation state: route dimmed, travelled part solid, vehicle at its position
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
        // New style: collect and localize the labels again
        map._labelFields = null;
        localizeLabels(map);
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

// Choose the logical size so the map looks about as detailed as on screen
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

// Wait until all tiles/data are loaded and rendered (with timeout)
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
