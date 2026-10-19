// Bild- und Video-Export über eine Offscreen-Karte in Zielauflösung

import { createOffscreenMap, waitIdle, attributionFor, setAnimationFrame, videoAllowed } from './map.js';
import { buildTimeline, cameraPlan, cameraAt, frameAt } from './animation.js';

export const OSM_VIDEO_HINT = 'Video export is not available with the OpenStreetMap (raster) style: '
    + 'the OSM tile usage policy does not allow loading map tiles that nobody is viewing. '
    + 'Please choose another map style, e.g. Liberty or Bright.';

const MEDIABUNNY_URL = 'https://unpkg.com/mediabunny@1.61.6/dist/bundles/mediabunny.min.mjs';

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
}

// Titel und Quellenangabe in das Bild einbrennen
function drawOverlay(ctx, width, height, { title, attribution }) {
    const s = Math.max(width, height) / 1080;
    ctx.save();
    if (title) {
        const size = Math.round(48 * s);
        ctx.font = `700 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const w = Math.min(ctx.measureText(title).width + size * 1.2, width - 40 * s);
        const h = size * 1.7;
        const y = 30 * s;
        ctx.fillStyle = 'rgba(255,255,255,0.88)';
        roundRect(ctx, (width - w) / 2, y, w, h, h / 2);
        ctx.fillStyle = '#1d3557';
        ctx.fillText(title, width / 2, y + h / 2, w - size);
    }
    const size = Math.max(10, Math.round(13 * s));
    ctx.font = `${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const pad = size * 0.5;
    const w = Math.min(ctx.measureText(attribution).width + pad * 2, width);
    const h = size * 1.6;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(width - w, height - h, w, h);
    ctx.fillStyle = '#333333';
    ctx.fillText(attribution, width - pad, height - h / 2, w - pad * 2);
    ctx.restore();
}

// Platz für den Titel oben freihalten (in logischen Pixeln der Offscreen-Karte)
function titleTop(state, width, height, off) {
    if (!state.title) return 0;
    const s = Math.max(width, height) / 1080;
    return Math.round((30 + 48 * 1.7) * s * off.width / width);
}

function overviewCamera(map, route, topPadding) {
    const { width, height } = map.getContainer().getBoundingClientRect();
    const pad = Math.round(Math.min(width, height) * 0.1);
    return map.cameraForBounds(route.bbox, {
        padding: { top: pad + topPadding, bottom: pad, left: pad, right: pad },
        maxZoom: 11,
    });
}

function composite(target, map, state) {
    const ctx = target.getContext('2d');
    ctx.drawImage(map.getCanvas(), 0, 0, target.width, target.height);
    drawOverlay(ctx, target.width, target.height, {
        title: state.title,
        attribution: attributionFor(state.style),
    });
}

export async function renderImage(state, route, { width, height, type }) {
    if (!route?.bbox) throw new Error('Keine Route vorhanden.');
    const off = await createOffscreenMap(state, route, width, height);
    try {
        off.map.jumpTo(overviewCamera(off.map, route, titleTop(state, width, height, off)));
        await waitIdle(off.map);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        composite(canvas, off.map, state);
        return await new Promise((resolve, reject) => {
            canvas.toBlob((b) => b ? resolve(b) : reject(new Error('Bild konnte nicht erzeugt werden.')), type, 0.92);
        });
    } finally {
        off.destroy();
    }
}

export async function renderVideo(state, route, opts, { onProgress, onFrame, signal } = {}) {
    const { width, height, fps, duration, camera, type } = opts;
    if (!route?.segments.length) throw new Error('Für ein Video werden mindestens zwei Stopps benötigt.');
    if (!videoAllowed(state.style)) throw new Error(OSM_VIDEO_HINT);
    if (typeof VideoEncoder === 'undefined') {
        throw new Error('Dieser Browser unterstützt kein WebCodecs (VideoEncoder).');
    }
    const mb = await import(MEDIABUNNY_URL);
    const format = type === 'webm' ? new mb.WebMOutputFormat() : new mb.Mp4OutputFormat({ fastStart: 'in-memory' });
    const codec = await mb.getFirstEncodableVideoCodec(format.getSupportedVideoCodecs(), { width, height });
    if (!codec) throw new Error(`Dieser Browser kann kein ${type.toUpperCase()}-Video in ${width}×${height} kodieren.`);

    const off = await createOffscreenMap(state, route, width, height);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const output = new mb.Output({ format, target: new mb.BufferTarget() });
    try {
        const source = new mb.CanvasSource(canvas, { codec, bitrate: mb.QUALITY_HIGH });
        output.addVideoTrack(source, { frameRate: fps });
        await output.start();

        const tl = buildTimeline(route, duration);
        const plan = cameraPlan(off.map, tl, camera, titleTop(state, width, height, off));
        const frames = Math.round(duration * fps);
        for (let i = 0; i < frames; i++) {
            if (signal?.aborted) throw new DOMException('Abgebrochen', 'AbortError');
            const time = i / fps;
            setAnimationFrame(off.map, frameAt(tl, time));
            off.map.jumpTo(cameraAt(plan, tl, time));
            await waitIdle(off.map);
            composite(canvas, off.map, state);
            await source.add(time, 1 / fps);
            await onFrame?.(canvas, i, frames);
            onProgress?.((i + 1) / frames);
        }
        await output.finalize();
        return {
            blob: new Blob([output.target.buffer], { type: format.mimeType }),
            extension: format.fileExtension,
        };
    } catch (e) {
        await output.cancel().catch(() => {});
        throw e;
    } finally {
        off.destroy();
    }
}

export function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
}
