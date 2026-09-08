import { describe, expect, test } from 'vitest'
import {
  createShortcutRedirect,
  getDeeplinkOrShortcutRedirect,
  getDeeplinkRedirect,
  getSafeRedirect,
  getShortcutRedirect,
} from '.'

const ORIGIN = 'https://amaral.codes'

describe('safe redirect policy', () => {
  test.each([
    ['/about', 'https://amaral.codes/about'],
    ['https://amaral.codes/posts/?category=note', 'https://amaral.codes/posts/?category=note'],
    ['shortcuts://run-shortcut?name=Capture', 'shortcuts://run-shortcut?name=Capture'],
  ])('allows %s', (target, expected) => {
    expect(getSafeRedirect(target, ORIGIN)).toBe(expected)
  })

  test.each([
    'https://example.com/phishing',
    'http://amaral.codes/insecure',
    'https://amaral.codes@example.com/deceptive',
    'https://user@amaral.codes/private',
    'javascript:document.body.remove()',
    'data:text/html,unsafe',
    'shortcuts://run-shortcut.example.com/?name=Capture',
    'shortcuts://other-action/?name=Capture',
    'http://[',
  ])('blocks %s', (target) => {
    expect(getSafeRedirect(target, ORIGIN)).toBeNull()
  })
})

test('deeplink redirects accept the legacy parameter and prefer a safe direct target', () => {
  const legacy = new URLSearchParams({ l: '/projects' })
  const direct = new URLSearchParams({ shortcut: 'Capture', url: '/about' })

  expect(getDeeplinkRedirect(legacy, ORIGIN)).toBe('https://amaral.codes/projects')
  expect(getDeeplinkOrShortcutRedirect(direct, ORIGIN)).toBe('https://amaral.codes/about')
})

test('deeplink redirects preserve shortcut fallback and legacy aliases', () => {
  const fallback = new URLSearchParams({ s: 'Capture thought' })
  const shortcutsRoute = new URLSearchParams({ a: 'Capture thought' })
  const expected = 'shortcuts://run-shortcut?name=Capture+thought'

  expect(getDeeplinkOrShortcutRedirect(fallback, ORIGIN)).toBe(expected)
  expect(getShortcutRedirect(shortcutsRoute)).toBe(expected)
  expect(createShortcutRedirect('Capture thought')).toBe(expected)
})

test('redirect resolvers do nothing without a target', () => {
  const empty = new URLSearchParams()

  expect(getDeeplinkRedirect(empty, ORIGIN)).toBeNull()
  expect(getDeeplinkOrShortcutRedirect(empty, ORIGIN)).toBeNull()
  expect(getShortcutRedirect(empty)).toBeNull()
})
