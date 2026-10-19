// UI-Verdrahtung: Sidebar <-> Datenmodell <-> Karte

import {
    state, update, replace, subscribe, shareUrl,
    addStop, removeStop, moveStop, setSegment,
    MODES, VEHICLES, IMAGE_PRESETS, VIDEO_PRESETS,
} from './state.js';
import { createMap, setMapStyle, syncMap, setAnimationFrame, videoAllowed, STYLES } from './map.js';
import { searchPlaces, buildRoute } from './routing.js';
import { buildTimeline, cameraPlan, cameraAt, frameAt } from './animation.js';
import { renderImage, renderVideo, download, OSM_VIDEO_HINT } from './export.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const options = (entries, selected) => entries
    .map(([value, label]) => `<option value="${esc(value)}"${value === selected ? ' selected' : ''}>${esc(label)}</option>`)
    .join('');

const DEMO = {
    stops: [
        { name: 'Hamburg', lng: 9.9937, lat: 53.5511 },
        { name: 'Berlin', lng: 13.405, lat: 52.52 },
        { name: 'Prag', lng: 14.4378, lat: 50.0755 },
        { name: 'Wien', lng: 16.3738, lat: 48.2082 },
        { name: 'Lissabon', lng: -9.1393, lat: 38.7223 },
        { name: 'Sintra', lng: -9.3817, lat: 38.8029 },
    ],
    segments: [
        { mode: 'train' },
        { mode: 'car' },
        { mode: 'car' },
        { mode: 'flight' },
        { mode: 'bike' },
    ],
    title: 'Europa-Reise 2026',
};

const map = createMap('map', state);

// --- Toast ---

let toastTimer;
function toast(msg) {
    const el = $('toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 4000);
}

// --- Route berechnen ---

let route = null;
let routeKey = '';
let stopsKey = '';
let generation = 0;

async function refreshRoute() {
    const key = JSON.stringify([state.stops, state.segments]);
    if (key === routeKey) {
        syncMap(map, state, route);
        return;
    }
    routeKey = key;
    const newStopsKey = JSON.stringify(state.stops.map((p) => [p.lng, p.lat]));
    const fit = newStopsKey !== stopsKey;
    stopsKey = newStopsKey;
    const my = ++generation;
    stopPreview();
    syncMap(map, state, route);
    $('route-status').textContent = state.segments.length ? 'Berechne Route …' : '';
    const next = await buildRoute(state);
    if (my !== generation) return;
    route = next;
    syncMap(map, state, route);
    if (route.segments.length) {
        const km = Math.round(route.length).toLocaleString('de-DE');
        const n = route.segments.length;
        $('route-status').textContent = [`${n} Abschnitt${n > 1 ? 'e' : ''} · ${km} km`, ...route.errors].join('\n');
    } else {
        $('route-status').textContent = '';
    }
    if (fit && route.bbox) {
        map.fitBounds(route.bbox, { padding: 60, maxZoom: 11, duration: 800 });
    }
}

// --- Stopps-Liste ---

function segmentHtml(i) {
    const seg = state.segments[i];
    const auto = VEHICLES[MODES[seg.mode].vehicle];
    const vehicles = Object.entries(VEHICLES).map(([k, v]) => [k, `${v.emoji} ${v.label}`]);
    return `<div class="segment" data-segment="${i}">
        <select data-field="mode" aria-label="Verkehrsmittel">${options(Object.entries(MODES).map(([k, m]) => [k, m.label]), seg.mode)}</select>
        <select data-field="vehicle" aria-label="Animationsfahrzeug">${options([['', `${auto.emoji} automatisch`], ...vehicles], seg.vehicle || '')}</select>
    </div>`;
}

function renderStops() {
    const last = state.stops.length - 1;
    $('stops').innerHTML = state.stops.map((p, i) => `${i > 0 ? segmentHtml(i - 1) : ''}
        <div class="stop" draggable="true" data-index="${i}">
            <span class="handle" title="Ziehen zum Sortieren">⋮⋮</span>
            <span class="num">${i + 1}</span>
            <span class="name" title="${esc(p.name)}">${esc(p.name)}</span>
            <button type="button" data-action="up" title="Nach oben"${i === 0 ? ' disabled' : ''}>↑</button>
            <button type="button" data-action="down" title="Nach unten"${i === last ? ' disabled' : ''}>↓</button>
            <button type="button" data-action="remove" title="Entfernen">✕</button>
        </div>`).join('');
    $('empty-hint').hidden = state.stops.length > 0;
}

$('stops').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const i = Number(btn.closest('.stop').dataset.index);
    if (btn.dataset.action === 'up') moveStop(i, i - 1);
    if (btn.dataset.action === 'down') moveStop(i, i + 1);
    if (btn.dataset.action === 'remove') removeStop(i);
});

$('stops').addEventListener('change', (e) => {
    const field = e.target.dataset.field;
    if (!field) return;
    const i = Number(e.target.closest('.segment').dataset.segment);
    setSegment(i, { [field]: e.target.value || null });
});

let dragFrom = null;
$('stops').addEventListener('dragstart', (e) => {
    const el = e.target.closest('.stop');
    if (!el) return;
    dragFrom = Number(el.dataset.index);
    el.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
});
$('stops').addEventListener('dragover', (e) => {
    const el = e.target.closest('.stop');
    if (dragFrom === null || !el) return;
    e.preventDefault();
    document.querySelectorAll('.stop.drop-target').forEach((n) => n.classList.remove('drop-target'));
    el.classList.add('drop-target');
});
$('stops').addEventListener('drop', (e) => {
    const el = e.target.closest('.stop');
    if (dragFrom === null || !el) return;
    e.preventDefault();
    moveStop(dragFrom, Number(el.dataset.index));
});
$('stops').addEventListener('dragend', () => {
    dragFrom = null;
    renderStops();
});

// --- Ortssuche ---

const searchInput = $('search');
const resultsEl = $('search-results');
let results = [];
let active = -1;
let searchTimer;
let searchAbort;

function renderResults() {
    resultsEl.innerHTML = results
        .map((r, i) => `<li data-index="${i}"${i === active ? ' class="active"' : ''}>${esc(r.label)}</li>`)
        .join('');
    resultsEl.hidden = results.length === 0;
}

function hideResults() {
    results = [];
    active = -1;
    renderResults();
}

function choose(r) {
    if (!r) return;
    addStop({ name: r.name, lng: r.lng, lat: r.lat });
    searchInput.value = '';
    hideResults();
}

async function runSearch(q) {
    searchAbort?.abort();
    searchAbort = new AbortController();
    try {
        const c = map.getCenter();
        results = await searchPlaces(q, { signal: searchAbort.signal, near: [c.lng, c.lat] });
        active = -1;
        renderResults();
    } catch (e) {
        if (e.name !== 'AbortError') toast(e.message);
    }
}

searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    const q = searchInput.value.trim();
    if (q.length < 3) {
        hideResults();
        return;
    }
    // Debounce: Photon nicht bei jedem Tastendruck anfragen
    searchTimer = setTimeout(() => runSearch(q), 350);
});

searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!results.length) return;
        active = (active + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
        renderResults();
    } else if (e.key === 'Enter') {
        e.preventDefault();
        choose(results[Math.max(active, 0)]);
    } else if (e.key === 'Escape') {
        hideResults();
    }
});

// mousedown statt click, damit der Blur des Eingabefelds nicht zuerst schließt
resultsEl.addEventListener('mousedown', (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    e.preventDefault();
    choose(results[Number(li.dataset.index)]);
});
searchInput.addEventListener('blur', () => setTimeout(hideResults, 150));

$('demo').addEventListener('click', () => replace({ ...state, ...DEMO }));

// --- Karte & Export-Einstellungen ---

$('vid-style-hint').textContent = OSM_VIDEO_HINT;
$('style').innerHTML = options(Object.entries(STYLES).map(([k, s]) => [k, s.label]), state.style);
$('img-preset').innerHTML = options(Object.entries(IMAGE_PRESETS).map(([k, p]) => [k, p.label]), state.image.preset);
$('vid-preset').innerHTML = options(Object.entries(VIDEO_PRESETS).map(([k, p]) => [k, p.label]), state.video.preset);

// Nur bei Abweichung setzen, sonst springt der Cursor beim Tippen ans Ende
function setValue(id, value) {
    const el = $(id);
    if (el.value !== String(value)) el.value = value;
}

function renderControls() {
    setValue('style', state.style);
    setValue('title', state.title);
    $('show-labels').checked = state.showLabels;
    $('color-by-mode').checked = state.colorByMode;
    setValue('line-color', state.lineColor);
    $('line-color-row').hidden = state.colorByMode;
    setValue('img-preset', state.image.preset);
    setValue('img-width', state.image.width);
    setValue('img-height', state.image.height);
    setValue('img-type', state.image.type);
    setValue('vid-preset', state.video.preset);
    setValue('vid-camera', state.video.camera);
    setValue('vid-duration', state.video.duration);
    setValue('vid-fps', state.video.fps);
    setValue('vid-type', state.video.type);
    // Laufenden Export weiter abbrechbar lassen
    const noVideo = !videoAllowed(state.style);
    $('vid-export').disabled = noVideo && !exportAbort;
    $('vid-style-hint').hidden = !noVideo;
}

function bind(id, event, apply) {
    $(id).addEventListener(event, (e) => update((s) => apply(s, e.target)));
}

bind('style', 'change', (s, t) => { s.style = t.value; });
bind('title', 'input', (s, t) => { s.title = t.value; });
bind('show-labels', 'change', (s, t) => { s.showLabels = t.checked; });
bind('color-by-mode', 'change', (s, t) => { s.colorByMode = t.checked; });
bind('line-color', 'input', (s, t) => { s.lineColor = t.value; });
bind('img-preset', 'change', (s, t) => {
    s.image.preset = t.value;
    const p = IMAGE_PRESETS[t.value];
    if (p.width) Object.assign(s.image, { width: p.width, height: p.height });
});
const clampSize = (v) => Math.min(8000, Math.max(100, Math.round(Number(v) || 0)));
bind('img-width', 'change', (s, t) => { s.image.width = clampSize(t.value); s.image.preset = 'custom'; });
bind('img-height', 'change', (s, t) => { s.image.height = clampSize(t.value); s.image.preset = 'custom'; });
bind('img-type', 'change', (s, t) => { s.image.type = t.value; });
bind('vid-preset', 'change', (s, t) => { s.video.preset = t.value; });
bind('vid-camera', 'change', (s, t) => { s.video.camera = t.value; });
bind('vid-duration', 'change', (s, t) => { s.video.duration = Math.min(120, Math.max(3, Math.round(Number(t.value) || 12))); });
bind('vid-fps', 'change', (s, t) => { s.video.fps = Number(t.value); });
bind('vid-type', 'change', (s, t) => { s.video.type = t.value; });

// --- Vorschau-Animation auf der Hauptkarte ---

let preview = null;

function stopPreview() {
    if (!preview) return;
    cancelAnimationFrame(preview.raf);
    preview = null;
    setAnimationFrame(map, null);
    $('preview').textContent = '▶ Vorschau';
}

function startPreview() {
    if (!route?.segments.length) {
        toast('Für die Animation werden mindestens zwei Stopps benötigt.');
        return;
    }
    const tl = buildTimeline(route, state.video.duration);
    const plan = cameraPlan(map, tl, state.video.camera);
    const t0 = performance.now();
    const step = (now) => {
        const time = (now - t0) / 1000;
        if (time >= tl.duration) {
            stopPreview();
            return;
        }
        setAnimationFrame(map, frameAt(tl, time));
        map.jumpTo(cameraAt(plan, tl, time));
        preview.raf = requestAnimationFrame(step);
    };
    preview = { raf: requestAnimationFrame(step) };
    $('preview').textContent = '■ Stopp';
}

$('preview').addEventListener('click', () => (preview ? stopPreview() : startPreview()));

// --- Export ---

function fileBase() {
    const slug = state.title.toLowerCase().normalize('NFKD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
    return slug || 'elcanomaps-route';
}

$('img-export').addEventListener('click', async () => {
    const btn = $('img-export');
    if (!route?.bbox) {
        toast('Bitte zuerst Stopps hinzufügen.');
        return;
    }
    btn.disabled = true;
    btn.textContent = 'Exportiere …';
    try {
        const blob = await renderImage(structuredClone(state), route, state.image);
        const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[state.image.type];
        download(blob, `${fileBase()}.${ext}`);
    } catch (e) {
        console.error(e);
        toast(e.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Bild exportieren';
    }
});

let exportAbort = null;

$('vid-export').addEventListener('click', async () => {
    if (exportAbort) {
        exportAbort.abort();
        return;
    }
    if (!route?.segments.length) {
        toast('Für ein Video werden mindestens zwei Stopps benötigt.');
        return;
    }
    stopPreview();
    const btn = $('vid-export');
    const bar = $('vid-progress');
    exportAbort = new AbortController();
    btn.textContent = 'Abbrechen';
    bar.value = 0;
    bar.hidden = false;
    try {
        const { width, height } = VIDEO_PRESETS[state.video.preset];
        const { blob, extension } = await renderVideo(
            structuredClone(state),
            route,
            { ...state.video, width, height },
            { onProgress: (p) => { bar.value = p; }, signal: exportAbort.signal },
        );
        download(blob, `${fileBase()}${extension}`);
        toast('Video exportiert.');
    } catch (e) {
        if (e.name === 'AbortError') {
            toast('Export abgebrochen.');
        } else {
            console.error(e);
            toast(e.message);
        }
    } finally {
        exportAbort = null;
        btn.textContent = 'Video exportieren';
        bar.hidden = true;
        renderControls();
    }
});

// --- Speichern & Teilen ---

$('share').addEventListener('click', async () => {
    const url = shareUrl(state);
    try {
        await navigator.clipboard.writeText(url);
        toast('Link in die Zwischenablage kopiert.');
    } catch {
        prompt('Link kopieren:', url);
    }
});

$('save-json').addEventListener('click', () => {
    download(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }), `${fileBase()}.json`);
});

$('load-json').addEventListener('click', () => $('file').click());
$('file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
        replace(JSON.parse(await file.text()));
        toast('Route geladen.');
    } catch {
        toast('Datei konnte nicht gelesen werden.');
    }
});

$('save-geojson').addEventListener('click', () => {
    if (!route) return;
    const features = [
        ...route.segments.map((seg, i) => ({
            type: 'Feature',
            properties: { segment: i + 1, mode: seg.mode, vehicle: seg.vehicle, length_km: Math.round(seg.length * 10) / 10 },
            geometry: { type: 'LineString', coordinates: seg.coords },
        })),
        ...state.stops.map((p, i) => ({
            type: 'Feature',
            properties: { stop: i + 1, name: p.name },
            geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        })),
    ];
    const fc = { type: 'FeatureCollection', features };
    download(new Blob([JSON.stringify(fc)], { type: 'application/geo+json' }), `${fileBase()}.geojson`);
});

$('clear').addEventListener('click', () => {
    if (state.stops.length && !confirm('Alle Stopps entfernen?')) return;
    update((s) => {
        s.stops = [];
        s.segments = [];
    });
});

// --- Reaktion auf Zustandsänderungen ---

let currentStyle = state.style;

function render() {
    if (state.style !== currentStyle) {
        currentStyle = state.style;
        stopPreview();
        setMapStyle(map, state.style);
    }
    renderStops();
    renderControls();
    refreshRoute();
}

subscribe(render);
render();
