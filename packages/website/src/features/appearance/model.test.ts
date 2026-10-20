import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PALETTE,
  PALETTE_OPTIONS,
  THEME_OPTIONS,
  getNextPalette,
  getNextThemePreference,
  getRandomPalette,
  isPalette,
  isThemePreference,
  resolveThemePreference,
} from './model'

describe('appearance model', () => {
  it('cycles each ordered choice exactly once before returning to its start', () => {
    const cycle = <Value>(start: Value, next: (value: Value) => Value, count: number) => {
      const visited = new Set<Value>()
      let current = start
      for (let index = 0; index < count; index += 1) {
        visited.add(current)
        current = next(current)
      }
      return { current, visited }
    }

    const themes = cycle(THEME_OPTIONS[0].id, getNextThemePreference, THEME_OPTIONS.length)
    const palettes = cycle(PALETTE_OPTIONS[0].id, getNextPalette, PALETTE_OPTIONS.length)
    expect(themes).toEqual({ current: THEME_OPTIONS[0].id, visited: new Set(THEME_OPTIONS.map(({ id }) => id)) })
    expect(palettes).toEqual({ current: PALETTE_OPTIONS[0].id, visited: new Set(PALETTE_OPTIONS.map(({ id }) => id)) })
  })

  it('validates choices through the same option definitions used by controls', () => {
    expect(THEME_OPTIONS.every(({ id }) => isThemePreference(id))).toBe(true)
    expect(PALETTE_OPTIONS.every(({ id }) => isPalette(id))).toBe(true)
    expect(isThemePreference('unsupported')).toBe(false)
    expect(isPalette('unsupported')).toBe(false)
  })

  it('resolves an explicit theme before the system preference', () => {
    expect(resolveThemePreference('light', true)).toBe('light')
    expect(resolveThemePreference('dark', false)).toBe('dark')
    expect(resolveThemePreference(null, true)).toBe('dark')
    expect(resolveThemePreference('unsupported', false)).toBe('light')
  })

  it('selects a random palette across the complete ordered range', () => {
    expect(getRandomPalette(() => 0)).toBe(PALETTE_OPTIONS[0].id)
    expect(getRandomPalette(() => 0.999_999)).toBe(PALETTE_OPTIONS.at(-1)?.id)
    expect(PALETTE_OPTIONS.some(({ id }) => id === DEFAULT_PALETTE)).toBe(true)
  })
})
