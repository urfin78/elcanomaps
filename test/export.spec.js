// Export-Selbsttest: führt test/selftest.html (Routing, Bild- und Video-Export) aus
// und prüft das Ergebnis. Exportierte Dateien landen je Variante in test-results/.
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const OUT = path.resolve(__dirname, '..', '.test');

const VARIANTS = [
    { name: 'liberty-mp4-follow', query: '' },
    { name: 'dark-webm-overview', query: 'style=dark&type=webm&camera=overview' },
];

for (const v of VARIANTS) {
    test(`Export ${v.name}`, async ({ page }) => {
        test.setTimeout(5 * 60 * 1000);
        for (const f of fs.existsSync(OUT) ? fs.readdirSync(OUT) : []) {
            if (f.startsWith('export.') || f === 'result.json') fs.rmSync(path.join(OUT, f));
        }

        await page.goto(`/test/selftest.html?${v.query}`);
        // Der Selbsttest schreibt consoleErrors als letzten Eintrag
        await page.waitForFunction(() => document.getElementById('out').textContent.includes('"consoleErrors"'),
            null, { timeout: 4 * 60 * 1000, polling: 1000 });
        const result = JSON.parse(await page.locator('#out').textContent());

        // Ergebnisse und Exporte für das Workflow-Artefakt sichern
        fs.writeFileSync(test.info().outputPath('result.json'), JSON.stringify(result, null, 2));
        for (const f of fs.existsSync(OUT) ? fs.readdirSync(OUT) : []) {
            if (f.startsWith('export.')) fs.copyFileSync(path.join(OUT, f), test.info().outputPath(f));
        }

        // Ausfälle externer Dienste (Routing) führen zu Luftlinie statt Fehler: nur vermerken
        for (const e of result.route?.errors || []) test.info().annotations.push({ type: 'Routing', description: e });
        for (const e of result.consoleErrors || []) test.info().annotations.push({ type: 'Konsole', description: e });

        expect(result.error, 'Fehler im Selbsttest').toBeUndefined();
        expect(result.route.segments.map((s) => s.mode)).toEqual(['train', 'car', 'flight']);
        expect(result.route.km).toBeGreaterThan(2000);
        expect(result.image.type).toBe('image/png');
        expect(result.image.bytes).toBeGreaterThan(50 * 1024);
        expect(result.video.frames).toBe(40);
        expect(result.video.bytes).toBeGreaterThan(10 * 1024);
        expect(result.video.ext).toBe(v.query.includes('type=webm') ? '.webm' : '.mp4');
    });
}
