import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getEntryIndex, getProjectIndex } from './index'

const contentMocks = vi.hoisted(() => ({ getCollection: vi.fn() }))

vi.mock('astro:content', () => contentMocks)

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

describe('content queries', () => {
  beforeEach(() => contentMocks.getCollection.mockReset())

  it('builds the entry index in one load', async () => {
    contentMocks.getCollection.mockResolvedValueOnce(entries)

    const index = await getEntryIndex()

    expect(contentMocks.getCollection).toHaveBeenCalledOnce()
    expect(contentMocks.getCollection).toHaveBeenCalledWith('entries')
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

  it('builds featured, smaller, and physical project groups in one load', async () => {
    contentMocks.getCollection.mockResolvedValueOnce(projects)

    const index = await getProjectIndex()

    expect(contentMocks.getCollection).toHaveBeenCalledOnce()
    expect(index.projects.map(({ id }) => id)).toEqual(['featured-tool', 'desk-hook'])
    expect(index.featuredProjects.map(({ id }) => id)).toEqual(['featured-tool'])
    expect(index.otherSoftwareProjects).toEqual([])
    expect(index.physicalProjects.map(({ id }) => id)).toEqual(['desk-hook'])
  })
})
