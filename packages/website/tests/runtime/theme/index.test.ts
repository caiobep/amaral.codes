import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { element, mount } from '../dom'

const controls = `<button type="button" data-theme-toggle>
  <span data-theme-state="system">System</span><span data-theme-state="light">Light</span>
  <span data-theme-state="dark">Dark</span></button>
  <button type="button" data-palette-toggle>${[
    'ember', 'cobalt', 'graphite', 'garnet', 'ochre', 'plum', 'lagoon',
  ].map(palette => `<span data-palette-state="${palette}">${palette}</span>`).join('')}</button>`

let browser: ReturnType<typeof mount>
let media: MediaQueryList

beforeEach(() => {
  vi.resetModules()
  browser = mount(`<header>${controls}</header><footer class="footer-shell">${controls}</footer>`)
  document.head.innerHTML = '<meta data-theme-color content="">'
  sessionStorage.setItem('amaral-palette', 'cobalt')
  media = window.matchMedia('(prefers-color-scheme: dark)')
  vi.spyOn(media, 'matches', 'get').mockReturnValue(false)
  vi.spyOn(window, 'matchMedia').mockReturnValue(media)
})

afterEach(async () => {
  await browser.happyDOM.close()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function changeSystemTheme(matches: boolean) {
  vi.spyOn(media, 'matches', 'get').mockReturnValue(matches)
  media.dispatchEvent(Object.assign(new Event('change'), { matches }))
}

function expectTheme(preference: string, effective: string, label: string) {
  expect(document.documentElement.dataset.theme).toBe(effective)
  expect(document.documentElement.style.colorScheme).toBe(effective)
  for (const control of Array.from(document.querySelectorAll<HTMLElement>('[data-theme-toggle]'))) {
    expect(control.dataset.themeValue).toBe(preference)
    expect(control.getAttribute('aria-label')).toBe(label)
    for (const state of Array.from(control.querySelectorAll<HTMLElement>('[data-theme-state]'))) {
      expect(state.hidden).toBe(state.dataset.themeState !== preference)
    }
  }
}

function expectPalette(palette: string, label: string) {
  expect(document.documentElement.dataset.palette).toBe(palette)
  for (const control of Array.from(document.querySelectorAll<HTMLElement>('[data-palette-toggle]'))) {
    expect(control.dataset.paletteValue).toBe(palette)
    expect(control.getAttribute('aria-label')).toBe(label)
    for (const state of Array.from(control.querySelectorAll<HTMLElement>('[data-palette-state]'))) {
      expect(state.hidden).toBe(state.dataset.paletteState !== palette)
    }
  }
}

function stubFooterObserver() {
  let notify: IntersectionObserverCallback | undefined
  const observer = {
    root: null, rootMargin: '0px', thresholds: [0],
    observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn(), takeRecords: vi.fn(() => []),
  } satisfies IntersectionObserver
  const create = vi.fn(function (callback: IntersectionObserverCallback) {
    notify = callback
    return observer
  })
  vi.stubGlobal('IntersectionObserver', create)
  return {
    create,
    observer,
    emit(isIntersecting?: boolean) {
      if (!notify) throw new Error('Footer observer was not initialized')
      const rect = new DOMRect()
      notify(isIntersecting === undefined ? [] : [{
        target: element('.footer-shell'), isIntersecting,
        intersectionRatio: Number(isIntersecting), time: 0,
        boundingClientRect: rect, intersectionRect: rect, rootBounds: null,
      }], observer)
    },
  }
}

describe('appearance runtime', () => {
  it.each([
    ['dark', false, 'dark', 'dark', 'Theme: Dark. Switch to System'],
    ['light', true, 'light', 'light', 'Theme: Light. Switch to Dark'],
    ['invalid', true, 'system', 'dark', 'Theme: System. Switch to Light'],
    [null, false, 'system', 'light', 'Theme: System. Switch to Light'],
  ] as const)('resolves stored preference %s against system dark=%s', async (
    stored, systemDark, preference, effective, label,
  ) => {
    if (stored !== null) localStorage.setItem('amaral-theme', stored)
    changeSystemTheme(systemDark)
    const { initializeAppearance } = await import('../../../src/features/appearance/appearance.client')
    initializeAppearance()
    expectTheme(preference, effective, label)
    expect(element('[data-theme-color]').getAttribute('content'))
      .toBe(effective === 'dark' ? '#0f1413' : '#ffffff')
  })

  it('cycles both controls and storage once per click after repeated initialization', async () => {
    const { initializeAppearance } = await import('../../../src/features/appearance/appearance.client')
    const listen = vi.spyOn(media, 'addEventListener')
    initializeAppearance()
    initializeAppearance()
    expect(listen).toHaveBeenCalledExactlyOnceWith('change', expect.any(Function))
    element('header [data-theme-toggle]').click()
    expectTheme('light', 'light', 'Theme: Light. Switch to Dark')
    expect(localStorage.getItem('amaral-theme')).toBe('light')
    changeSystemTheme(true)
    expectTheme('light', 'light', 'Theme: Light. Switch to Dark')
    element('footer [data-theme-toggle]').click()
    expectTheme('dark', 'dark', 'Theme: Dark. Switch to System')
    expect(localStorage.getItem('amaral-theme')).toBe('dark')
    changeSystemTheme(false)
    expectTheme('dark', 'dark', 'Theme: Dark. Switch to System')
    element('header [data-theme-toggle]').click()
    expectTheme('system', 'light', 'Theme: System. Switch to Light')
    expect(localStorage.getItem('amaral-theme')).toBeNull()
    changeSystemTheme(true)
    expectTheme('system', 'dark', 'Theme: System. Switch to Light')
    expect(element('[data-theme-color]').getAttribute('content')).toBe('#0f1413')
    changeSystemTheme(false)
    expectTheme('system', 'light', 'Theme: System. Switch to Light')
    expect(element('[data-theme-color]').getAttribute('content')).toBe('#ffffff')
  })

  it('cycles every palette, synchronizes controls, and persists the session selection', async () => {
    const { initializeAppearance } = await import('../../../src/features/appearance/appearance.client')
    initializeAppearance()
    initializeAppearance()
    expectPalette('cobalt', 'Palette: Cobalt. Switch to Graphite')
    for (const [palette, label] of [
      ['graphite', 'Palette: Graphite. Switch to Garnet'],
      ['garnet', 'Palette: Garnet. Switch to Ochre'],
      ['ochre', 'Palette: Ochre. Switch to Plum'],
      ['plum', 'Palette: Plum. Switch to Lagoon'],
      ['lagoon', 'Palette: Lagoon. Switch to Ember'],
      ['ember', 'Palette: Ember. Switch to Cobalt'],
      ['cobalt', 'Palette: Cobalt. Switch to Graphite'],
    ] as const) {
      element('footer [data-palette-toggle]').click()
      expectPalette(palette, label)
      expect(sessionStorage.getItem('amaral-palette')).toBe(palette)
    }
  })

  it('keeps the pre-applied palette ahead of the session value', async () => {
    document.documentElement.dataset.palette = 'ember'
    const { initializeAppearance } = await import('../../../src/features/appearance/appearance.client')
    initializeAppearance()
    expectPalette('ember', 'Palette: Ember. Switch to Cobalt')
    expect(sessionStorage.getItem('amaral-palette')).toBe('ember')
  })

  it.each([null, 'invalid'])('selects a supported palette for session value %s', async value => {
    if (value === null) sessionStorage.removeItem('amaral-palette')
    else sessionStorage.setItem('amaral-palette', value)
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { initializeAppearance } = await import('../../../src/features/appearance/appearance.client')
    initializeAppearance()
    expectPalette('ember', 'Palette: Ember. Switch to Cobalt')
    expect(sessionStorage.getItem('amaral-palette')).toBe('ember')
  })

  it.each([undefined, 'invalid'])('recovers missing or invalid control values: %s', async value => {
    const { initializeAppearance } = await import('../../../src/features/appearance/appearance.client')
    initializeAppearance()
    const theme = element('[data-theme-toggle]')
    const palette = element('[data-palette-toggle]')
    if (value === undefined) {
      delete theme.dataset.themeValue
      delete palette.dataset.paletteValue
    } else {
      theme.dataset.themeValue = value
      palette.dataset.paletteValue = value
    }
    theme.click()
    palette.click()
    expectTheme('light', 'light', 'Theme: Light. Switch to Dark')
    expectPalette('graphite', 'Palette: Graphite. Switch to Garnet')
  })

  it('applies theme and palette choices when storage reads and writes are denied', async () => {
    for (const storage of [localStorage, sessionStorage]) {
      for (const method of ['getItem', 'setItem', 'removeItem'] as const) {
        vi.spyOn(storage, method).mockImplementation(() => { throw new Error('Storage denied') })
      }
    }
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const { initializeAppearance } = await import('../../../src/features/appearance/appearance.client')
    initializeAppearance()
    expectPalette('ember', 'Palette: Ember. Switch to Cobalt')
    element('[data-theme-toggle]').click()
    expectTheme('light', 'light', 'Theme: Light. Switch to Dark')
    element('[data-theme-toggle]').click()
    expectTheme('dark', 'dark', 'Theme: Dark. Switch to System')
    element('[data-theme-toggle]').click()
    expectTheme('system', 'light', 'Theme: System. Switch to Light')
    changeSystemTheme(true)
    expectTheme('system', 'dark', 'Theme: System. Switch to Light')
    element('[data-palette-toggle]').click()
    expectPalette('cobalt', 'Palette: Cobalt. Switch to Graphite')
  })

  it('handles missing controls and browser-chrome metadata', async () => {
    document.body.innerHTML = ''
    document.head.innerHTML = ''
    const { initializeAppearance, applyBrowserChromeSurface } = await import('../../../src/features/appearance/appearance.client')
    initializeAppearance()
    applyBrowserChromeSurface('footer')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(document.documentElement.dataset.browserChromeSurface).toBe('footer')
  })
})

describe('footer browser chrome', () => {
  it.each([undefined, 'invalid'])('uses light chrome for an unset or invalid theme: %s', async theme => {
    if (theme !== undefined) document.documentElement.dataset.theme = theme
    const { applyBrowserChromeSurface } = await import('../../../src/features/appearance/appearance.client')
    applyBrowserChromeSurface('footer')
    expect(element('[data-theme-color]').getAttribute('content')).toBe('#111817')
    applyBrowserChromeSurface('page')
    expect(element('[data-theme-color]').getAttribute('content')).toBe('#ffffff')
  })

  it('tracks footer visibility, theme changes, replacement, and removal', async () => {
    const { initializeAppearance } = await import('../../../src/features/appearance/appearance.client')
    const { initializeFooterChrome } = await import('../../../src/scripts/layout/footer-chrome/runtime')
    initializeAppearance()
    const first = stubFooterObserver()
    const footer = element('.footer-shell')
    initializeFooterChrome()
    initializeFooterChrome()
    expect(first.create).toHaveBeenCalledTimes(1)
    expect(first.observer.observe).toHaveBeenCalledExactlyOnceWith(footer)
    first.emit(true)
    expect(document.documentElement.dataset.browserChromeSurface).toBe('footer')
    expect(element('[data-theme-color]').getAttribute('content')).toBe('#111817')
    changeSystemTheme(true)
    expect(element('[data-theme-color]').getAttribute('content')).toBe('#090e0d')
    first.emit(false)
    expect(document.documentElement.dataset.browserChromeSurface).toBe('page')
    expect(element('[data-theme-color]').getAttribute('content')).toBe('#0f1413')
    first.emit(true)
    first.emit()
    expect(document.documentElement.dataset.browserChromeSurface).toBe('page')
    footer.outerHTML = '<footer class="footer-shell">Next page</footer>'
    const second = stubFooterObserver()
    initializeFooterChrome()
    expect(first.observer.disconnect).toHaveBeenCalledTimes(1)
    expect(second.observer.observe).toHaveBeenCalledExactlyOnceWith(element('.footer-shell'))
    second.emit(true)
    element('.footer-shell').remove()
    initializeFooterChrome()
    expect(second.observer.disconnect).toHaveBeenCalledTimes(1)
    expect(document.documentElement.dataset.browserChromeSurface).toBe('page')
    expect(element('[data-theme-color]').getAttribute('content')).toBe('#0f1413')
    initializeFooterChrome()
    expect(second.observer.disconnect).toHaveBeenCalledTimes(1)
  })
})
