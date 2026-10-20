import {
  APPEARANCE_STORAGE_KEYS,
  DEFAULT_PALETTE,
  PALETTE_OPTIONS,
  getThemeColor,
} from './model'

export interface FirstPaintDefinition {
  defaultPalette: string
  pageColors: { dark: string; light: string }
  palettes: string[]
  storageKeys: { palette: string; theme: string }
}

const firstPaintDefinition: FirstPaintDefinition = {
  defaultPalette: DEFAULT_PALETTE,
  pageColors: {
    dark: getThemeColor('dark'),
    light: getThemeColor('light'),
  },
  palettes: PALETTE_OPTIONS.map(option => option.id),
  storageKeys: APPEARANCE_STORAGE_KEYS,
}

export function initializeAppearanceBeforePaint(definition: FirstPaintDefinition) {
  function readStoredAppearance() {
    let storedTheme: string | null = null
    let storedPalette: string | null = null
    try {
      storedTheme = localStorage.getItem(definition.storageKeys.theme)
      localStorage.removeItem(definition.storageKeys.palette)
      storedPalette = sessionStorage.getItem(definition.storageKeys.palette)
    } catch {
      // Preserve values read before storage access was denied.
    }
    return { storedPalette, storedTheme }
  }

  function selectTheme(storedTheme: string | null) {
    if (storedTheme === 'light' || storedTheme === 'dark') return storedTheme
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  function selectPalette(storedPalette: string | null) {
    if (storedPalette !== null && definition.palettes.includes(storedPalette)) return storedPalette
    return definition.palettes[Math.floor(Math.random() * definition.palettes.length)]
      ?? definition.defaultPalette
  }

  function storePalette(palette: string) {
    try { sessionStorage.setItem(definition.storageKeys.palette, palette) } catch {
      // The selected palette still applies for the current page.
    }
  }

  const { storedPalette, storedTheme } = readStoredAppearance()
  const theme = selectTheme(storedTheme)
  const palette = selectPalette(storedPalette)
  const root = document.documentElement
  storePalette(palette)
  root.dataset.theme = theme
  root.dataset.palette = palette
  root.style.colorScheme = theme
  document.querySelector('[data-theme-color]')?.setAttribute('content', definition.pageColors[theme])
}

export const createAppearanceBootstrapScript = () => {
  const serializedDefinition = JSON.stringify(firstPaintDefinition).replaceAll('<', '\\u003c')
  return `(${initializeAppearanceBeforePaint.toString()})(${serializedDefinition})`
}
