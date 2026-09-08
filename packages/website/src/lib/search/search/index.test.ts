import { describe, expect, it } from 'vitest'
import { createSearchDocuments } from '../documents'
import type { SearchDocument } from '../types'
import { createSearchEngine, searchDocuments } from './index'

const documents: SearchDocument[] = [
  {
    id: 'post:accessibility',
    type: 'writing',
    title: 'Accessibility in interfaces',
    summary: 'Notes from testing keyboard navigation.',
    content: 'Focus order should remain predictable as the interface changes.',
    href: '/posts/accessibility',
    category: 'essay',
    topics: ['Accessibility', 'Interfaces'],
    date: '2026-07-20',
    external: false,
  },
  {
    id: 'post:productivity',
    type: 'writing',
    title: 'What my productivity tools taught me',
    summary: 'How my workflow changed after several failed systems.',
    content: 'Neither tool is perfect. That is no longer the standard I use.',
    href: '/posts/productivity',
    category: 'note',
    topics: ['Personal systems'],
    date: '2026-07-18',
    external: false,
  },
  {
    id: 'project:calendar',
    type: 'project',
    title: 'Apple Watch Calendar Widget',
    summary: 'A macOS desktop widget inspired by an Apple Watch calendar face.',
    content: 'A small TypeScript desktop experiment.',
    href: 'https://github.com/caiobep/calendar-widget',
    category: 'Desktop',
    topics: ['TypeScript', 'macOS'],
    external: true,
  },
]

describe('static search', () => {
  const engine = createSearchEngine(documents)

  it('tolerates misspellings in important fields', () => {
    expect(searchDocuments(engine, 'accesibility')[0]?.id).toBe('post:accessibility')
    expect(searchDocuments(engine, 'productivty')[0]?.id).toBe('post:productivity')
  })

  it('searches article body content as well as metadata', () => {
    expect(searchDocuments(engine, 'Focus order should remain predictable')[0]?.id).toBe('post:accessibility')
  })

  it('does not invent body matches for an absent phrase', () => {
    expect(searchDocuments(engine, 'unrelated absent phrase')).toEqual([])
  })

  it('filters by content type and ignores incomplete queries', () => {
    expect(searchDocuments(engine, 'calendar', 'project').map(({ id }) => id)).toEqual([
      'project:calendar',
    ])
    expect(searchDocuments(engine, 'calendar', 'writing').every(({ type }) => type === 'writing')).toBe(true)
    expect(searchDocuments(engine, 'calendar', 'writing').some(({ type }) => type === 'project')).toBe(false)
    expect(searchDocuments(engine, 'a')).toEqual([])
  })
})

describe('search document mapping', () => {
  it('maps post topics and project details into searchable documents', () => {
    const mapped = createSearchDocuments(
      [{
        id: 'older-note',
        body: 'A useful phrase from the article body.',
        data: {
          title: 'Older note',
          summary: 'A note about a useful tool.',
          category: 'note',
          date: '2022-01-01',
          topics: ['Tools'],
        },
      }],
      [{
        id: 'desk-hook',
        body: 'A physical prototype.',
        data: {
          title: 'Desk hook',
          summary: 'A replacement part for my desk.',
          kind: 'physical',
          order: 1,
          category: '3D print',
          technologies: ['PETG'],
        },
      }],
    )

    expect(mapped[0]).toMatchObject({
      href: '/posts/older-note',
      summary: 'A note about a useful tool.',
      topics: ['Tools'],
      type: 'writing',
    })
    expect(mapped[1]).toMatchObject({
      content: 'A physical prototype.',
      href: '/projects/desk-hook',
      topics: ['PETG'],
      type: 'project',
    })
  })
})
