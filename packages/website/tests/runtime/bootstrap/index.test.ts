import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '../dom'

const initializers = vi.hoisted(() => ({
  initializeNavigationState: vi.fn(),
  initializeHeaderSearch: vi.fn(),
  initializeMobileHeader: vi.fn(),
  initializeTheme: vi.fn(),
  initializeFooterChrome: vi.fn(),
  initializePageMotion: vi.fn(),
  initializePwa: vi.fn(),
  initializeShareControls: vi.fn(),
  initializeTalkMaterialPreviews: vi.fn(),
  initializeSwipeNavigation: vi.fn(),
  initializeTouchFocus: vi.fn(),
  initializeSearch: vi.fn(),
}))

vi.mock('../../../src/scripts/layout/navigation-state/runtime', () => ({
  initializeNavigationState: initializers.initializeNavigationState,
}))
vi.mock('../../../src/scripts/layout/header-search/runtime', () => ({
  initializeHeaderSearch: initializers.initializeHeaderSearch,
}))
vi.mock('../../../src/scripts/layout/mobile-header', () => ({
  initializeMobileHeader: initializers.initializeMobileHeader,
}))
vi.mock('../../../src/scripts/layout/theme/runtime', () => ({
  initializeTheme: initializers.initializeTheme,
}))
vi.mock('../../../src/scripts/layout/footer-chrome/runtime', () => ({
  initializeFooterChrome: initializers.initializeFooterChrome,
}))
vi.mock('../../../src/scripts/layout/motion', () => ({
  initializePageMotion: initializers.initializePageMotion,
}))
vi.mock('../../../src/scripts/layout/pwa', () => ({
  initializePwa: initializers.initializePwa,
}))
vi.mock('../../../src/scripts/share/runtime', () => ({
  initializeShareControls: initializers.initializeShareControls,
}))
vi.mock('../../../src/scripts/talk-material-preview', () => ({
  initializeTalkMaterialPreviews: initializers.initializeTalkMaterialPreviews,
}))
vi.mock('../../../src/scripts/layout/swipe-navigation', () => ({
  initializeSwipeNavigation: initializers.initializeSwipeNavigation,
}))
vi.mock('../../../src/scripts/layout/touch-focus', () => ({
  initializeTouchFocus: initializers.initializeTouchFocus,
}))
vi.mock('../../../src/scripts/search/runtime', () => ({
  initializeSearch: initializers.initializeSearch,
}))

const pageInitializers = [
  initializers.initializeNavigationState,
  initializers.initializeHeaderSearch,
  initializers.initializeMobileHeader,
  initializers.initializeTheme,
  initializers.initializeFooterChrome,
  initializers.initializePageMotion,
  initializers.initializePwa,
  initializers.initializeShareControls,
  initializers.initializeTalkMaterialPreviews,
  initializers.initializeSwipeNavigation,
]

describe('script bootstrap wiring', () => {
  let browser: ReturnType<typeof mount>

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    browser = mount()
  })

  afterEach(async () => {
    await browser.happyDOM.close()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('initializes every layout behavior immediately, including one-time touch focus', async () => {
    await import('../../../src/scripts/layout')

    for (const initialize of pageInitializers) {
      expect(initialize).toHaveBeenCalledExactlyOnceWith()
    }
    expect(initializers.initializeTouchFocus).toHaveBeenCalledExactlyOnceWith()
    expect(initializers.initializeSearch).not.toHaveBeenCalled()
  })

  it('reruns page initializers once per astro:page-load without restarting touch focus', async () => {
    await import('../../../src/scripts/layout')

    for (const count of [2, 3]) {
      const event = new Event('astro:page-load')
      document.dispatchEvent(event)

      for (const initialize of pageInitializers) {
        expect(initialize).toHaveBeenCalledTimes(count)
        expect(initialize).toHaveBeenLastCalledWith(event)
      }
      expect(initializers.initializeTouchFocus).toHaveBeenCalledOnce()
    }
  })

  it('refreshes only navigation state and theme on astro:after-swap', async () => {
    await import('../../../src/scripts/layout')
    vi.clearAllMocks()

    for (const count of [1, 2]) {
      document.dispatchEvent(new Event('astro:after-swap'))

      expect(initializers.initializeNavigationState).toHaveBeenCalledTimes(count)
      expect(initializers.initializeNavigationState).toHaveBeenLastCalledWith()
      expect(initializers.initializeTheme).toHaveBeenCalledTimes(count)
      expect(initializers.initializeTheme).toHaveBeenLastCalledWith()
    }
    const { initializeNavigationState, initializeTheme, ...otherInitializers } = initializers
    expect(initializeNavigationState).toHaveBeenCalledTimes(2)
    expect(initializeTheme).toHaveBeenCalledTimes(2)
    for (const initialize of Object.values(otherInitializers)) {
      expect(initialize).not.toHaveBeenCalled()
    }
  })

  it('initializes the search page immediately without invoking layout behaviors', async () => {
    await import('../../../src/scripts/search')

    expect(initializers.initializeSearch).toHaveBeenCalledExactlyOnceWith()
    for (const initialize of [...pageInitializers, initializers.initializeTouchFocus]) {
      expect(initialize).not.toHaveBeenCalled()
    }
  })

  it('reruns search on astro:page-load but not astro:after-swap', async () => {
    await import('../../../src/scripts/search')

    for (const count of [2, 3]) {
      const event = new Event('astro:page-load')
      document.dispatchEvent(event)
      expect(initializers.initializeSearch).toHaveBeenCalledTimes(count)
      expect(initializers.initializeSearch).toHaveBeenLastCalledWith(event)
    }
    document.dispatchEvent(new Event('astro:after-swap'))
    expect(initializers.initializeSearch).toHaveBeenCalledTimes(3)
  })
})
