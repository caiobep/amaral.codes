import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '../dom'

describe('PWA registration runtime', () => {
  let browser: ReturnType<typeof mount>
  const register = vi.fn<(url: string, options: RegistrationOptions) => Promise<void>>()

  beforeEach(() => {
    vi.resetModules()
    browser = mount()
    vi.stubEnv('PROD', true)
    register.mockReset().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { register } })
    vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete')
  })

  afterEach(async () => {
    await browser.happyDOM.close()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('does not register in development or consume the production initialization', async () => {
    vi.stubEnv('PROD', false)
    const { initializePwa } = await import('../../../src/scripts/layout/pwa')
    initializePwa()
    expect(register).not.toHaveBeenCalled()

    vi.stubEnv('PROD', true)
    initializePwa()
    expect(register).toHaveBeenCalledOnce()
  })

  it('ignores unsupported browsers without consuming initialization', async () => {
    Reflect.deleteProperty(navigator, 'serviceWorker')
    const { initializePwa } = await import('../../../src/scripts/layout/pwa')
    expect(initializePwa).not.toThrow()
    expect(register).not.toHaveBeenCalled()

    Object.defineProperty(navigator, 'serviceWorker', { value: { register } })
    initializePwa()
    expect(register).toHaveBeenCalledOnce()
  })

  it('registers immediately after load with the public worker path and cache policy, only once', async () => {
    const { initializePwa } = await import('../../../src/scripts/layout/pwa')
    const listen = vi.spyOn(window, 'addEventListener')
    initializePwa()
    initializePwa()
    window.dispatchEvent(new Event('load'))

    expect(register).toHaveBeenCalledExactlyOnceWith('/service-worker.js', {
      scope: '/',
      updateViaCache: 'none',
    })
    expect(listen).not.toHaveBeenCalled()
  })

  it.each(['loading', 'interactive'] as const)('waits for load from readyState=%s and handles the event once', async (readyState) => {
    vi.spyOn(document, 'readyState', 'get').mockReturnValue(readyState)
    const { initializePwa } = await import('../../../src/scripts/layout/pwa')
    const listen = vi.spyOn(window, 'addEventListener')
    initializePwa()
    initializePwa()
    expect(register).not.toHaveBeenCalled()
    expect(listen).toHaveBeenCalledExactlyOnceWith('load', expect.any(Function), { once: true })

    window.dispatchEvent(new Event('load'))
    window.dispatchEvent(new Event('load'))
    initializePwa()
    expect(register).toHaveBeenCalledOnce()
  })

  it('reports registration rejection without an unhandled promise or duplicate attempts', async () => {
    const failure = new Error('Service workers are disabled')
    register.mockRejectedValue(failure)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { initializePwa } = await import('../../../src/scripts/layout/pwa')

    expect(initializePwa).not.toThrow()
    await vi.waitFor(() => expect(warn).toHaveBeenCalledExactlyOnceWith(
      'Offline support could not be enabled.', failure,
    ))
    initializePwa()
    expect(register).toHaveBeenCalledOnce()
  })
})
