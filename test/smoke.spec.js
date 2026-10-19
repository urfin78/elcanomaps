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
