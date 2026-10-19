// Zeitleiste und Kameraführung der Routenanimation (deterministisch: Zeit -> Bild)

import { pointAlong, easeInOut, clamp, lerp } from './geo.js';

const FOLLOW_MAX_ZOOM = 12;
const OVERVIEW_MAX_ZOOM = 11;

export function buildTimeline(route, duration) {
    // Lange Abschnitte dauern länger, aber gedämpft (sonst dominieren Flüge)
    const weights = route.segments.map((s) => Math.sqrt(Math.max(s.length, 0.01)));
    const total = weights.reduce((a, b) => a + b, 0) || 1;
    const intro = Math.min(1.5, duration * 0.12);
    const outro = Math.min(2, duration * 0.15);
    const travel = duration - intro - outro;
    let t = intro;
    const spans = weights.map((w) => {
        const span = { start: t, end: t + travel * w / total };
        t = span.end;
        return span;
    });
    return { route, duration, intro, outro, travelEnd: intro + travel, spans };
}

export function vehicleAt(tl, time) {
    const { spans, route } = tl;
    let i = spans.findIndex((s) => time < s.end);
    if (i === -1) i = spans.length - 1;
    const span = spans[i];
    const seg = route.segments[i];
    const f = clamp((time - span.start) / (span.end - span.start), 0, 1);
    const distance = easeInOut(f) * seg.length;
    const { point, bearing } = pointAlong(seg.coords, seg.cum, distance);
    return { index: i, distance, point, bearing, vehicle: seg.vehicle };
}

function toCamera(c) {
    return { center: [c.center.lng, c.center.lat], zoom: c.zoom };
}

// Kameraparameter hängen von der Kartengröße ab, daher pro Karte berechnen
export function cameraPlan(map, tl, mode, topPadding = 0) {
    const { width, height } = map.getContainer().getBoundingClientRect();
    const pad = Math.round(Math.min(width, height) * 0.1);
    const padding = { top: pad + topPadding, bottom: pad, left: pad, right: pad };
    const overview = toCamera(map.cameraForBounds(tl.route.bbox, { padding, maxZoom: OVERVIEW_MAX_ZOOM }));
    const zooms = tl.route.segments.map((s) =>
        map.cameraForBounds(s.bbox, { padding, maxZoom: FOLLOW_MAX_ZOOM }).zoom);
    return { mode, overview, zooms, mids: tl.spans.map((s) => (s.start + s.end) / 2) };
}

function zoomAt(plan, time) {
    const { mids, zooms } = plan;
    if (time <= mids[0]) return zooms[0];
    for (let i = 1; i < mids.length; i++) {
        if (time <= mids[i]) {
            const f = (time - mids[i - 1]) / (mids[i] - mids[i - 1]);
            return lerp(zooms[i - 1], zooms[i], easeInOut(f));
        }
    }
    return zooms[zooms.length - 1];
}

function mix(a, b, k) {
    return {
        center: [lerp(a.center[0], b.center[0], k), lerp(a.center[1], b.center[1], k)],
        zoom: lerp(a.zoom, b.zoom, k),
    };
}

export function cameraAt(plan, tl, time) {
    if (plan.mode === 'overview') return plan.overview;
    const follow = (t) => ({ center: vehicleAt(tl, t).point, zoom: zoomAt(plan, t) });
    if (time < tl.intro) {
        return mix(plan.overview, follow(tl.intro), easeInOut(time / tl.intro));
    }
    if (time > tl.travelEnd) {
        return mix(follow(tl.travelEnd), plan.overview, easeInOut((time - tl.travelEnd) / tl.outro));
    }
    return follow(time);
}

export function frameAt(tl, time) {
    const t = clamp(time, tl.intro, tl.travelEnd);
    return vehicleAt(tl, t);
}
