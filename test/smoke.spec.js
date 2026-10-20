// Smoke tests of the UI (index.html): startup, sample route, editing, state from link, languages.
// Needs network access to the external services (tiles, routing).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Encode the state as base64url in the URL hash like the app does (see test/screenshot.sh)
function stateHash(file) {
    const json = JSON.stringify(JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8')));
    return '#r=' + Buffer.from(json, 'utf8').toString('base64url');
}

const ROUTE_STATUS = /\d+ Abschnitte? · [\d.]+ km/;

// Uncaught errors in the page script fail every test
let pageErrors = [];
test.beforeEach(async ({ page }) => {
    pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));
});

test.afterEach(async () => {
    expect(pageErrors, 'Errors in page script').toEqual([]);
});

test('App starts with map and settings', async ({ page }) => {
    await page.goto('/index.html');
    await expect(page.locator('#map canvas.maplibregl-canvas')).toBeVisible();
    await expect(page.locator('#style option')).toHaveCount(7);
    await expect(page.locator('#empty-hint')).toBeVisible();
    await expect(page.locator('.stop')).toHaveCount(0);
    // Required attribution: routing service and fix-the-map link, not collapsible
    const attrib = page.locator('.maplibregl-ctrl-attrib');
    await expect(attrib).toContainText('Routing: FOSSGIS OSRM');
    await expect(attrib.locator('a[href="https://www.openstreetmap.org/fixthemap"]')).toBeVisible();
});

test('Load and compute sample route', async ({ page }) => {
    await page.goto('/index.html');
    await page.click('#demo');
    await expect(page.locator('.stop')).toHaveCount(6);
    await expect(page.locator('.segment')).toHaveCount(5);
    await expect(page.locator('#title')).toHaveValue('Europa-Reise 2026');
    await expect(page.locator('#route-status')).toHaveText(ROUTE_STATUS, { timeout: 60 * 1000 });
    expect(page.url()).toMatch(/#r=/);
});

test('Reorder and remove stops', async ({ page }) => {
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

test('Restore state from link', async ({ page }) => {
    await page.goto('/index.html' + stateHash('demo-state.json'));
    await expect(page.locator('.stop')).toHaveCount(6);
    await expect(page.locator('#title')).toHaveValue('Europa-Reise 2026');
    await expect(page.locator('#color-by-mode')).toBeChecked();
    await expect(page.locator('#route-status')).toHaveText(ROUTE_STATUS, { timeout: 60 * 1000 });

    // Store a screenshot as test result for visual inspection
    await page.waitForTimeout(3000);
    await page.screenshot({ path: test.info().outputPath('screenshot.png') });
});

test('Video export disabled with OSM raster style', async ({ page }) => {
    // Don't load tiles from the OSM tile server: the tile usage policy forbids automated access
    await page.route('https://tile.openstreetmap.org/**', (r) => r.abort());
    await page.goto('/index.html');
    await page.click('#demo');
    // The “Animation & Video” section is collapsed by default
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

test('English UI via ?lang=en', async ({ page }) => {
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

test('Switch language in the UI', async ({ page }) => {
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
    // Style names are translated as well
    await expect(page.locator('#style option[value="satellite"]')).toHaveText('Satellite (Sentinel-2 2016)');

    // The choice persists after reloading
    await page.reload();
    await expect(page.locator('#lang')).toHaveValue('en');
});

test('Place search queries Photon in the selected language', async ({ page }) => {
    // Don't actually query Photon: mock the response and check the language parameter
    const langs = [];
    const zooms = [];
    await page.route('https://photon.komoot.io/**', (r) => {
        const params = new URL(r.request().url()).searchParams;
        langs.push(params.get('lang'));
        zooms.push(params.get('zoom'));
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
    // Map zoom as bias, otherwise Photon prefers nearby streets (zoom 16)
    expect(Number(zooms[0])).toBeLessThan(10);
    await page.keyboard.press('Enter');
    await expect(page.locator('.stop .name')).toHaveText(['Munich']);
});
