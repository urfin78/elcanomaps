// UI-Verdrahtung: Sidebar <-> Datenmodell <-> Karte

import {
    state, update, replace, subscribe, shareUrl,
    addStop, removeStop, moveStop, setSegment,
    MODES, VEHICLES, IMAGE_PRESETS, VIDEO_PRESETS,
} from './state.js';
import { createMap, setMapStyle, syncMap, setAnimationFrame, videoAllowed, localizeLabels, STYLES } from './map.js';
import { searchPlaces, buildRoute } from './routing.js';
import { buildTimeline, cameraPlan, cameraAt, frameAt } from './animation.js';
import { renderImage, renderVideo, download } from './export.js';
import { t, getLang, setLang, onLangChange, translateDom, formatNumber, LANGUAGES } from './i18n.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const options = (entries, selected) => entries
    .map(([value, label]) => `<option value="${esc(value)}"${value === selected ? ' selected' : ''}>${esc(label)}</option>`)
    .join('');

// Beispielroute; Ortsnamen und Titel in der aktuellen Sprache
const DEMO_COORDS = [[9.9937, 53.5511], [13.405, 52.52], [14.4378, 50.0755], [16.3738, 48.2082], [-9.1393, 38.7223], [-9.3817, 38.8029]];
const DEMO_MODES = ['train', 'car', 'car', 'flight', 'bike'];

function demoRoute() {
    const names = t('demo.stops');
    return {
        stops: DEMO_COORDS.map(([lng, lat], i) => ({ name: names[i], lng, lat })),
        segments: DEMO_MODES.map((mode) => ({ mode })),
        title: t('demo.title'),
    };
}

translateDom();

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
    computing = state.segments.length > 0;
    renderStatus();
    const next = await buildRoute(state);
    if (my !== generation) return;
    route = next;
    computing = false;
    syncMap(map, state, route);
    renderStatus();
    if (fit && route.bbox) {
        map.fitBounds(route.bbox, { padding: 60, maxZoom: 11, duration: 800 });
    }
}

let computing = false;

function renderStatus() {
    let text = '';
    if (computing) {
        text = t('status.computing');
    } else if (route?.segments.length) {
        const n = route.segments.length;
        const km = formatNumber(Math.round(route.length));
        text = [t(n === 1 ? 'status.legs.one' : 'status.legs.other', { n, km }), ...route.errors].join('\n');
    }
    $('route-status').textContent = text;
}

// --- Stopps-Liste ---

function segmentHtml(i) {
    const seg = state.segments[i];
    const auto = VEHICLES[MODES[seg.mode].vehicle];
    const modes = Object.keys(MODES).map((k) => [k, t(`mode.${k}`)]);
    const vehicles = Object.entries(VEHICLES).map(([k, v]) => [k, `${v.emoji} ${t(`vehicle.${k}`)}`]);
    return `<div class="segment" data-segment="${i}">
        <select data-field="mode" aria-label="${esc(t('segment.mode'))}">${options(modes, seg.mode)}</select>
        <select data-field="vehicle" aria-label="${esc(t('segment.vehicle'))}">${options([['', `${auto.emoji} ${t('segment.auto')}`], ...vehicles], seg.vehicle || '')}</select>
    </div>`;
}

function renderStops() {
    const last = state.stops.length - 1;
    $('stops').innerHTML = state.stops.map((p, i) => `${i > 0 ? segmentHtml(i - 1) : ''}
        <div class="stop" draggable="true" data-index="${i}">
            <span class="handle" title="${esc(t('stop.drag'))}">⋮⋮</span>
            <span class="num">${i + 1}</span>
            <span class="name" title="${esc(p.name)}">${esc(p.name)}</span>
            <button type="button" data-action="up" title="${esc(t('stop.up'))}"${i === 0 ? ' disabled' : ''}>↑</button>
            <button type="button" data-action="down" title="${esc(t('stop.down'))}"${i === last ? ' disabled' : ''}>↓</button>
            <button type="button" data-action="remove" title="${esc(t('stop.remove'))}">✕</button>
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
        results = await searchPlaces(q, { signal: searchAbort.signal, near: [c.lng, c.lat], zoom: map.getZoom() });
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

$('demo').addEventListener('click', () => replace({ ...state, ...demoRoute() }));

// --- Karte & Export-Einstellungen ---

const presetLabel = (k, p) => (p.width ? `${t(`format.${k}`)} (${p.width}×${p.height})` : t(`format.${k}`));

// Auswahllisten mit übersetzten Beschriftungen (bei Sprachwechsel neu)
function renderOptions() {
    $('lang').innerHTML = options(Object.entries(LANGUAGES), getLang());
    $('style').innerHTML = options(Object.keys(STYLES).map((k) => [k, t(`style.${k}`)]), state.style);
    $('img-preset').innerHTML = options(Object.entries(IMAGE_PRESETS).map(([k, p]) => [k, presetLabel(k, p)]), state.image.preset);
    $('vid-preset').innerHTML = options(Object.entries(VIDEO_PRESETS).map(([k, p]) => [k, presetLabel(k, p)]), state.video.preset);
}

renderOptions();
$('lang').addEventListener('change', (e) => setLang(e.target.value));

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
    $('vid-export').textContent = t(exportAbort ? 'video.cancel' : 'video.export');
    $('vid-style-hint').hidden = !noVideo;
    $('preview').textContent = t(preview ? 'video.stop' : 'video.preview');
    if (!$('img-export').disabled) $('img-export').textContent = t('image.export');
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
    $('preview').textContent = t('video.preview');
}

function startPreview() {
    if (!route?.segments.length) {
        toast(t('video.needTwoAnim'));
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
    $('preview').textContent = t('video.stop');
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
        toast(t('route.addStopsFirst'));
        return;
    }
    btn.disabled = true;
    btn.textContent = t('image.exporting');
    try {
        const blob = await renderImage(structuredClone(state), route, state.image);
        const ext = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[state.image.type];
        download(blob, `${fileBase()}.${ext}`);
    } catch (e) {
        console.error(e);
        toast(e.message);
    } finally {
        btn.disabled = false;
        btn.textContent = t('image.export');
    }
});

let exportAbort = null;

$('vid-export').addEventListener('click', async () => {
    if (exportAbort) {
        exportAbort.abort();
        return;
    }
    if (!route?.segments.length) {
        toast(t('video.needTwo'));
        return;
    }
    stopPreview();
    const btn = $('vid-export');
    const bar = $('vid-progress');
    exportAbort = new AbortController();
    btn.textContent = t('video.cancel');
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
        toast(t('video.done'));
    } catch (e) {
        if (e.name === 'AbortError') {
            toast(t('video.aborted'));
        } else {
            console.error(e);
            toast(e.message);
        }
    } finally {
        exportAbort = null;
        bar.hidden = true;
        renderControls();
    }
});

// --- Speichern & Teilen ---

$('share').addEventListener('click', async () => {
    const url = shareUrl(state);
    try {
        await navigator.clipboard.writeText(url);
        toast(t('share.copied'));
    } catch {
        prompt(t('share.prompt'), url);
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
        toast(t('share.loaded'));
    } catch {
        toast(t('share.fileError'));
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
    if (state.stops.length && !confirm(t('share.clearConfirm'))) return;
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

// Sprachwechsel: statische Texte, Auswahllisten, Stoppliste, Status und Kartenbeschriftung
onLangChange((lang) => {
    translateDom();
    renderOptions();
    renderStops();
    renderControls();
    renderStatus();
    // Nicht isStyleLoaded(): ist false, solange Kacheln nachladen. Ohne erfasste
    // Beschriftungen lokalisiert der style.load-Handler ohnehin mit der neuen Sprache.
    if (map._labelFields) localizeLabels(map, lang);
});
