import { beforeEach, expect, it, vi } from 'vitest'
import type { ContentPolicyEvent } from 'emdash'
import { createPlugin, validatePublication } from './plugin'

const runtime = vi.hoisted(() => ({
  getCollection: vi.fn(),
  cmsOwnsEntries: false,
  getDb: vi.fn(),
  findMany: vi.fn(),
  findMedia: vi.fn(),
  selectFrom: vi.fn(),
  select: vi.fn(),
  where: vi.fn(),
  findReadyMedia: vi.fn(),
}))
vi.mock('astro:content', () => ({ getCollection: runtime.getCollection }))
vi.mock('../mode', () => ({
  get cmsOwnsEntries() {
    return runtime.cmsOwnsEntries
  },
}))
vi.mock('emdash/runtime', () => ({ getDb: runtime.getDb }))
vi.mock('emdash', () => ({
  definePlugin: (definition: unknown) => definition,
  ContentRepository: class { readonly findMany = runtime.findMany },
  MediaRepository: class { readonly findById = runtime.findMedia },
}))

function event(data: Record<string, unknown> = {}): ContentPolicyEvent {
  return {
    collection: 'posts',
    origin: { source: 'scheduler' },
    content: {
      id: 'native-post-id',
      slug: 'native-note',
      createdAt: '2026-10-11T12:00:00Z',
      data: { title: 'A note', category: 'note', content: [], ...data },
    },
  }
}

beforeEach(() => {
  runtime.cmsOwnsEntries = false
  runtime.getCollection.mockReset().mockResolvedValue([])
  runtime.getDb.mockReset().mockResolvedValue({ selectFrom: runtime.selectFrom })
  const query = { select: runtime.select, where: runtime.where, executeTakeFirst: runtime.findReadyMedia }
  runtime.selectFrom.mockReset().mockReturnValue(query)
  runtime.select.mockReset().mockReturnValue(query)
  runtime.where.mockReset().mockReturnValue(query)
  runtime.findReadyMedia.mockReset().mockResolvedValue({ id: 'photo' })
  runtime.findMany.mockReset().mockResolvedValue({ items: [], nextCursor: undefined })
  runtime.findMedia.mockReset().mockResolvedValue({ status: 'ready', storageKey: 'hero.png' })
})

it('allows migrated posts to publish without colliding with their inactive Markdown backups', async () => {
  runtime.cmsOwnsEntries = true
  runtime.getCollection.mockResolvedValue([
    { id: 'native-note', data: { featuredOrder: 1 } },
  ])

  expect(await validatePublication(event({ featured_order: 1 }))).toBeUndefined()
  expect(runtime.getCollection).not.toHaveBeenCalled()
})

it('registers checks at scheduling and publication without relying on editor authentication', async () => {
  expect(createPlugin()).toMatchObject({
    capabilities: ['content:read', 'hooks.content-policy:register'],
    hooks: {
      'content:beforePublish': validatePublication,
      'content:beforeSchedule': validatePublication,
    },
  })
  expect(await validatePublication(event())).toBeUndefined()
  expect(await validatePublication({ ...event(), collection: 'pages' })).toBeUndefined()
})

it('reads only published live rows across every page when checking featured positions', async () => {
  runtime.findMany
    .mockResolvedValueOnce({ items: [], nextCursor: 'page-two' })
    .mockResolvedValueOnce({
      items: [{ id: 'another', slug: 'another-note', data: { featured_order: 5 } }],
    })
  const decision = await validatePublication(event({ featured_order: 5 }))
  expect(decision?.cancel).toBe(true)
  expect(decision?.reason).toContain('featured position')
  expect(runtime.findMany.mock.calls).toEqual([
    ['posts', { where: { status: 'published' } }],
    ['posts', { where: { status: 'published' }, cursor: 'page-two' }],
  ])
})

it('rejects a static URL collision and allows ready featured media', async () => {
  runtime.getCollection.mockResolvedValue([
    { id: 'native-note', data: { featuredOrder: undefined } },
  ])
  const decision = await validatePublication(event({ featured_image: { id: 'photo' } }))
  expect(decision?.cancel).toBe(true)
  expect(decision?.reason).toContain('URL slug')
  expect(runtime.findMedia).toHaveBeenCalledWith('photo')
})

it('rejects media whose upload is incomplete or has no stored object', async () => {
  for (const media of [null, { status: 'uploading', storageKey: 'photo.png' }, { status: 'ready' }]) {
    runtime.findMedia.mockResolvedValue(media)
    const decision = await validatePublication(event({ featured_image: { id: 'photo' } }))
    expect(decision?.cancel).toBe(true)
    expect(decision?.reason).toContain('uploaded image')
  }
})

it('checks that provided image storage keys belong to a ready media row', async () => {
  const content = [{ _type: 'image', _key: 'photo', asset: { meta: { storageKey: 'photo.png' } } }]
  expect(await validatePublication(event({ content }))).toBeUndefined()
  expect(runtime.selectFrom).toHaveBeenCalledWith('media')
  expect(runtime.where.mock.calls).toEqual([
    ['storage_key', '=', 'photo.png'], ['status', '=', 'ready'],
  ])
  runtime.findReadyMedia.mockResolvedValue(undefined)
  const decision = await validatePublication(event({ content }))
  expect(decision?.cancel).toBe(true)
  expect(decision?.reason).toContain('uploaded image')
})
