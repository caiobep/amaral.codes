import { expect, it } from 'vitest'
import { entrySchema } from './index.ts'

const entry = { title: 'Article title', date: '2026-10-18' }

it('keeps sharing overrides separate from article content and preserves old entries', () => {
  expect(entrySchema.parse(entry).sharing).toBeUndefined()
  const sharing = { title: 'Shared title', description: 'Shared description', image: '/media/cover.webp', imageAlt: 'A cover' }
  const result = entrySchema.parse({ ...entry, sharing })
  expect(result.title).toBe(entry.title)
  expect(result.sharing).toEqual(sharing)
})

it('rejects partial, unsafe, and private sharing metadata', () => {
  for (const sharing of [
    { image: '/media/cover.webp' }, { imageAlt: 'Missing image' },
    { image: 'javascript:alert(1)', imageAlt: 'Unsafe' },
    { image: 'media/cover.webp', imageAlt: 'Relative image' },
    { image: 'https://example.com/image?token=private', imageAlt: 'Private' },
    { title: '' }, { status: 'draft' },
  ]) expect(entrySchema.safeParse({ ...entry, sharing }).success).toBe(false)
})

it('accepts portable rich link cards and rejects unsafe targets', () => {
  const card = { url: 'https://example.com/article', title: 'Source article', description: 'What it covers', image: '/media/link.webp', imageAlt: 'Source cover' }
  expect(entrySchema.parse({ ...entry, linkCards: [card] }).linkCards).toEqual([card])
  expect(entrySchema.safeParse({ ...entry, linkCards: [{ ...card, url: 'https://example.com/?api_key=private' }] }).success).toBe(false)
})
