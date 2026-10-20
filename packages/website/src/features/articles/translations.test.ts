import { expect, it } from 'vitest'
import { isTranslatedEntry, originalSlug, translatedPath, translationLinks } from './translations'

it('uses canonical localized links for primary and secondary entries', () => {
  const english = { id: 'en--example', data: { language: 'en' as const, translation: { key: 'posts/example', primary: true, href: '/en/posts/example' } } }
  const portuguese = { id: 'pt-br--example', data: { language: 'pt-BR' as const, translation: { key: 'posts/example', primary: false, href: '/pt-br/posts/example' } } }
  expect(isTranslatedEntry(english)).toBe(false)
  expect(isTranslatedEntry(portuguese)).toBe(true)
  expect(originalSlug(portuguese)).toBe('example')
  expect(translatedPath(english)).toBe('/en/posts/example')
  expect(translationLinks([english, portuguese, { id: 'example', data: {} }], english)).toEqual([
    { language: 'en', href: '/en/posts/example' },
    { language: 'pt-BR', href: '/pt-br/posts/example' },
  ])
  expect(translatedPath({ id: 'old', data: {} })).toBe('/posts/old')
  expect(translationLinks([english], { id: 'old', data: {} })).toEqual([])
})
