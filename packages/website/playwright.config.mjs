import { defineConfig, devices } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const outputDir = fileURLToPath(new URL('./test-results', import.meta.url))

export default defineConfig({
  testDir: './tests/browser',
  outputDir,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4322',
    // Keep network fixtures deterministic; offline suites enable service workers explicitly.
    serviceWorkers: 'block',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'exec astro preview --host 127.0.0.1 --port 4322',
    reuseExistingServer: false,
    timeout: 30_000,
    url: 'http://127.0.0.1:4322',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'desktop-webkit',
      use: { browserName: 'webkit', viewport: { height: 900, width: 1440 } },
    },
    {
      name: 'mobile-webkit',
      use: { ...devices['iPhone 13'], viewport: { height: 844, width: 390 } },
    },
    {
      name: 'tablet-webkit',
      use: { ...devices['iPad Mini'] },
    },
  ],
})
