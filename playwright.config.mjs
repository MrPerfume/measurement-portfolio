import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  outputDir: './output/playwright/test-results',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45000,
  reporter: [['list'], ['html', { outputFolder: 'output/playwright/report', open: 'never' }]],
  use: { baseURL: 'http://localhost:4187', trace: 'retain-on-failure', screenshot: 'only-on-failure', browserName: 'chromium' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'tablet', use: { viewport: { width: 768, height: 1024 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } }
  ],
  webServer: { command: 'php -S localhost:4187 -t .pages-dist', url: 'http://localhost:4187', reuseExistingServer: false, timeout: 15000, stdout: 'ignore', stderr: 'ignore' }
});
