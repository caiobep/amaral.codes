export const THEME_OPTIONS = [
  { id: 'system', label: 'System' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
] as const

export const PALETTE_OPTIONS = [
  { id: 'ember', label: 'Ember' },
  { id: 'cobalt', label: 'Cobalt' },
  { id: 'graphite', label: 'Graphite' },
  { id: 'garnet', label: 'Garnet' },
  { id: 'ochre', label: 'Ochre' },
  { id: 'plum', label: 'Plum' },
  { id: 'lagoon', label: 'Lagoon' },
] as const

export type ThemePreference = typeof THEME_OPTIONS[number]['id']
export type Theme = Exclude<ThemePreference, 'system'>
export type Palette = typeof PALETTE_OPTIONS[number]['id']
export type BrowserChromeSurface = 'footer' | 'page'

export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'system'
export const DEFAULT_PALETTE: Palette = 'cobalt'
export const APPEARANCE_STORAGE_KEYS = {
  palette: 'amaral-palette',
  theme: 'amaral-theme',
} as const

const themeColors: Record<BrowserChromeSurface, Record<Theme, string>> = {
  footer: { dark: '#090e0d', light: '#111817' },
  page: { dark: '#0f1413', light: '#ffffff' },
}

const themeLabels = Object.fromEntries(
  THEME_OPTIONS.map(option => [option.id, option.label]),
) as Record<ThemePreference, string>
const paletteLabels = Object.fromEntries(
  PALETTE_OPTIONS.map(option => [option.id, option.label]),
) as Record<Palette, string>
const nextThemes = Object.fromEntries(THEME_OPTIONS.map((option, index) => [
  option.id,
  THEME_OPTIONS[(index + 1) % THEME_OPTIONS.length]?.id,
])) as Record<ThemePreference, ThemePreference>
const nextPalettes = Object.fromEntries(PALETTE_OPTIONS.map((option, index) => [
  option.id,
  PALETTE_OPTIONS[(index + 1) % PALETTE_OPTIONS.length]?.id,
])) as Record<Palette, Palette>

export const isTheme = (value: string | null): value is Theme => value === 'light' || value === 'dark'

export const isThemePreference = (value: string | null): value is ThemePreference => (
  THEME_OPTIONS.some(option => option.id === value)
)

export const isPalette = (value: string | null): value is Palette => (
  PALETTE_OPTIONS.some(option => option.id === value)
)

export const resolveThemePreference = (storedTheme: string | null, prefersDark: boolean): Theme => {
  if (isTheme(storedTheme)) return storedTheme
  return prefersDark ? 'dark' : 'light'
}

export const getThemeColor = (theme: Theme, surface: BrowserChromeSurface = 'page') => (
  themeColors[surface][theme]
)

export const getNextThemePreference = (preference: ThemePreference) => (
  nextThemes[preference]
)

export const getNextPalette = (palette: Palette) => nextPalettes[palette]

export const getThemePreferenceLabel = (preference: ThemePreference) => (
  themeLabels[preference]
)

export const getPaletteLabel = (palette: Palette) => (
  paletteLabels[palette]
)

export const getRandomPalette = (random = Math.random): Palette => (
  PALETTE_OPTIONS[Math.floor(random() * PALETTE_OPTIONS.length)]?.id ?? DEFAULT_PALETTE
)
