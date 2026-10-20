import {
  APPEARANCE_STORAGE_KEYS,
  DEFAULT_PALETTE,
  DEFAULT_THEME_PREFERENCE,
  getNextPalette,
  getNextThemePreference,
  getPaletteLabel,
  getRandomPalette,
  getThemeColor,
  getThemePreferenceLabel,
  isPalette,
  isTheme,
  isThemePreference,
  resolveThemePreference,
  type BrowserChromeSurface,
  type Palette,
  type Theme,
  type ThemePreference,
} from './model'

let systemPreferenceBound = false

const readStoredTheme = () => {
  try { return localStorage.getItem(APPEARANCE_STORAGE_KEYS.theme) } catch { return null }
}

const readStoredPalette = () => {
  try { return sessionStorage.getItem(APPEARANCE_STORAGE_KEYS.palette) } catch { return null }
}

const storeThemePreference = (preference: ThemePreference) => {
  try {
    if (preference === DEFAULT_THEME_PREFERENCE) localStorage.removeItem(APPEARANCE_STORAGE_KEYS.theme)
    else localStorage.setItem(APPEARANCE_STORAGE_KEYS.theme, preference)
  } catch { /* The selection still applies for the current page. */ }
}

const storePalette = (palette: Palette) => {
  try { sessionStorage.setItem(APPEARANCE_STORAGE_KEYS.palette, palette) } catch {
    /* The selection still applies for the current page. */
  }
}

const updateThemeControls = (preference: ThemePreference) => {
  document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]').forEach((control) => {
    const next = getNextThemePreference(preference)
    control.dataset.themeValue = preference
    control.setAttribute(
      'aria-label',
      `Theme: ${getThemePreferenceLabel(preference)}. Switch to ${getThemePreferenceLabel(next)}`,
    )
    control.querySelectorAll<HTMLElement>('[data-theme-state]').forEach((state) => {
      state.hidden = state.dataset.themeState !== preference
    })
  })
}

const updatePaletteControls = (palette: Palette) => {
  document.querySelectorAll<HTMLButtonElement>('[data-palette-toggle]').forEach((control) => {
    const next = getNextPalette(palette)
    control.dataset.paletteValue = palette
    control.setAttribute(
      'aria-label',
      `Palette: ${getPaletteLabel(palette)}. Switch to ${getPaletteLabel(next)}`,
    )
    control.querySelectorAll<HTMLElement>('[data-palette-state]').forEach((state) => {
      state.hidden = state.dataset.paletteState !== palette
    })
  })
}

const updateBrowserChrome = (theme: Theme) => {
  const surface = document.documentElement.dataset.browserChromeSurface === 'footer' ? 'footer' : 'page'
  document.querySelector<HTMLMetaElement>('[data-theme-color]')
    ?.setAttribute('content', getThemeColor(theme, surface))
}

const applyTheme = (theme: Theme) => {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
  updateBrowserChrome(theme)
}

export const applyBrowserChromeSurface = (surface: BrowserChromeSurface) => {
  const root = document.documentElement
  root.dataset.browserChromeSurface = surface
  const theme = isTheme(root.dataset.theme ?? null) ? root.dataset.theme as Theme : 'light'
  updateBrowserChrome(theme)
}

const bindSystemPreference = (media: MediaQueryList) => {
  if (systemPreferenceBound) return
  systemPreferenceBound = true
  media.addEventListener('change', (event) => {
    if (isTheme(readStoredTheme())) return
    applyTheme(event.matches ? 'dark' : 'light')
  })
}

const bindThemeControls = (media: MediaQueryList) => {
  document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]').forEach((control) => {
    if (control.dataset.themeToggle === 'ready') return
    control.dataset.themeToggle = 'ready'
    control.addEventListener('click', () => {
      const current = isThemePreference(control.dataset.themeValue ?? null)
        ? control.dataset.themeValue as ThemePreference
        : DEFAULT_THEME_PREFERENCE
      const next = getNextThemePreference(current)
      storeThemePreference(next)
      applyTheme(resolveThemePreference(next, media.matches))
      updateThemeControls(next)
    })
  })
}

const bindPaletteControls = () => {
  document.querySelectorAll<HTMLButtonElement>('[data-palette-toggle]').forEach((control) => {
    if (control.dataset.paletteToggle === 'ready') return
    control.dataset.paletteToggle = 'ready'
    control.addEventListener('click', () => {
      const current = isPalette(control.dataset.paletteValue ?? null)
        ? control.dataset.paletteValue as Palette
        : DEFAULT_PALETTE
      const next = getNextPalette(current)
      storePalette(next)
      document.documentElement.dataset.palette = next
      updatePaletteControls(next)
    })
  })
}

export const initializeAppearance = () => {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const storedTheme = readStoredTheme()
  const activePalette = document.documentElement.dataset.palette
    ?? readStoredPalette()
  const preference = isTheme(storedTheme) ? storedTheme : DEFAULT_THEME_PREFERENCE
  const palette = isPalette(activePalette) ? activePalette : getRandomPalette()
  applyTheme(resolveThemePreference(storedTheme, media.matches))
  document.documentElement.dataset.palette = palette
  storePalette(palette)
  updateThemeControls(preference)
  updatePaletteControls(palette)
  bindSystemPreference(media)
  bindThemeControls(media)
  bindPaletteControls()
}
