import assert from 'node:assert/strict'
import type { PayloadRequest } from 'payload'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { User } from '../../payload-types'
import { previewEntry } from '../../preview'
import { Entries } from './index'

vi.mock('@payloadcms/richtext-lexical/html', () => ({
  convertLexicalToHTML: vi.fn(),
}))

const author: User = {
  id: 1,
  collection: 'users',
  email: 'author@example.com',
  createdAt: '2026-09-01T12:00:00.000Z',
  updatedAt: '2026-09-01T12:00:00.000Z',
}

function request(user: PayloadRequest['user'] = null): PayloadRequest {
  return { user } as PayloadRequest
}

function field(name: string) {
  const configured = Entries.fields.find(field => 'name' in field && field.name === name)
  assert(configured)
  return configured
}

afterEach(() => {
  vi.useRealTimers()
})

describe('entry defaults', () => {
  it('starts notes in English with the supported content categories', () => {
    expect(Entries.slug).toBe('entries')
    expect(field('category')).toMatchObject({
      type: 'select', required: true, defaultValue: 'note',
      options: ['note', 'essay', 'review', 'link', 'video', 'podcast', 'talk'],
    })
    expect(field('language')).toMatchObject({
      type: 'select', defaultValue: 'en', options: ['en', 'pt-BR'],
    })
    expect(field('topics')).toMatchObject({ type: 'text', hasMany: true })
  })

  it('computes the ISO publication date when the default is requested', () => {
    const date = field('date')
    assert(date.type === 'date')
    assert(typeof date.defaultValue === 'function')
    const context = { req: request(), user: null }
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-07T12:34:56.000Z'))

    expect(date.required).toBe(true)
    expect(date.defaultValue(context)).toBe('2026-09-07T12:34:56.000Z')

    vi.setSystemTime(new Date('2026-09-08T08:00:00.000Z'))

    expect(date.defaultValue(context)).toBe('2026-09-08T08:00:00.000Z')
  })

  it('requires title, unique public slug, and rich text while keeping summaries optional', () => {
    expect(field('title')).toMatchObject({ type: 'text', required: true })
    expect(field('slug')).toMatchObject({ type: 'text', required: true, unique: true })
    expect(field('body')).toMatchObject({ type: 'richText', required: true })
    expect(field('summary')).toEqual({ name: 'summary', type: 'textarea' })
  })
})

describe('entry authoring', () => {
  it('retains draft history and exposes the authenticated preview handler', () => {
    expect(Entries.versions).toEqual({
      drafts: { autosave: { interval: 1000, showSaveDraftButton: true } }, maxPerDoc: 30,
    })
    expect(Entries.endpoints).toEqual([
      { path: '/:id/preview', method: 'get', handler: previewEntry },
    ])
    expect(Entries.admin).toMatchObject({
      useAsTitle: 'title', defaultColumns: ['title', 'category', '_status', 'updatedAt'],
    })
  })

  it.each([42, 'entry-42'])('builds the local preview URL from document ID %s, not its slug', async (id) => {
    const preview = Entries.admin?.preview
    assert(preview)

    const url = await preview(
      { id, slug: 'a-smaller-publishing-loop' },
      { locale: 'en', token: null, req: request(author) },
    )

    expect(url).toBe(`http://127.0.0.1:4324/cms-preview/${String(id)}`)
  })

  it('opens live preview only after the entry has an ID and offers native device sizes', async () => {
    const livePreview = Entries.admin?.livePreview
    assert(livePreview)
    const url = livePreview.url
    assert(typeof url === 'function')
    const req = request(author)
    const options = { locale: { code: 'en', label: 'English' }, req, payload: req.payload }
    expect(await url({ ...options, data: {} })).toBeUndefined()
    expect(await url({ ...options, data: { id: 42 } })).toBe('http://127.0.0.1:4324/cms-preview/42')
    expect(livePreview.breakpoints).toEqual([
      { label: 'Phone', name: 'phone', width: 390, height: 844 },
      { label: 'Tablet', name: 'tablet', width: 768, height: 1024 },
      { label: 'Desktop', name: 'desktop', width: 1280, height: 900 },
    ])
  })

  it.each(['create', 'read', 'update', 'delete'] as const)(
    'requires authentication for entry %s',
    async (operation) => {
      const access = Entries.access?.[operation]
      assert(access)

      expect(await access({ req: request() })).toBe(false)
      expect(await access({ req: request(author) })).toBe(true)
    },
  )
})
