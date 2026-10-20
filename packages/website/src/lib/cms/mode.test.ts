import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

it('requires the explicit trial flag', async () => {
  for (const value of ['', 'true', '0']) {
    vi.stubEnv('AMARAL_CMS_TRIAL', value)
    vi.resetModules()
    expect((await import('./mode')).cmsTrialEnabled).toBe(false)
  }
  vi.stubEnv('AMARAL_CMS_TRIAL', '1')
  vi.resetModules()
  expect((await import('./mode')).cmsTrialEnabled).toBe(true)
})
