// Central data model: single source of truth for map, animation and export
// Labels come from js/i18n.js (mode.<id>, vehicle.<id>, format.<id>)

export const MODES = {
    car: { routed: true, color: '#d62828', vehicle: 'car' },
    bike: { routed: true, color: '#2a9d8f', vehicle: 'bike' },
    foot: { routed: true, color: '#6a994e', vehicle: 'foot' },
    train: { routed: false, color: '#7b2cbf', vehicle: 'train' },
    ferry: { routed: false, color: '#0077b6', vehicle: 'ship', dashed: true },
    flight: { routed: false, color: '#f18f01', vehicle: 'plane', dashed: true },
};

// rotate: icon turns with the direction of travel; offset compensates for the emoji's base orientation
export const VEHICLES = {
    car: { emoji: '🚗' },
    camper: { emoji: '🚐' },
    moto: { emoji: '🏍️' },
    bus: { emoji: '🚌' },
    bike: { emoji: '🚲' },
    foot: { emoji: '🚶' },
    train: { emoji: '🚆' },
    ship: { emoji: '⛴️' },
    plane: { emoji: '✈️', rotate: true, offset: -45 },
    pin: { emoji: '📍' },
};

export const IMAGE_PRESETS = {
    square: { width: 1080, height: 1080 },
    story: { width: 1080, height: 1920 },
    landscape: { width: 1920, height: 1080 },
    a4p: { width: 2480, height: 3508 },
    a4l: { width: 3508, height: 2480 },
    custom: {},
};

export const VIDEO_PRESETS = {
    landscape: { width: 1920, height: 1080 },
    hd: { width: 1280, height: 720 },
    square: { width: 1080, height: 1080 },
    story: { width: 1080, height: 1920 },
};

const STORAGE_KEY = 'elcanomaps:state';

export function defaults() {
    return {
        stops: [],
        segments: [],
        style: 'liberty',
        showLabels: true,
        colorByMode: false,
        lineColor: '#d62828',
        title: '',
        image: { preset: 'square', width: 1080, height: 1080, type: 'image/png' },
        video: { preset: 'landscape', camera: 'follow', duration: 12, fps: 30, type: 'mp4' },
    };
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// Turn untrusted input (URL, file, localStorage) into a valid model
export function sanitize(raw) {
    const base = defaults();
    if (!raw || typeof raw !== 'object') return base;
    const s = { ...base, ...raw };
    s.image = { ...base.image, ...(raw.image || {}) };
    s.video = { ...base.video, ...(raw.video || {}) };
    s.stops = (Array.isArray(raw.stops) ? raw.stops : [])
        .filter((p) => p && isNum(p.lng) && isNum(p.lat))
        .map((p) => ({ name: String(p.name ?? '').slice(0, 200), lng: p.lng, lat: p.lat }));
    const segs = Array.isArray(raw.segments) ? raw.segments : [];
    s.segments = [];
    for (let i = 0; i < Math.max(0, s.stops.length - 1); i++) {
        const g = segs[i] || {};
        s.segments.push({
            mode: MODES[g.mode] ? g.mode : 'car',
            vehicle: VEHICLES[g.vehicle] ? g.vehicle : null,
        });
    }
    if (typeof s.style !== 'string') s.style = base.style;
    s.title = String(s.title ?? '').slice(0, 200);
    return s;
}

export function vehicleOf(segment) {
    return segment.vehicle || MODES[segment.mode].vehicle;
}

// --- Serialization (base64url, unicode-safe) ---

function encode(obj) {
    const bytes = new TextEncoder().encode(JSON.stringify(obj));
    let bin = '';
    for (const b of bytes) bin += String.fromCharCode(b);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decode(str) {
    const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
}

export function shareUrl(s) {
    return `${location.origin}${location.pathname}#r=${encode(s)}`;
}

function loadInitial() {
    const m = location.hash.match(/^#r=(.+)$/);
    if (m) {
        try {
            return sanitize(decode(m[1]));
        } catch (e) {
            console.warn('Invalid state in link', e);
        }
    }
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) return sanitize(JSON.parse(stored));
    } catch (e) {
        console.warn('localStorage not available', e);
    }
    return defaults();
}

// --- Store ---

export const state = loadInitial();
const listeners = new Set();

function persist() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
        // private mode or similar: state is kept in memory only
    }
    history.replaceState(null, '', `#r=${encode(state)}`);
}

export function update(fn) {
    fn(state);
    persist();
    for (const l of listeners) l(state);
}

export function replace(next) {
    update((s) => {
        for (const k of Object.keys(s)) delete s[k];
        Object.assign(s, sanitize(next));
    });
}

export function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

// --- Operations on stops and legs ---

export function addStop(stop) {
    update((s) => {
        s.stops.push(stop);
        if (s.stops.length > 1) {
            const last = s.segments[s.segments.length - 1];
            s.segments.push({ mode: last ? last.mode : 'car', vehicle: null });
        }
    });
}

export function removeStop(i) {
    update((s) => {
        s.stops.splice(i, 1);
        if (s.segments.length) s.segments.splice(i === 0 ? 0 : i - 1, 1);
    });
}

export function moveStop(from, to) {
    if (from === to) return;
    update((s) => {
        const [stop] = s.stops.splice(from, 1);
        s.stops.splice(to, 0, stop);
    });
}

export function setSegment(i, patch) {
    update((s) => Object.assign(s.segments[i], patch));
}
