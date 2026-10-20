// Playwright-Konfiguration für Smoke- und Export-Tests (läuft in GitHub Actions).
// Liefert das Projekt über test/server.py aus, damit der Upload-Endpunkt des
// Selbsttests (POST /upload/<name> → .test/) wie bei test/run-selftest.sh funktioniert.
const { defineConfig } = require('@playwright/test');
const path = require('path');

const PORT = 4173;
const ROOT = path.resolve(__dirname, '..');

module.exports = defineConfig({
    testDir: '.',
    testMatch: '*.spec.js',
    timeout: 120 * 1000,
    fullyParallel: false,
    workers: 1,
    outputDir: path.join(ROOT, 'test-results'),
    reporter: [['list'], ['html', { open: 'never', outputFolder: path.join(ROOT, 'playwright-report') }]],
    use: {
        baseURL: `http://127.0.0.1:${PORT}`,
        // Installiertes Google Chrome statt Playwright-Chromium: enthält H.264 für den MP4-Export
        channel: 'chrome',
        viewport: { width: 1400, height: 900 },
        // Oberfläche folgt der Browsersprache; Tests prüfen standardmäßig die deutschen Texte
        locale: 'de-DE',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        launchOptions: {
            // WebGL ohne GPU (wie in test/env.sh)
            args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
        },
    },
    webServer: {
        command: `python3 -I test/server.py ${PORT}`,
        cwd: ROOT,
        url: `http://127.0.0.1:${PORT}/index.html`,
        reuseExistingServer: !process.env.CI,
        timeout: 30 * 1000,
    },
});
