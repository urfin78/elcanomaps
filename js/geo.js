// Geometrie-Hilfsfunktionen (Koordinaten immer als [lng, lat], Distanzen in km)

const EARTH_RADIUS_KM = 6371.0088;
const toRad = (d) => d * Math.PI / 180;
const toDeg = (r) => r * 180 / Math.PI;

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeInOut = (t) => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

export function haversine(a, b) {
    const dLat = toRad(b[1] - a[1]);
    const dLng = toRad(b[0] - a[0]);
    const h = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Kompassrichtung von a nach b in Grad (0 = Norden, im Uhrzeigersinn)
export function bearing(a, b) {
    const φ1 = toRad(a[1]);
    const φ2 = toRad(b[1]);
    const Δλ = toRad(b[0] - a[0]);
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Längengrade stetig machen, damit Linien über den 180. Meridian nicht springen
export function unwrap(coords) {
    const out = [coords[0].slice()];
    for (let i = 1; i < coords.length; i++) {
        let lng = coords[i][0];
        const prev = out[i - 1][0];
        while (lng - prev > 180) lng -= 360;
        while (lng - prev < -180) lng += 360;
        out.push([lng, coords[i][1]]);
    }
    return out;
}

// Großkreis zwischen a und b, Punktdichte abhängig von der Distanz
export function greatCircle(a, b) {
    const φ1 = toRad(a[1]), λ1 = toRad(a[0]);
    const φ2 = toRad(b[1]), λ2 = toRad(b[0]);
    const d = haversine(a, b) / EARTH_RADIUS_KM;
    if (d < 1e-6) return [a.slice(), b.slice()];
    const n = clamp(Math.ceil(d * EARTH_RADIUS_KM / 25), 2, 512);
    const coords = [];
    for (let i = 0; i <= n; i++) {
        const f = i / n;
        const A = Math.sin((1 - f) * d) / Math.sin(d);
        const B = Math.sin(f * d) / Math.sin(d);
        const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
        const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
        const z = A * Math.sin(φ1) + B * Math.sin(φ2);
        coords.push([toDeg(Math.atan2(y, x)), toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)))]);
    }
    return unwrap(coords);
}

// Kumulierte Distanzen je Stützpunkt
export function cumulative(coords) {
    const cum = [0];
    for (let i = 1; i < coords.length; i++) {
        cum.push(cum[i - 1] + haversine(coords[i - 1], coords[i]));
    }
    return cum;
}

function indexAt(cum, d) {
    let lo = 0, hi = cum.length - 1;
    while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] <= d) lo = mid; else hi = mid;
    }
    return lo;
}

// Punkt und Fahrtrichtung bei Distanz d entlang der Linie
export function pointAlong(coords, cum, d) {
    if (coords.length < 2) return { point: coords[0], bearing: 0 };
    const total = cum[cum.length - 1];
    d = clamp(d, 0, total);
    const i = Math.min(indexAt(cum, d), coords.length - 2);
    const segLen = cum[i + 1] - cum[i];
    const f = segLen > 0 ? (d - cum[i]) / segLen : 0;
    const a = coords[i], b = coords[i + 1];
    return {
        point: [lerp(a[0], b[0], f), lerp(a[1], b[1], f)],
        bearing: bearing(a, b),
        index: i,
    };
}

// Teilstück der Linie vom Anfang bis Distanz d
export function sliceLine(coords, cum, d) {
    const { point, index } = pointAlong(coords, cum, d);
    if (index === undefined) return coords.slice();
    return [...coords.slice(0, index + 1), point];
}

export function bbox(coords) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of coords) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
    }
    return [[minX, minY], [maxX, maxY]];
}
