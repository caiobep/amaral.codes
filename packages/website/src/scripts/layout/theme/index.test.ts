import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PALETTE,
  getNextPalette,
  getRandomPalette,
  getNextThemePreference,
  getThemeColor,
  isPalette,
  isThemePreference,
  resolveThemePreference,
} from './index'

describe('theme preference', () => {
  it('uses cobalt as the default palette', () => {
    expect(DEFAULT_PALETTE).toBe('cobalt')
  })

  it('uses an explicit stored preference before the system setting', () => {
    expect(resolveThemePreference('light', true)).toBe('light')
    expect(resolveThemePreference('dark', false)).toBe('dark')
  })

  it('uses the system setting when no explicit preference exists', () => {
    expect(resolveThemePreference(null, true)).toBe('dark')
    expect(resolveThemePreference(null, false)).toBe('light')
    expect(resolveThemePreference('unsupported', true)).toBe('dark')
  })

  it('recognizes every supported preference', () => {
    expect(isThemePreference('system')).toBe(true)
    expect(isThemePreference('light')).toBe(true)
    expect(isThemePreference('dark')).toBe(true)
    expect(isThemePreference('unsupported')).toBe(false)
  })

  it('matches browser chrome to the effective theme', () => {
    expect(getThemeColor('light')).toBe('#ffffff')
    expect(getThemeColor('dark')).toBe('#0f1413')
    expect(getThemeColor('light', 'footer')).toBe('#111817')
    expect(getThemeColor('dark', 'footer')).toBe('#090e0d')
  })

  it('cycles through system, light, and dark', () => {
    expect(getNextThemePreference('system')).toBe('light')
    expect(getNextThemePreference('light')).toBe('dark')
    expect(getNextThemePreference('dark')).toBe('system')
  })

  it('recognizes and cycles through the available palettes', () => {
    expect(isPalette('evergreen')).toBe(false)
    expect(isPalette('ember')).toBe(true)
    expect(isPalette('cobalt')).toBe(true)
    expect(isPalette('graphite')).toBe(true)
    expect(isPalette('garnet')).toBe(true)
    expect(isPalette('ochre')).toBe(true)
    expect(isPalette('plum')).toBe(true)
    expect(isPalette('lagoon')).toBe(true)
    expect(isPalette('unsupported')).toBe(false)
    expect(getNextPalette('ember')).toBe('cobalt')
    expect(getNextPalette('cobalt')).toBe('graphite')
    expect(getNextPalette('graphite')).toBe('garnet')
    expect(getNextPalette('garnet')).toBe('ochre')
    expect(getNextPalette('ochre')).toBe('plum')
    expect(getNextPalette('plum')).toBe('lagoon')
    expect(getNextPalette('lagoon')).toBe('ember')
  })

  it('selects a palette across the full available range', () => {
    expect(getRandomPalette(() => 0)).toBe('ember')
    expect(getRandomPalette(() => 0.999_999)).toBe('lagoon')
  })
})
