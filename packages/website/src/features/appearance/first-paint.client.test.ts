import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '../../../tests/runtime/dom'
import { isPalette } from './model'
import {
  createAppearanceBootstrapScript,
  initializeAppearanceBeforePaint,
  type FirstPaintDefinition,
} from './first-paint.client'

const definition: FirstPaintDefinition = {
  defaultPalette: 'ember',
  pageColors: { dark: '#0f1413', light: '#ffffff' },
  palettes: ['ember', 'plum'],
  storageKeys: { palette: 'amaral-palette', theme: 'amaral-theme' },
}

describe('appearance first paint', () => {
  let browser: ReturnType<typeof mount>

  beforeEach(() => {
    browser = mount()
    document.head.innerHTML = '<meta data-theme-color content="">'
  })

  afterEach(async () => {
    await browser.happyDOM.close()
    vi.restoreAllMocks()
  })

  const runBootstrap = () => { window.eval(createAppearanceBootstrapScript()) }

  const initialize = () => { initializeAppearanceBeforePaint(definition) }

  it('generates a standalone script that applies appearance synchronously', () => {
    localStorage.setItem('amaral-theme', 'dark')
    sessionStorage.setItem('amaral-palette', 'plum')
    runBootstrap()
    expect(document.documentElement.dataset).toMatchObject({ palette: 'plum', theme: 'dark' })
  })

  it('applies stored choices and removes the obsolete local palette', () => {
    localStorage.setItem('amaral-theme', 'dark')
    localStorage.setItem('amaral-palette', 'ember')
    sessionStorage.setItem('amaral-palette', 'plum')
    initialize()
    expect(document.documentElement.dataset).toMatchObject({ palette: 'plum', theme: 'dark' })
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(document.querySelector('[data-theme-color]')?.getAttribute('content')).toBe('#0f1413')
    expect(localStorage.getItem('amaral-palette')).toBeNull()
  })

  it('uses system theme and a random session palette when storage has no valid choice', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList)
    vi.spyOn(Math, 'random').mockReturnValue(0)
    sessionStorage.setItem('amaral-palette', 'unsupported')
    initialize()
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(document.documentElement.dataset.palette).toBe('ember')
    expect(sessionStorage.getItem('amaral-palette')).toBe(document.documentElement.dataset.palette)
  })

  it('still applies system theme and a palette when browser storage is blocked', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList)
    vi.spyOn(Math, 'random').mockReturnValue(0.999_999)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied') })
    initialize()
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(document.documentElement.dataset.palette).toBe('plum')
  })

  it('keeps a theme read before legacy palette cleanup is denied', () => {
    localStorage.setItem('amaral-theme', 'dark')
    vi.spyOn(localStorage, 'removeItem').mockImplementation(() => { throw new Error('denied') })
    initialize()
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(isPalette(document.documentElement.dataset.palette ?? null)).toBe(true)
  })
})
