// Playwright configuration for smoke and export tests (runs in GitHub Actions).
// Serves the project via test/server.py so the self-test's upload endpoint
// (POST /upload/<name> → .test/) works as with test/run-selftest.sh.
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
        // Installed Google Chrome instead of Playwright's Chromium: includes H.264 for MP4 export
        channel: 'chrome',
        viewport: { width: 1400, height: 900 },
        // The UI follows the browser language; tests check the German texts by default
        locale: 'de-DE',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        launchOptions: {
            // WebGL without GPU (as in test/env.sh)
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
