import {
  DEFAULT_PALETTE,
  getNextPalette,
  getRandomPalette,
  getNextThemePreference,
  getThemeColor,
  isPalette,
  isTheme,
  isThemePreference,
  resolveThemePreference,
  type Palette,
  type BrowserChromeSurface,
  type Theme,
  type ThemePreference,
} from './index'

const themeStorageKey = 'amaral-theme'
const paletteStorageKey = 'amaral-palette'
let systemPreferenceBound = false

const preferenceLabels: Record<ThemePreference, string> = {
  dark: 'Dark',
  light: 'Light',
  system: 'System',
}

const paletteLabels: Record<Palette, string> = {
  cobalt: 'Cobalt',
  ember: 'Ember',
  garnet: 'Garnet',
  graphite: 'Graphite',
  lagoon: 'Lagoon',
  ochre: 'Ochre',
  plum: 'Plum',
}

const readStoredTheme = () => {
  try {
    return localStorage.getItem(themeStorageKey)
  } catch {
    return null
  }
}

const readStoredPalette = () => {
  try {
    return sessionStorage.getItem(paletteStorageKey)
  } catch {
    return null
  }
}

const storeThemePreference = (preference: ThemePreference) => {
  try {
    if (preference === 'system') localStorage.removeItem(themeStorageKey)
    else localStorage.setItem(themeStorageKey, preference)
  } catch {
    // The selected theme still applies for the current page.
  }
}

const storePalette = (palette: Palette) => {
  try {
    sessionStorage.setItem(paletteStorageKey, palette)
  } catch {
    // The selected palette still applies for the current page.
  }
}

const updateControls = (preference: ThemePreference) => {
  document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]')
    .forEach((control) => {
      const nextPreference = getNextThemePreference(preference)
      control.dataset.themeValue = preference
      control.setAttribute(
        'aria-label',
        `Theme: ${preferenceLabels[preference]}. Switch to ${preferenceLabels[nextPreference]}`,
      )
      control.querySelectorAll<HTMLElement>('[data-theme-state]')
        .forEach((state) => {
          state.hidden = state.dataset.themeState !== preference
        })
    })
}

const updatePaletteControls = (palette: Palette) => {
  document.querySelectorAll<HTMLButtonElement>('[data-palette-toggle]')
    .forEach((control) => {
      const next = getNextPalette(palette)
      control.dataset.paletteValue = palette
      control.setAttribute(
        'aria-label',
        `Palette: ${paletteLabels[palette]}. Switch to ${paletteLabels[next]}`,
      )
      control.querySelectorAll<HTMLElement>('[data-palette-state]')
        .forEach((state) => {
          state.hidden = state.dataset.paletteState !== palette
        })
    })
}

const updateBrowserChrome = (theme: Theme) => {
  const surface = document.documentElement.dataset.browserChromeSurface === 'footer'
    ? 'footer'
    : 'page'
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
  const currentTheme = root.dataset.theme ?? null
  const theme = isTheme(currentTheme) ? currentTheme : 'light'
  updateBrowserChrome(theme)
}

const applyPalette = (palette: Palette) => {
  document.documentElement.dataset.palette = palette
}

const bindSystemPreference = (media: MediaQueryList) => {
  if (systemPreferenceBound) return
  systemPreferenceBound = true
  media.addEventListener('change', (event) => {
    if (isTheme(readStoredTheme())) return
    applyTheme(event.matches ? 'dark' : 'light')
  })
}

export const initializeTheme = () => {
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  const storedTheme = readStoredTheme()
  const activePalette = document.documentElement.dataset.palette ?? readStoredPalette()
  const preference = isTheme(storedTheme) ? storedTheme : 'system'
  const palette = isPalette(activePalette) ? activePalette : getRandomPalette()
  applyTheme(resolveThemePreference(storedTheme, media.matches))
  applyPalette(palette)
  storePalette(palette)
  updateControls(preference)
  updatePaletteControls(palette)
  bindSystemPreference(media)

  document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]')
    .forEach((control) => {
      if (control.dataset.themeToggle === 'ready') return
      control.dataset.themeToggle = 'ready'
      control.addEventListener('click', () => {
        const currentPreference = isThemePreference(control.dataset.themeValue ?? null)
          ? control.dataset.themeValue as ThemePreference
          : 'system'
        const nextPreference = getNextThemePreference(currentPreference)
        storeThemePreference(nextPreference)
        applyTheme(resolveThemePreference(nextPreference, media.matches))
        updateControls(nextPreference)
      })
    })

  document.querySelectorAll<HTMLButtonElement>('[data-palette-toggle]')
    .forEach((control) => {
      if (control.dataset.paletteToggle === 'ready') return
      control.dataset.paletteToggle = 'ready'
      control.addEventListener('click', () => {
        const current = isPalette(control.dataset.paletteValue ?? null)
          ? control.dataset.paletteValue as Palette
          : DEFAULT_PALETTE
        const next = getNextPalette(current)
        storePalette(next)
        applyPalette(next)
        updatePaletteControls(next)
      })
    })
}
