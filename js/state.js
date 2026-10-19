// Zentrales Datenmodell: einzige Quelle der Wahrheit für Karte, Animation und Export

export const MODES = {
    car: { label: 'Auto', routed: true, color: '#d62828', vehicle: 'car' },
    bike: { label: 'Fahrrad', routed: true, color: '#2a9d8f', vehicle: 'bike' },
    foot: { label: 'Zu Fuß', routed: true, color: '#6a994e', vehicle: 'foot' },
    train: { label: 'Zug (Luftlinie)', routed: false, color: '#7b2cbf', vehicle: 'train' },
    ferry: { label: 'Fähre (Luftlinie)', routed: false, color: '#0077b6', vehicle: 'ship', dashed: true },
    flight: { label: 'Flug (Großkreis)', routed: false, color: '#f18f01', vehicle: 'plane', dashed: true },
};

// rotate: Icon dreht sich mit der Fahrtrichtung, offset gleicht die Grundausrichtung des Emojis aus
export const VEHICLES = {
    car: { label: 'Auto', emoji: '🚗' },
    camper: { label: 'Wohnmobil', emoji: '🚐' },
    moto: { label: 'Motorrad', emoji: '🏍️' },
    bus: { label: 'Bus', emoji: '🚌' },
    bike: { label: 'Fahrrad', emoji: '🚲' },
    foot: { label: 'Fußgänger', emoji: '🚶' },
    train: { label: 'Zug', emoji: '🚆' },
    ship: { label: 'Schiff', emoji: '⛴️' },
    plane: { label: 'Flugzeug', emoji: '✈️', rotate: true, offset: -45 },
    pin: { label: 'Punkt', emoji: '📍' },
};

export const IMAGE_PRESETS = {
    square: { label: 'Quadrat (1080×1080)', width: 1080, height: 1080 },
    story: { label: 'Story 9:16 (1080×1920)', width: 1080, height: 1920 },
    landscape: { label: 'Querformat 16:9 (1920×1080)', width: 1920, height: 1080 },
    a4p: { label: 'A4 hoch, 300 dpi (2480×3508)', width: 2480, height: 3508 },
    a4l: { label: 'A4 quer, 300 dpi (3508×2480)', width: 3508, height: 2480 },
    custom: { label: 'Benutzerdefiniert' },
};

export const VIDEO_PRESETS = {
    landscape: { label: 'Querformat 16:9 (1920×1080)', width: 1920, height: 1080 },
    hd: { label: 'Querformat 16:9 (1280×720)', width: 1280, height: 720 },
    square: { label: 'Quadrat (1080×1080)', width: 1080, height: 1080 },
    story: { label: 'Story 9:16 (1080×1920)', width: 1080, height: 1920 },
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

// Unbekannte Eingaben (URL, Datei, localStorage) auf ein gültiges Modell zurückführen
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

// --- Serialisierung (base64url, unicode-sicher) ---

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
            console.warn('Ungültiger Link-Zustand', e);
        }
    }
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) return sanitize(JSON.parse(stored));
    } catch (e) {
        console.warn('localStorage nicht verfügbar', e);
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
        // privater Modus o. ä.: Zustand bleibt nur im Speicher
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

// --- Operationen auf Stopps und Abschnitten ---

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
