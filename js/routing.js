// Place search (Photon) and routing (FOSSGIS OSRM) or great circle for legs that can't be routed

import { MODES, vehicleOf } from './state.js';
import { greatCircle, cumulative, bbox } from './geo.js';
import { t, getLang } from './i18n.js';

const PHOTON_URL = 'https://photon.komoot.io/api/';
// Languages supported by the public Photon server; otherwise names in the local language
const PHOTON_LANGS = new Set(['de', 'en', 'fr']);
const OSRM_URL = 'https://routing.openstreetmap.de';
const OSRM_PROFILES = { car: 'routed-car', bike: 'routed-bike', foot: 'routed-foot' };

export async function searchPlaces(query, { signal, near, zoom } = {}) {
    const lang = PHOTON_LANGS.has(getLang()) ? getLang() : 'default';
    const params = new URLSearchParams({ q: query, limit: '6', lang });
    if (near) {
        params.set('lon', near[0].toFixed(3));
        params.set('lat', near[1].toFixed(3));
        // Without zoom Photon assumes 16 (street level) and prefers nearby streets over cities
        params.set('zoom', String(Math.round(zoom ?? 4)));
    }
    const res = await fetch(`${PHOTON_URL}?${params}`, { signal });
    if (!res.ok) throw new Error(t('search.failed', { status: res.status }));
    const json = await res.json();
    const results = json.features.map((f) => {
        const p = f.properties;
        const parts = [p.name, p.city !== p.name ? p.city : null, p.state, p.country];
        return {
            name: p.name || p.city || p.country || t('search.place'),
            label: [...new Set(parts.filter(Boolean))].join(', '),
            lng: f.geometry.coordinates[0],
            lat: f.geometry.coordinates[1],
        };
    });
    // Show results with the same label (e.g. street and bus stop) only once
    return results.filter((r, i) => results.findIndex((o) => o.label === r.label) === i);
}

// Cache promises so identical requests don't run twice
const cache = new Map();

// FOSSGIS terms of use: at most one routing request per second
const MIN_INTERVAL = 1000;
let nextSlot = 0;

function throttle() {
    const now = Date.now();
    const wait = Math.max(0, nextSlot - now);
    nextSlot = Math.max(now, nextSlot) + MIN_INTERVAL;
    return new Promise((resolve) => setTimeout(resolve, wait));
}

function fetchRoute(mode, a, b) {
    const key = `${mode}:${a.join(',')}:${b.join(',')}`;
    if (!cache.has(key)) {
        const coords = `${a[0]},${a[1]};${b[0]},${b[1]}`;
        const url = `${OSRM_URL}/${OSRM_PROFILES[mode]}/route/v1/driving/${coords}?overview=full&geometries=geojson`;
        const p = throttle()
            .then(() => fetch(url))
            .then((res) => res.json())
            .then((json) => {
                if (json.code !== 'Ok' || !json.routes?.length) {
                    throw new Error(json.message || t('route.notFound'));
                }
                return json.routes[0].geometry.coordinates;
            });
        p.catch(() => cache.delete(key));
        cache.set(key, p);
    }
    return cache.get(key);
}

// Compute the geometry of all legs; errors fall back to a straight line
export async function buildRoute(state) {
    const segments = [];
    const errors = [];
    let prevEnd = null;
    // Stop positions matching the line (possibly shifted across the antimeridian)
    const stops = state.stops.slice(0, 1).map((p) => [p.lng, p.lat]);
    for (let i = 0; i < state.segments.length; i++) {
        const seg = state.segments[i];
        const a = [state.stops[i].lng, state.stops[i].lat];
        const b = [state.stops[i + 1].lng, state.stops[i + 1].lat];
        let coords;
        if (MODES[seg.mode].routed) {
            try {
                coords = await fetchRoute(seg.mode, a, b);
            } catch (e) {
                errors.push(t('route.fallback', { n: i + 1, message: e.message }));
                coords = greatCircle(a, b);
            }
        } else {
            coords = greatCircle(a, b);
        }
        // Connect to the end of the previous leg (antimeridian)
        if (prevEnd) {
            const shift = Math.round((prevEnd[0] - coords[0][0]) / 360) * 360;
            if (shift) coords = coords.map(([x, y]) => [x + shift, y]);
        }
        prevEnd = coords[coords.length - 1];
        stops.push([b[0] + Math.round((prevEnd[0] - b[0]) / 360) * 360, b[1]]);
        const cum = cumulative(coords);
        segments.push({
            coords,
            cum,
            length: cum[cum.length - 1],
            bbox: bbox(coords),
            mode: seg.mode,
            vehicle: vehicleOf(seg),
        });
    }
    const all = [...stops, ...segments.flatMap((s) => s.coords)];
    return {
        segments,
        stops,
        errors,
        bbox: all.length ? bbox(all) : null,
        length: segments.reduce((sum, s) => sum + s.length, 0),
    };
}
