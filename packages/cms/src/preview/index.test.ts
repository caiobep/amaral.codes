import { convertLexicalToHTML } from '@payloadcms/richtext-lexical/html'
import type { Payload, PayloadRequest } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Entry, User } from '../payload-types'
import type { EntryInput } from '../entry-data'
import { previewEntry } from './index'

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

const draftEntry: Entry = {
  id: 42,
  title: '  A smaller publishing loop  ',
  slug: 'a-smaller-publishing-loop',
  summary: '  What changed after trying a private editor.  ',
  category: 'note',
  date: '2026-09-01T12:00:00.000Z',
  language: 'en',
  topics: [' Writing '],
  body: {
    root: {
      type: 'root',
      children: [{
        type: 'paragraph',
        version: 1,
        children: [{
          type: 'text', text: 'A draft paragraph.', version: 1,
          detail: 0, format: 0, mode: 'normal', style: '',
        }],
        direction: null,
        format: '',
        indent: 0,
      }],
      direction: null,
      format: '',
      indent: 0,
      version: 1,
    },
  },
  _status: 'draft',
  createdAt: '2026-09-01T12:00:00.000Z',
  updatedAt: '2026-09-02T12:00:00.000Z',
}

const publicData = {
  title: 'A smaller publishing loop',
  summary: 'What changed after trying a private editor.',
  category: 'note',
  date: '2026-09-01T12:00:00.000Z',
  language: 'en',
  topics: ['Writing'],
}

type FindEntryByID = (options: Parameters<Payload['findByID']>[0]) => Promise<EntryInput>

function request(
  overrides: Partial<Pick<PayloadRequest, 'user' | 'query' | 'routeParams'>> = {},
  entry: EntryInput = draftEntry,
) {
  const findByID = vi.fn<FindEntryByID>().mockResolvedValue(entry)
  const req = {
    user: author,
    query: {},
    routeParams: { id: entry.id },
    ...overrides,
    payload: { findByID },
  } satisfies Pick<PayloadRequest, 'user' | 'query' | 'routeParams'> & {
    payload: { findByID: FindEntryByID }
  }

  return { req: req as unknown as PayloadRequest, findByID }
}

function expectPrivateHeaders(response: Response) {
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow, noarchive')
  expect(response.headers.get('Vary')).toBe('Cookie')
}

beforeEach(() => {
  vi.mocked(convertLexicalToHTML).mockReset().mockReturnValue('<p>A draft paragraph.</p>')
})

describe('preview authentication', () => {
  it.each([{}, { revision: 'published' }])('rejects unauthenticated requests before reading: %j', async (query) => {
    const { req, findByID } = request({ user: null, query, routeParams: undefined })
    req.headers = new Headers({ Cookie: 'amaral-cms-trial-token=unverified' })

    const response = await previewEntry(req)

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Sign in to preview.' })
    expectPrivateHeaders(response)
    expect(findByID).not.toHaveBeenCalled()
    expect(convertLexicalToHTML).not.toHaveBeenCalled()
  })
})

describe('draft preview', () => {
  it('renders the talk recording as an escaped link without adding CMS fields to metadata', async () => {
    const { req } = request({}, {
      ...draftEntry, category: 'talk', talk: {
        recordingUrl: 'https://example.com/watch?q="clip"&caption=<talk>',
        materials: [{ label: 'Slides', source: 'url', type: 'pdf', url: 'https://example.com/slides.pdf' }],
      },
    })
    const response = await previewEntry(req)
    expect(response.status).toBe(200)
    expectPrivateHeaders(response)
    expect(await response.json()).toMatchObject({
      html: '<p><a href="https://example.com/watch?q=&quot;clip&quot;&amp;caption=&lt;talk&gt;">Watch the recording</a></p><p>A draft paragraph.</p>',
      data: { talk: { format: 'talk', materials: [{ label: 'Slides', type: 'pdf', url: 'https://example.com/slides.pdf' }] } },
    })
  })

  it('reports an invalid recording URL as incomplete preview metadata', async () => {
    const { req } = request({}, {
      ...draftEntry, category: 'talk', talk: {
        recordingUrl: 'javascript:alert(1)',
        materials: [{ label: 'Slides', source: 'url', type: 'pdf', url: 'https://example.com/slides.pdf' }],
      },
    })
    const response = await previewEntry(req)
    expect(response.status).toBe(422)
    expect(convertLexicalToHTML).not.toHaveBeenCalled()
  })

  it.each([{}, { revision: 'draft' }, { revision: 'Published' }])(
    'reads the draft with request-scoped access and normalized public data: %j',
    async (query) => {
      const { req, findByID } = request({ query })

      const response = await previewEntry(req)

      expect(findByID).toHaveBeenCalledExactlyOnceWith({
        collection: 'entries', id: 42, draft: true, depth: 2, overrideAccess: false, req,
      })
      expect(findByID.mock.calls[0]?.[0].req).toBe(req)
      expect(response.status).toBe(200)
      expectPrivateHeaders(response)
      expect(await response.json()).toEqual({
        id: draftEntry.slug, data: publicData, html: '<p>A draft paragraph.</p>', revision: 'draft',
      })
      expect(convertLexicalToHTML).toHaveBeenCalledExactlyOnceWith({ data: draftEntry.body })
    },
  )

  it('keeps the requested draft revision even when the document is already published', async () => {
    const { req, findByID } = request({}, { ...draftEntry, _status: 'published' })

    const response = await previewEntry(req)

    expect(findByID).toHaveBeenCalledExactlyOnceWith({
      collection: 'entries', id: 42, draft: true, depth: 2, overrideAccess: false, req,
    })
    expect(await response.json()).toMatchObject({ revision: 'draft' })
  })
})

describe('published preview', () => {
  it('reads only the published revision without bypassing access', async () => {
    const { req, findByID } = request(
      { query: { revision: 'published' }, routeParams: { id: '42' } },
      { ...draftEntry, _status: 'published' },
    )
    vi.mocked(convertLexicalToHTML).mockReturnValue('<p>The published paragraph.</p>')

    const response = await previewEntry(req)

    expect(findByID).toHaveBeenCalledExactlyOnceWith({
      collection: 'entries', id: '42', draft: false, depth: 2, overrideAccess: false, req,
    })
    expect(response.status).toBe(200)
    expectPrivateHeaders(response)
    expect(await response.json()).toEqual({
      id: draftEntry.slug, data: publicData, html: '<p>The published paragraph.</p>', revision: 'published',
    })
    expect(convertLexicalToHTML).toHaveBeenCalledExactlyOnceWith({ data: draftEntry.body })
  })

  it.each(['draft', null, undefined] as const)('does not expose a %s document as published', async (_status) => {
    const { req, findByID } = request(
      { query: { revision: 'published' } },
      { ...draftEntry, _status },
    )

    const response = await previewEntry(req)

    expect(findByID).toHaveBeenCalledExactlyOnceWith({
      collection: 'entries', id: 42, draft: false, depth: 2, overrideAccess: false, req,
    })
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'This note has not been published.' })
    expectPrivateHeaders(response)
    expect(convertLexicalToHTML).not.toHaveBeenCalled()
  })
})

describe('preview read failures', () => {
  it('propagates a denied read without rendering or retrying with elevated access', async () => {
    const { req, findByID } = request()
    const denied = new Error('Entry is not accessible.')
    findByID.mockRejectedValue(denied)

    await expect(previewEntry(req)).rejects.toBe(denied)

    expect(findByID).toHaveBeenCalledExactlyOnceWith({
      collection: 'entries', id: 42, draft: true, depth: 2, overrideAccess: false, req,
    })
    expect(convertLexicalToHTML).not.toHaveBeenCalled()
  })

  it.each([
    undefined,
    {},
    { id: undefined },
    { id: null },
    { id: false },
    { id: { value: 42 } },
    { id: ['42'] },
  ])('rejects missing or malformed entry IDs before reading: %j', async (routeParams) => {
    const { req, findByID } = request({ routeParams })

    await expect(previewEntry(req)).rejects.toThrow('Missing preview ID.')

    expect(findByID).not.toHaveBeenCalled()
    expect(convertLexicalToHTML).not.toHaveBeenCalled()
  })

  it('explains invalid draft metadata before converting the document body', async () => {
    const { req, findByID } = request({}, { ...draftEntry, date: 'eventually' })

    const response = await previewEntry(req)
    expect(response.status).toBe(422)
    expectPrivateHeaders(response)
    expect(await response.json()).toEqual({ error: 'Finish this draft to preview.' })

    expect(findByID).toHaveBeenCalledTimes(1)
    expect(convertLexicalToHTML).not.toHaveBeenCalled()
  })

  it.each(['', ' ', null, undefined])('handles a draft with an unfinished slug: %j', async (slug) => {
    const entry = { ...draftEntry, slug } as Entry
    const { req } = request({}, entry)
    const response = await previewEntry(req)
    expect(response.status).toBe(422)
    expectPrivateHeaders(response)
    expect(convertLexicalToHTML).not.toHaveBeenCalled()
  })

  it('does not disguise unexpected rendering errors as invalid draft fields', async () => {
    const { req } = request()
    const error = new Error('Rendering failed.')
    vi.mocked(convertLexicalToHTML).mockImplementationOnce(() => { throw error })
    await expect(previewEntry(req)).rejects.toBe(error)
  })

  it('handles a saved draft without a body', async () => {
    const entry = { ...draftEntry, body: undefined } as unknown as Entry
    const { req } = request({}, entry)
    const response = await previewEntry(req)
    expect(response.status).toBe(422)
    expectPrivateHeaders(response)
    expect(convertLexicalToHTML).not.toHaveBeenCalled()
  })
})
