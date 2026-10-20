import { beforeEach, expect, it, vi } from 'vitest'
import { getEntryIndex, getProjectIndex } from './index'

const contentMocks = vi.hoisted(() => ({
  getCollection: vi.fn(),
  cmsEnabled: false,
  cmsOwnsEntries: false,
  getPublishedCmsEntries: vi.fn(),
  mergePublicEntries: vi.fn(),
}))

vi.mock('astro:content', () => contentMocks)
vi.mock('../../cms/mode', () => ({
  get cmsOwnsEntries() {
    return contentMocks.cmsOwnsEntries
  },
  get cmsTrialEnabled() {
    return contentMocks.cmsEnabled
  },
}))
vi.mock('../../cms/entries', () => ({
  getPublishedCmsEntries: contentMocks.getPublishedCmsEntries,
  mergePublicEntries: contentMocks.mergePublicEntries,
}))

const entries = [
  {
    id: 'featured',
    data: {
      category: 'essay',
      date: '2026-07-24',
      featuredOrder: 1,
    },
  },
  {
    id: 'note',
    data: {
      category: 'note',
      date: '2024-01-01',
    },
  },
]

const projects = [
  {
    id: 'featured-tool',
    data: {
      kind: 'software',
      order: 1,
      featuredOrder: 1,
    },
  },
  {
    id: 'desk-hook',
    data: {
      kind: 'physical',
      order: 2,
    },
  },
]

beforeEach(() => {
  contentMocks.cmsEnabled = false
  contentMocks.cmsOwnsEntries = false
  contentMocks.getCollection.mockReset()
  contentMocks.getPublishedCmsEntries.mockReset()
  contentMocks.mergePublicEntries
    .mockReset()
    .mockImplementation((files: unknown[], cms: unknown[]) => [
      ...files,
      ...cms,
    ])
})

it('keeps an unpublished CMS archive entry out of public indexes despite its Markdown backup', async () => {
  contentMocks.cmsEnabled = true
  contentMocks.cmsOwnsEntries = true
  contentMocks.getCollection.mockResolvedValue(entries)
  contentMocks.getPublishedCmsEntries.mockResolvedValue([])

  const index = await getEntryIndex()

  expect(index.entries).toEqual([])
  expect(index.featuredEntries).toEqual([])
  expect(contentMocks.getCollection).not.toHaveBeenCalled()
  expect(contentMocks.mergePublicEntries).toHaveBeenCalledWith([], [])
})

it('builds the entry index in one load', async () => {
  contentMocks.getCollection.mockResolvedValueOnce(entries)

  const index = await getEntryIndex()

  expect(contentMocks.getCollection).toHaveBeenCalledOnce()
  expect(contentMocks.getCollection).toHaveBeenCalledWith('entries')
  expect(contentMocks.getPublishedCmsEntries).not.toHaveBeenCalled()
  expect(contentMocks.mergePublicEntries).not.toHaveBeenCalled()
  expect(index.entries.map(({ id }) => id)).toEqual(['featured', 'note'])
  expect(index.featuredEntries.map(({ id }) => id)).toEqual(['featured'])
  expect(index.otherEntries.map(({ id }) => id)).toEqual(['note'])
  expect(index.counts).toEqual({
    essay: 1,
    note: 1,
    review: 0,
    link: 0,
    video: 0,
    podcast: 0,
    talk: 0,
  })
})

it('adds published CMS entries to every shared entry selector only in trial mode', async () => {
  contentMocks.cmsEnabled = true
  contentMocks.getCollection.mockResolvedValueOnce(entries)
  const cmsEntry = {
    id: 'cms-note',
    body: 'CMS public Markdown',
    collection: 'entries',
    data: {
      title: 'CMS note',
      category: 'note',
      date: '2026-10-11',
      featuredOrder: 100,
      topics: [],
    },
  }
  contentMocks.getPublishedCmsEntries.mockResolvedValueOnce([cmsEntry])
  const index = await getEntryIndex()
  expect(contentMocks.getCollection).toHaveBeenCalledExactlyOnceWith('entries')
  expect(contentMocks.getPublishedCmsEntries).toHaveBeenCalledOnce()
  expect(contentMocks.mergePublicEntries).toHaveBeenCalledWith(entries, [
    cmsEntry,
  ])
  expect(index.entries.map(({ id }) => id)).toEqual([
    'cms-note',
    'featured',
    'note',
  ])
  expect(index.featuredEntries.map(({ id }) => id)).toEqual([
    'featured',
    'cms-note',
  ])
  expect(index.counts.note).toBe(2)
  expect(index.entries.find(({ id }) => id === 'cms-note')?.body).toBe(
    'CMS public Markdown',
  )
})

it('propagates CMS failures and merge conflicts in trial mode', async () => {
  contentMocks.cmsEnabled = true
  contentMocks.getCollection.mockResolvedValue(entries)
  contentMocks.getPublishedCmsEntries.mockRejectedValueOnce(
    new Error('CMS query failed'),
  )
  await expect(getEntryIndex()).rejects.toThrow('CMS query failed')
  contentMocks.getPublishedCmsEntries.mockResolvedValueOnce([])
  contentMocks.mergePublicEntries.mockImplementationOnce(() => {
    throw new Error('slug collision')
  })
  await expect(getEntryIndex()).rejects.toThrow('slug collision')
})

it('builds featured, smaller, and physical project groups in one load', async () => {
  contentMocks.getCollection.mockResolvedValueOnce(projects)

  const index = await getProjectIndex()

  expect(contentMocks.getCollection).toHaveBeenCalledOnce()
  expect(index.projects.map(({ id }) => id)).toEqual([
    'featured-tool',
    'desk-hook',
  ])
  expect(index.featuredProjects.map(({ id }) => id)).toEqual(['featured-tool'])
  expect(index.otherSoftwareProjects).toEqual([])
  expect(index.physicalProjects.map(({ id }) => id)).toEqual(['desk-hook'])
})


it('lists one primary entry per translation group while preserving localized primary links', async () => {
  contentMocks.getCollection.mockResolvedValueOnce([
    ...entries,
    { id: 'en--new', data: { category: 'note', date: '2026-10-19', translation: { key: 'posts/new', primary: true, href: '/en/posts/new' } } },
    { id: 'pt-br--new', data: { category: 'note', date: '2026-10-19', translation: { key: 'posts/new', primary: false, href: '/pt-br/posts/new' } } },
  ])
  const result = await getEntryIndex()
  expect(result.entries.map(entry => entry.id)).toEqual(['en--new', 'featured', 'note'])
})
