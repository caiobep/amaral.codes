import { expect, test } from 'vitest'
import { resolveEntryLanguage } from './entry-language.ts'

test.each([
  { category: 'note', language: undefined, expected: 'en' },
  { category: 'podcast', language: undefined, expected: 'pt-BR' },
  { category: 'podcast', language: 'en', expected: 'en' },
  { category: 'note', language: 'pt-BR', expected: 'pt-BR' },
] as const)('resolves $category language $language to $expected', ({ category, language, expected }) => {
  expect(resolveEntryLanguage({ category, language })).toBe(expected)
})

test('uses legacy talk language unless the entry specifies its own', () => {
  const talk = { format: 'talk', language: 'pt-BR', materials: [] } as const
  expect(resolveEntryLanguage({ category: 'talk', talk: { ...talk, materials: [] } })).toBe('pt-BR')
  expect(resolveEntryLanguage({ category: 'talk', language: 'en', talk: { ...talk, materials: [] } })).toBe('en')
})
