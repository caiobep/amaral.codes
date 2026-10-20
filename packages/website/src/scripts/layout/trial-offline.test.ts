import { afterEach, describe, expect, it, vi } from 'vitest'
import { disableTrialOfflineCache } from './trial-offline'

afterEach(() => vi.unstubAllGlobals())

describe('CMS trial offline privacy', () => {
  it('unregisters the site worker and removes its cached pages without clearing unrelated caches', async () => {
    const site = { active: { scriptURL: 'https://example.test/service-worker.js' }, unregister: vi.fn() }
    const other = { active: { scriptURL: 'https://example.test/other.js' }, unregister: vi.fn() }
    const pending = { active: null, unregister: vi.fn() }
    vi.stubGlobal('navigator', { serviceWorker: { getRegistrations: vi.fn().mockResolvedValue([site, other, pending]) } })
    const remove = vi.fn()
    vi.stubGlobal('caches', { keys: vi.fn().mockResolvedValue(['amaral-pages-old', 'other-cache']), delete: remove })

    await disableTrialOfflineCache()

    expect(site.unregister).toHaveBeenCalledOnce()
    expect(other.unregister).not.toHaveBeenCalled()
    expect(pending.unregister).not.toHaveBeenCalled()
    expect(remove).toHaveBeenCalledExactlyOnceWith('amaral-pages-old')
  })

  it('handles a fresh origin with no workers or caches', async () => {
    vi.stubGlobal('navigator', { serviceWorker: { getRegistrations: vi.fn().mockResolvedValue([]) } })
    const remove = vi.fn()
    vi.stubGlobal('caches', { keys: vi.fn().mockResolvedValue([]), delete: remove })
    await disableTrialOfflineCache()
    expect(remove).not.toHaveBeenCalled()
  })
})
