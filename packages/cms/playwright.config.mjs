import { defineConfig } from '@playwright/test'

const cmsOrigin = `${process.env.CMS_TRIAL_HOST ? 'https' : 'http'}://${process.env.CMS_TRIAL_HOST ?? '127.0.0.1'}:4010`

export default defineConfig({
  testDir: './tests/browser',
  outputDir: './test-results',
  workers: 1,
  timeout: 90_000,
  webServer: {
    command: 'exec env CMS_TRIAL_TEST=1 node scripts/dev.mjs',
    url: `${cmsOrigin}/admin/create-first-user`,
    reuseExistingServer: false,
    ignoreHTTPSErrors: Boolean(process.env.CMS_TRIAL_HOST),
    gracefulShutdown: { signal: 'SIGTERM', timeout: 10_000 },
    timeout: 90_000,
  },
  use: {
    baseURL: cmsOrigin,
    browserName: process.env.CMS_TRIAL_HOST ? 'webkit' : 'chromium',
    ignoreHTTPSErrors: Boolean(process.env.CMS_TRIAL_HOST),
    screenshot: 'only-on-failure', actionTimeout: 15_000,
  },
})
