import { describe, expect, it } from 'vitest'
import {
  countEntriesByCategory,
  formatTechnologies,
  getEntryTopics,
  getProjectHref,
  isExternalProject,
  selectFeaturedEntries,
  selectFeaturedProjects,
  selectOtherProjects,
  selectProjectsByKind,
  sortEntriesNewestFirst,
  sortProjects,
  selectEntriesByCategory,
  selectNextReads,
  selectUnfeaturedEntries,
  type EntryRecord,
  type ProjectRecord,
} from './index'

const makeEntry = (
  id: string,
  data: Partial<EntryRecord['data']> = {},
): EntryRecord => ({
  id,
  data: {
    category: 'note',
    date: '2026-01-01',
    ...data,
  },
})

const makeProject = (
  id: string,
  data: Partial<ProjectRecord['data']> = {},
): ProjectRecord => ({
  id,
  data: {
    kind: 'software',
    order: 1,
    ...data,
  },
})

describe('entry selectors', () => {
  it('orders public entries without mutating the source', () => {
    const input = [
      makeEntry('older', { date: '2024-01-01' }),
      makeEntry('newer', { date: '2026-01-01' }),
    ]

    expect(sortEntriesNewestFirst(input).map((entry) => entry.id)).toEqual(['newer', 'older'])
    expect(input.map((entry) => entry.id)).toEqual(['older', 'newer'])
  })

  it('separates featured and unfeatured entries', () => {
    const entries = [
      makeEntry('featured', { featuredOrder: 1 }),
      makeEntry('other'),
    ]

    expect(selectUnfeaturedEntries(entries).map((entry) => entry.id)).toEqual(['other'])
  })

  it('uses featuredOrder and rejects ambiguous featured ordering', () => {
    const featured = [
      makeEntry('second', { featuredOrder: 2 }),
      makeEntry('first', { featuredOrder: 1 }),
    ]

    expect(selectFeaturedEntries(featured).map((entry) => entry.id)).toEqual(['first', 'second'])
    expect(() => selectFeaturedEntries([
      ...featured,
      makeEntry('duplicate', { featuredOrder: 1 }),
    ])).toThrow('Duplicate entry featuredOrder 1')
  })

  it('counts categories and deduplicates topics', () => {
    const entries = [
      makeEntry('essay', { category: 'essay' }),
      makeEntry('review', { category: 'review' }),
      makeEntry('note'),
    ]

    expect(countEntriesByCategory(entries)).toEqual({
      essay: 1,
      note: 1,
      review: 1,
      link: 0,
      video: 0,
      podcast: 0,
      talk: 0,
    })
    expect(selectEntriesByCategory(entries, 'review').map((entry) => entry.id)).toEqual(['review'])
    expect(getEntryTopics(makeEntry('new', { topics: ['Software', 'Software'] }))).toEqual(['Software'])
  })

  it('selects stable reading suggestions without mutating the source', () => {
    const entries = [
      makeEntry('current'),
      makeEntry('essay', { category: 'essay' }),
      makeEntry('review', { category: 'review' }),
      makeEntry('podcast', { category: 'podcast' }),
    ]

    const firstSelection = selectNextReads(entries, 'current')

    expect(firstSelection.map((entry) => entry.id).sort()).toEqual(['essay', 'review'])
    expect(selectNextReads(entries, 'current')).toEqual(firstSelection)
    expect(entries.map((entry) => entry.id)).toEqual([
      'current',
      'essay',
      'review',
      'podcast',
    ])
  })
})

describe('project selectors', () => {
  it('orders projects and filters by kind', () => {
    const projects = [
      makeProject('second', { order: 2 }),
      makeProject('physical', { kind: 'physical', order: 1 }),
    ]

    const sorted = sortProjects(projects)
    expect(sorted.map((project) => project.id)).toEqual(['physical', 'second'])
    expect(selectProjectsByKind(sorted, 'physical').map((project) => project.id)).toEqual(['physical'])
  })

  it('separates featured and other projects and rejects duplicate ranks', () => {
    const projects = [
      makeProject('other', { order: 3 }),
      makeProject('featured-two', { order: 2, featuredOrder: 2 }),
      makeProject('featured-one', { order: 1, featuredOrder: 1 }),
    ]

    expect(selectFeaturedProjects(projects).map((project) => project.id)).toEqual([
      'featured-one',
      'featured-two',
    ])
    expect(selectOtherProjects(projects).map((project) => project.id)).toEqual(['other'])
    expect(() => sortProjects([
      makeProject('one', { order: 1 }),
      makeProject('also-one', { order: 1 }),
    ])).toThrow('Duplicate project order 1')
  })

  it('builds internal and external links and formats technologies', () => {
    const local = makeProject('desk-hook', {
      kind: 'physical',
      technologies: ['PETG', 'Bambu Lab P1S'],
    })
    const external = makeProject('tool', { externalUrl: 'https://example.com/tool' })

    expect(getProjectHref(local)).toBe('/projects/desk-hook')
    expect(getProjectHref(external)).toBe('https://example.com/tool')
    expect(isExternalProject(local)).toBe(false)
    expect(isExternalProject(external)).toBe(true)
    expect(formatTechnologies(local)).toBe('PETG / Bambu Lab P1S')
  })
})
