import { describe, expect, it } from 'vitest'
import { ZodError } from 'zod'
import type { Entry } from '../payload-types'
import { toEntryData, toRecordingUrl, type EntryInput } from './index'

function entry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 42,
    title: '  A smaller publishing loop  ',
    slug: 'a-smaller-publishing-loop',
    summary: '  What changed after trying a private editor.  ',
    category: 'note',
    date: ' 2026-09-01T12:00:00.000Z ',
    language: 'en',
    topics: [' Writing ', ' Tools '],
    body: {
      root: {
        type: 'root', children: [], direction: null, format: '', indent: 0, version: 1,
      },
    },
    _status: 'draft',
    createdAt: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-09-02T12:00:00.000Z',
    ...overrides,
  }
}

describe('toEntryData', () => {
  it('normalizes public metadata through the content contract without exposing CMS fields', () => {
    const source = entry()
    const original = structuredClone(source)

    expect(toEntryData(source)).toEqual({
      title: 'A smaller publishing loop',
      summary: 'What changed after trying a private editor.',
      category: 'note',
      date: '2026-09-01T12:00:00.000Z',
      language: 'en',
      topics: ['Writing', 'Tools'],
    })
    expect(source).toEqual(original)
  })

  it.each([null, undefined])('normalizes %s optional metadata to contract defaults', (missing) => {
    expect(toEntryData(entry({ summary: missing, language: missing, topics: missing })))
      .toEqual({
        title: 'A smaller publishing loop',
        summary: undefined,
        category: 'note',
        date: '2026-09-01T12:00:00.000Z',
        language: undefined,
        topics: [],
      })
  })

  it('treats an empty summary as absent and preserves the selected language', () => {
    const data = toEntryData(entry({ summary: '', language: 'pt-BR', topics: [] }))

    expect(data.summary).toBeUndefined()
    expect(data.language).toBe('pt-BR')
    expect(data.topics).toEqual([])
  })

  it.each(['note', 'essay', 'review', 'link', 'video'] as const)(
    'preserves the supported %s category',
    (category) => {
      expect(toEntryData(entry({ category })).category).toBe(category)
    },
  )

  it.each([
    { title: ' ' },
    { date: 'eventually' },
    { summary: ' ' },
    { summary: 'undefined' },
    { topics: [''] },
  ])('rejects metadata that fails the public contract: %j', (invalid) => {
    expect(() => toEntryData(entry(invalid))).toThrow(ZodError)
  })
})

describe('format metadata', () => {
  const podcast = {
    show: 'Example show', sourceUrl: 'https://example.com/episode',
    players: [{ service: 'spotify', url: 'https://open.spotify.com/episode/example' }],
  }
  const talk = {
    materials: [{ label: 'Slides', source: 'url', type: 'pdf', url: 'https://example.com/slides.pdf' }],
  }

  it('preserves podcast and talk metadata through the existing public schema', () => {
    expect(toEntryData({ ...entry(), category: 'podcast', podcast }).podcast).toEqual(podcast)
    expect(toEntryData({ ...entry(), category: 'talk', talk }).talk).toMatchObject({
      format: 'talk', materials: [{ label: 'Slides', type: 'pdf', url: 'https://example.com/slides.pdf' }],
    })
  })

  it('ignores stale hidden format groups after switching categories', () => {
    const source = { ...entry(), podcast: { invalid: true }, talk: { invalid: true } }
    expect(toEntryData(source)).toEqual(toEntryData(entry()))
    expect(toRecordingUrl(source)).toBeUndefined()
  })

  it.each([
    { category: 'podcast', podcast: {} },
    { category: 'podcast', podcast: { ...podcast, players: [] } },
    { category: 'podcast', podcast: { ...podcast, players: [podcast.players[0], podcast.players[0]] } },
    { category: 'podcast', podcast: { ...podcast, sourceUrl: 'http://example.com' } },
    { category: 'talk', talk: { materials: [] } },
    { category: 'talk', talk: { ...talk, language: 'fr' } },
  ] satisfies EntryInput[])('rejects unfinished or invalid preview metadata %j', (metadata) => {
    expect(() => toEntryData({ ...entry(), ...metadata })).toThrow(ZodError)
  })

  it('exposes recordings separately without extending public frontmatter', () => {
    const source: EntryInput = { ...entry(), category: 'talk', talk: { ...talk, recordingUrl: 'https://example.com/video' } }
    expect(toRecordingUrl(source)).toBe('https://example.com/video')
    expect(toEntryData(source).talk).not.toHaveProperty('recordingUrl')
  })
})
