// Smoke-Tests der Oberfläche (index.html): Start, Beispielroute, Bearbeiten, Zustand aus Link.
// Benötigt Netzwerkzugriff auf die externen Dienste (Kacheln, Routing).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Zustand wie die App als base64url in den URL-Hash kodieren (vgl. test/screenshot.sh)
function stateHash(file) {
    const json = JSON.stringify(JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8')));
    return '#r=' + Buffer.from(json, 'utf8').toString('base64url');
}

const ROUTE_STATUS = /\d+ Abschnitte? · [\d.]+ km/;

// Nicht abgefangene Fehler im Seitenskript lassen jeden Test scheitern
let pageErrors = [];
test.beforeEach(async ({ page }) => {
    pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));
});

test.afterEach(async () => {
    expect(pageErrors, 'Fehler im Seitenskript').toEqual([]);
});

test('App startet mit Karte und Einstellungen', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page.locator('#map canvas.maplibregl-canvas')).toBeVisible();
    await expect(page.locator('#style option')).toHaveCount(7);
    await expect(page.locator('#empty-hint')).toBeVisible();
    await expect(page.locator('.stop')).toHaveCount(0);
    // Pflichtangaben: Routing-Dienst und Fix-the-map-Link, nicht einklappbar
    const attrib = page.locator('.maplibregl-ctrl-attrib');
    await expect(attrib).toContainText('Routing: FOSSGIS OSRM');
    await expect(attrib.locator('a[href="https://www.openstreetmap.org/fixthemap"]')).toBeVisible();
});

test('Beispielroute laden und berechnen', async ({ page }) => {
    await page.goto('/index.html');
    await page.click('#demo');
    await expect(page.locator('.stop')).toHaveCount(6);
    await expect(page.locator('.segment')).toHaveCount(5);
    await expect(page.locator('#title')).toHaveValue('Europa-Reise 2026');
    await expect(page.locator('#route-status')).toHaveText(ROUTE_STATUS, { timeout: 60 * 1000 });
    expect(page.url()).toMatch(/#r=/);
});

test('Stopps sortieren und entfernen', async ({ page }) => {
    await page.goto('/index.html');
    await page.click('#demo');
    const names = page.locator('.stop .name');
    await expect(names.first()).toHaveText('Hamburg');

    await page.locator('.stop').first().locator('[data-action="down"]').click();
    await expect(names.nth(0)).toHaveText('Berlin');
    await expect(names.nth(1)).toHaveText('Hamburg');

    await page.locator('.stop').first().locator('[data-action="remove"]').click();
    await expect(page.locator('.stop')).toHaveCount(5);
    await expect(page.locator('.segment')).toHaveCount(4);
    await expect(names.first()).toHaveText('Hamburg');
});

test('Zustand aus Link wiederherstellen', async ({ page }) => {
    await page.goto('/index.html' + stateHash('demo-state.json'));
    await expect(page.locator('.stop')).toHaveCount(6);
    await expect(page.locator('#title')).toHaveValue('Europa-Reise 2026');
    await expect(page.locator('#color-by-mode')).toBeChecked();
    await expect(page.locator('#route-status')).toHaveText(ROUTE_STATUS, { timeout: 60 * 1000 });

    // Screenshot zur Sichtprüfung als Testergebnis ablegen
    await page.waitForTimeout(3000);
    await page.screenshot({ path: test.info().outputPath('screenshot.png') });
});

test('Video-Export mit OSM-Rasterstil gesperrt', async ({ page }) => {
    // Keine Kacheln vom OSM-Tile-Server laden: automatisierte Zugriffe verbietet die Tile Usage Policy
    await page.route('https://tile.openstreetmap.org/**', (r) => r.abort());
    await page.goto('/index.html');
    await page.click('#demo');
    // Abschnitt „Animation & Video“ ist standardmäßig zugeklappt
    await page.locator('summary', { hasText: 'Animation' }).click();
    await expect(page.locator('#vid-export')).toBeEnabled();
    await expect(page.locator('#vid-style-hint')).toBeHidden();

    await page.selectOption('#style', 'osm');
    await expect(page.locator('#vid-export')).toBeDisabled();
    await expect(page.locator('#vid-style-hint')).toBeVisible();
    await expect(page.locator('#vid-style-hint')).toContainText(/tile usage policy/i);
    await expect(page.locator('.maplibregl-ctrl-attrib')).not.toHaveClass(/maplibregl-compact/);

    await page.selectOption('#style', 'liberty');
    await expect(page.locator('#vid-export')).toBeEnabled();
});

test('Englische Oberfläche über ?lang=en', async ({ page }) => {
    await page.goto('/index.html?lang=en');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('#lang')).toHaveValue('en');
    await expect(page.locator('summary').first()).toHaveText('Route');
    await expect(page.locator('#search')).toHaveAttribute('placeholder', 'Search and add a place …');
    await page.click('#demo');
    await expect(page.locator('#title')).toHaveValue('Europe trip 2026');
    await expect(page.locator('.stop .name').nth(2)).toHaveText('Prague');
    await expect(page.locator('#route-status')).toHaveText(/\d+ legs? · [\d,]+ km/, { timeout: 60 * 1000 });
});

test('Sprache in der Oberfläche umschalten', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page.locator('#lang')).toHaveValue('de');
    await page.click('#demo');
    await expect(page.locator('#route-status')).toHaveText(ROUTE_STATUS, { timeout: 60 * 1000 });

    await page.selectOption('#lang', 'en');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('#img-export')).toHaveText('Export image');
    await expect(page.locator('.segment select[data-field="mode"]').first().locator('option:checked'))
        .toHaveText('Train (straight line)');
    await expect(page.locator('#route-status')).toHaveText(/\d+ legs? · [\d,]+ km/);
    // Stilnamen werden ebenfalls übersetzt
    await expect(page.locator('#style option[value="satellite"]')).toHaveText('Satellite (Sentinel-2 2016)');

    // Wahl bleibt nach dem Neuladen erhalten
    await page.reload();
    await expect(page.locator('#lang')).toHaveValue('en');
});

test('Ortssuche fragt Photon in der gewählten Sprache an', async ({ page }) => {
    // Photon nicht wirklich anfragen: Antwort simulieren und Sprachparameter prüfen
    const langs = [];
    await page.route('https://photon.komoot.io/**', (r) => {
        langs.push(new URL(r.request().url()).searchParams.get('lang'));
        r.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                type: 'FeatureCollection',
                features: [{
                    type: 'Feature',
                    properties: { name: 'Munich', state: 'Bavaria', country: 'Germany' },
                    geometry: { type: 'Point', coordinates: [11.575, 48.137] },
                }],
            }),
        });
    });
    await page.goto('/index.html?lang=en');
    await page.fill('#search', 'Munich');
    await expect(page.locator('#search-results li')).toHaveText('Munich, Bavaria, Germany');
    expect(langs).toEqual(['en']);
    await page.keyboard.press('Enter');
    await expect(page.locator('.stop .name')).toHaveText(['Munich']);
});
