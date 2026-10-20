import type { CollectionEntry } from 'astro:content'
import { beforeEach, expect, it, vi } from 'vitest'
import {
  getCmsArticle,
  getPublishedCmsEntries,
  isCmsEntry,
  mapCmsEntry,
  mergePublicEntries,
} from './entries'

const cms = vi.hoisted(() => ({
  context: undefined as
    | undefined
    | {
        editMode: boolean
        preview?: { collection: string; id: string }
        locale?: string
      },
  getEmDashCollection: vi.fn(),
  getEmDashEntry: vi.fn(),
  findMediaById: vi.fn(),
  runWithContext: vi.fn(),
}))
vi.mock('emdash', () => ({
  getEmDashCollection: cms.getEmDashCollection,
  getEmDashEntry: cms.getEmDashEntry,
  getRequestContext: () => cms.context,
  runWithContext: cms.runWithContext,
  MediaRepository: class {
    readonly findById = cms.findMediaById
  },
}))
vi.mock('emdash/runtime', () => ({ getDb: vi.fn() }))

function nativeEntry(
  slug = 'cms-note',
  metadata: Record<string, unknown> = {},
) {
  return {
    id: slug,
    data: {
      id: 'native-database-id',
      title: 'A CMS note',
      category: 'note',
      date: '2026-10-11T12:00:00Z',
      language: 'pt-BR',
      excerpt: 'A public summary.',
      topics: ['publishing'],
      featured_order: 100,
      status: 'published',
      draftRevisionId: 'private-draft',
      authorId: 'private-author',
      content: [
        {
          _type: 'block',
          _key: 'synthetic-block',
          children: [{ _type: 'span', text: 'Public body', marks: [] }],
        },
      ],
      ...metadata,
    },
  }
}

beforeEach(() => {
  vi.stubEnv('AMARAL_CMS_TRIAL', '0')
  cms.context = undefined
  cms.getEmDashCollection.mockReset()
  cms.getEmDashEntry.mockReset()
  cms.findMediaById.mockReset()
  cms.runWithContext
    .mockReset()
    .mockImplementation((_context, callback: () => unknown) => callback())
})

it('returns real collection-shaped entries with schema-validated public fields only', () => {
  const entry = mapCmsEntry(nativeEntry())
  expect(entry).toEqual({
    id: 'cms-note',
    collection: 'entries',
    body: 'Public body',
    data: {
      title: 'A CMS note',
      category: 'note',
      date: '2026-10-11T12:00:00Z',
      language: 'pt-BR',
      summary: 'A public summary.',
      topics: ['publishing'],
      featuredOrder: 100,
      podcast: undefined,
      talk: undefined,
    },
  })
  expect(isCmsEntry(entry)).toBe(true)
  expect(JSON.stringify(entry)).not.toMatch(
    /native-database-id|private-draft|private-author|published/,
  )
})
it('uses actual publication/creation dates when optional custom date is unset', () => {
  expect(
    mapCmsEntry(
      nativeEntry('published-note', {
        date: null,
        publishedAt: new Date('2026-10-10T12:00:00Z'),
      }),
    ).data.date,
  ).toBe('2026-10-10T12:00:00.000Z')
  expect(
    mapCmsEntry(
      nativeEntry('created-note', {
        date: undefined,
        publishedAt: null,
        createdAt: new Date('2026-10-09T12:00:00Z'),
      }),
    ).data.date,
  ).toBe('2026-10-09T12:00:00.000Z')
  expect(() =>
    mapCmsEntry(nativeEntry('undated-note', { date: undefined })),
  ).toThrow()
})
it('normalizes absent optional fields without inventing required podcast or talk metadata', () => {
  const entry = mapCmsEntry(
    nativeEntry('plain-note', {
      excerpt: '',
      language: null,
      topics: null,
      featured_order: null,
    }),
  )
  expect(entry.data.summary).toBeUndefined()
  expect(entry.data.language).toBeUndefined()
  expect(entry.data.topics).toEqual([])
  expect(entry.data.featuredOrder).toBeUndefined()
  expect(() =>
    mapCmsEntry(nativeEntry('podcast', { category: 'podcast' })),
  ).toThrow()
  expect(() => mapCmsEntry(nativeEntry('talk', { category: 'talk' }))).toThrow()
  expect(() =>
    mapCmsEntry(nativeEntry('invalid-language', { language: 'fr' })),
  ).toThrow()
})
it('refuses native database IDs or noncanonical slugs as public entry identity', () => {
  expect(() => mapCmsEntry(nativeEntry('native-database-id'))).toThrow(
    'canonical public slug',
  )
  expect(() => mapCmsEntry(nativeEntry('Upper Case Slug'))).toThrow(
    'canonical public slug',
  )
})
it('does not query CMS when the trial is disabled', async () => {
  expect(await getPublishedCmsEntries()).toEqual([])
  expect(await getCmsArticle('cms-note')).toMatchObject({
    entry: null,
    publicEntry: undefined,
    isPreview: false,
  })
  expect(cms.getEmDashCollection).not.toHaveBeenCalled()
  expect(cms.getEmDashEntry).not.toHaveBeenCalled()
})
it('forces collection reads outside native draft preview/edit context and filters unpublished records', async () => {
  vi.stubEnv('AMARAL_CMS_TRIAL', '1')
  cms.context = {
    editMode: true,
    preview: { collection: 'posts', id: 'private-draft' },
    locale: 'pt-BR',
  }
  cms.getEmDashCollection.mockResolvedValue({
    entries: [
      nativeEntry(),
      nativeEntry('draft', { status: 'draft' }),
      nativeEntry('scheduled', { status: 'scheduled' }),
    ],
  })
  expect((await getPublishedCmsEntries()).map(entry => entry.id)).toEqual([
    'cms-note',
  ])
  expect(cms.getEmDashCollection).toHaveBeenCalledWith('posts', {
    status: 'published',
  })
  expect(cms.runWithContext).toHaveBeenCalledWith(
    { editMode: false, locale: 'pt-BR' },
    expect.any(Function),
  )
  expect(cms.context.preview).toBeDefined()
})
it('propagates collection errors instead of hiding failed publishing data', async () => {
  vi.stubEnv('AMARAL_CMS_TRIAL', '1')
  const error = new Error('synthetic database failure')
  cms.getEmDashCollection.mockResolvedValue({ entries: [], error })
  await expect(getPublishedCmsEntries()).rejects.toBe(error)
})
it('leaves signed native article preview active while validating the presentation entry', async () => {
  vi.stubEnv('AMARAL_CMS_TRIAL', '1')
  const draft = nativeEntry('cms-draft', {
    status: 'draft',
    title: 'Private preview title',
  })
  cms.getEmDashEntry.mockResolvedValue({
    entry: draft,
    isPreview: true,
    cacheHint: {},
  })
  const result = await getCmsArticle('cms-draft')
  expect(result.entry).toBe(draft)
  expect(result.isPreview).toBe(true)
  expect(result.publicEntry?.data.title).toBe('Private preview title')
  expect(result.publicEntry?.data).not.toHaveProperty('status')
  expect(result.renderFields).toEqual({
    databaseId: 'native-database-id',
    content: draft.data.content,
    featuredImage: undefined,
  })
  expect(result.renderFields?.content).toBe(draft.data.content)
  expect(cms.runWithContext).not.toHaveBeenCalled()
})
it('returns unknown/native failures without constructing a presentation entry', async () => {
  vi.stubEnv('AMARAL_CMS_TRIAL', '1')
  const result = {
    entry: null,
    error: new Error('synthetic failure'),
    isPreview: false,
    cacheHint: {},
  }
  cms.getEmDashEntry.mockResolvedValue(result)
  expect(await getCmsArticle('missing')).toEqual({
    ...result,
    publicEntry: undefined,
    renderFields: undefined,
  })
})
it('resolves native inline and featured media through ready stored media without public database IDs', async () => {
  vi.stubEnv('AMARAL_CMS_TRIAL', '1')
  cms.findMediaById.mockResolvedValue({
    status: 'ready',
    storageKey: 'synthetic-photo.png',
    mimeType: 'image/png',
    width: 1200,
    height: 800,
  })
  const native = nativeEntry('photo-note', {
    content: [
      {
        _type: 'image',
        _key: 'native-image',
        alt: 'A photo',
        asset: { _ref: 'native-media-id' },
      },
    ],
    featured_image: { id: 'native-media-id', alt: 'Featured photo' },
  })
  cms.getEmDashEntry.mockResolvedValue({
    entry: native,
    isPreview: false,
    cacheHint: {},
  })
  const result = await getCmsArticle('photo-note')
  expect(result.publicEntry?.body).toBe(
    '![A photo](/_emdash/api/media/file/synthetic-photo.png)',
  )
  expect(JSON.stringify(result.publicEntry)).not.toContain('native-media-id')
  expect(result.renderFields?.featuredImage).toEqual({
    id: 'native-media-id',
    provider: 'local',
    meta: { storageKey: 'synthetic-photo.png', mimeType: 'image/png' },
    width: 1200,
    height: 800,
    alt: 'Featured photo',
  })
  expect(result.renderFields?.content).toBe(native.data.content)
  expect(cms.findMediaById).toHaveBeenCalledWith('native-media-id')
})
it('renders a native featured image without an optional alt property', async () => {
  vi.stubEnv('AMARAL_CMS_TRIAL', '1')
  cms.findMediaById.mockResolvedValue({
    status: 'ready',
    storageKey: 'synthetic-photo.png',
  })
  cms.getEmDashEntry.mockResolvedValue({
    entry: nativeEntry('photo-note', {
      featured_image: { id: 'native-media-id' },
      content: null,
    }),
    isPreview: false,
    cacheHint: {},
  })
  const result = await getCmsArticle('photo-note')
  expect(result.renderFields?.content).toEqual([])
  expect(result.renderFields?.featuredImage).not.toHaveProperty('alt')
})
it.each([
  null,
  { status: 'pending', storageKey: 'synthetic-photo.png' },
  { status: 'ready', storageKey: '' },
])('refuses unresolved or unfinished native media: %s', async media => {
  vi.stubEnv('AMARAL_CMS_TRIAL', '1')
  cms.findMediaById.mockResolvedValue(media)
  cms.getEmDashEntry.mockResolvedValue({
    entry: nativeEntry('photo-note', {
      featured_image: { id: 'native-media-id' },
    }),
    isPreview: false,
    cacheHint: {},
  })
  await expect(getCmsArticle('photo-note')).rejects.toThrow(
    'durable stored media',
  )
})
it.each([
  {
    content: [{ _type: 'block', children: [{ _type: 'span', text: 'Body' }] }],
  },
  { content: [null] },
  { content: ['invalid block'] },
  { content: [{}] },
  { content: [{ _type: 123, _key: 'synthetic-key' }] },
  { content: [{ _type: 'block', _key: 123 }] },
  { content: 'invalid content array' },
])('refuses malformed native renderer data: %s', async ({ content }) => {
  vi.stubEnv('AMARAL_CMS_TRIAL', '1')
  cms.getEmDashEntry.mockResolvedValue({
    entry: nativeEntry('bad-note', { content }),
    isPreview: false,
    cacheHint: {},
  })
  await expect(getCmsArticle('bad-note')).rejects.toThrow(
    'Each content block needs its native type and key before publishing.',
  )
  expect(cms.findMediaById).not.toHaveBeenCalled()
})
it('merges file and CMS records while refusing slug and featured-order collisions', () => {
  const file: CollectionEntry<'entries'> = {
    id: 'file-note',
    collection: 'entries',
    body: 'File body',
    data: {
      title: 'File note',
      date: '2026-10-01',
      category: 'note',
      topics: [],
      featuredOrder: 1,
    },
  }
  const cmsEntry = mapCmsEntry(nativeEntry())
  expect(mergePublicEntries([file], [cmsEntry])).toEqual([file, cmsEntry])
  expect(isCmsEntry(file)).toBe(false)
  expect(() =>
    mergePublicEntries([file], [mapCmsEntry(nativeEntry(file.id))]),
  ).toThrow('slug collision')
  expect(() =>
    mergePublicEntries(
      [file],
      [mapCmsEntry(nativeEntry('different-note', { featured_order: 1 }))],
    ),
  ).toThrow('featured order')
  expect(
    mergePublicEntries(
      [file],
      [mapCmsEntry(nativeEntry('unfeatured-note', { featured_order: null }))],
    ),
  ).toHaveLength(2)
})
