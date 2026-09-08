export type Theme = 'light' | 'dark'
export type ThemePreference = Theme | 'system'
export const palettes = [
  'ember',
  'cobalt',
  'graphite',
  'garnet',
  'ochre',
  'plum',
  'lagoon',
] as const

export type Palette = typeof palettes[number]
export type BrowserChromeSurface = 'footer' | 'page'

export const DEFAULT_PALETTE: Palette = 'cobalt'

const nextThemePreference: Record<ThemePreference, ThemePreference> = {
  dark: 'system',
  light: 'dark',
  system: 'light',
}

const nextPalette: Record<Palette, Palette> = {
  cobalt: 'graphite',
  ember: 'cobalt',
  garnet: 'ochre',
  graphite: 'garnet',
  lagoon: 'ember',
  ochre: 'plum',
  plum: 'lagoon',
}

const themeColors: Record<Theme, string> = {
  dark: '#0f1413',
  light: '#ffffff',
}

const footerColors: Record<Theme, string> = {
  dark: '#090e0d',
  light: '#111817',
}

export const isTheme = (value: string | null): value is Theme => value === 'light' || value === 'dark'

export const isThemePreference = (value: string | null): value is ThemePreference => (
  value === 'system' || isTheme(value)
)

export const isPalette = (value: string | null): value is Palette => (
  palettes.some(palette => palette === value)
)

export const resolveThemePreference = (storedTheme: string | null, prefersDark: boolean): Theme => {
  if (isTheme(storedTheme)) return storedTheme
  return prefersDark ? 'dark' : 'light'
}

export const getThemeColor = (
  theme: Theme,
  surface: BrowserChromeSurface = 'page',
) => surface === 'footer' ? footerColors[theme] : themeColors[theme]

export const getNextThemePreference = (preference: ThemePreference) => nextThemePreference[preference]

export const getNextPalette = (palette: Palette) => nextPalette[palette]

export const getRandomPalette = (random = Math.random): Palette => (
  palettes[Math.floor(random() * palettes.length)] ?? DEFAULT_PALETTE
)
