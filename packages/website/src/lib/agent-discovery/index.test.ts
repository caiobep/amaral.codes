import { describe, expect, it } from 'vitest'
import type { EntryData, ProjectData } from '../../content/schemas'
import {
  createAgentContentIndex,
  renderLlmsFull,
  renderLlmsIndex,
} from '.'

const site = new URL('https://amaral.codes')

const makeEntry = (
  id: string,
  overrides: Partial<EntryData> = {},
  body = 'What I observed.',
) => ({
  id,
  body,
  data: {
    category: 'note',
    date: '2026-08-17',
    summary: 'A concrete summary.',
    title: 'A useful note',
    topics: ['Software'],
    ...overrides,
  } satisfies EntryData,
})

const makeProject = (id: string, overrides: Partial<ProjectData> = {}) => ({
  id,
  data: {
    category: 'Desktop',
    kind: 'software',
    order: 1,
    summary: 'A small tool I use.',
    technologies: ['TypeScript'],
    title: 'Calendar tool',
    ...overrides,
  } satisfies ProjectData,
})

describe('agent discovery documents', () => {
  it('renders a concise llms.txt from public entries', () => {
    const markdown = renderLlmsIndex({
      entries: [
        makeEntry('featured', { featuredOrder: 1, title: 'A [featured] note' }),
        makeEntry('podcast', { category: 'podcast', podcast: {
          players: [{ service: 'spotify', url: 'https://open.spotify.com/show/example' }],
          show: 'Example show',
          sourceUrl: 'https://example.com/episode',
        }, title: 'An episode' }),
      ],
      projects: [makeProject('calendar', { externalUrl: 'https://github.com/example/calendar' })],
      site,
    })

    expect(markdown).toContain('# Caio Amaral\n\n> Caio Amaral\'s personal site')
    expect(markdown).toContain('## Start here')
    expect(markdown).toContain('[A \\[featured\\] note](https://amaral.codes/posts/featured.md)')
    expect(markdown).toContain('## Podcasts')
    expect(markdown).toContain('[Calendar tool](https://github.com/example/calendar)')
    expect(markdown).toContain('[Content index](https://amaral.codes/content-index.json)')
    expect(markdown).not.toContain('## Essays')
  })

  it('omits absent summaries from discovery documents', () => {
    const entry = makeEntry('without-summary', { summary: undefined })
    const markdown = renderLlmsIndex({ entries: [entry], projects: [], site })
    const index = createAgentContentIndex({ entries: [entry], projects: [], site })

    expect(markdown).toContain('[A useful note](https://amaral.codes/posts/without-summary.md)')
    expect(markdown).not.toContain('undefined')
    expect(index.entries[0]).not.toHaveProperty('summary')
  })

  it('combines public entry bodies in llms-full.txt', () => {
    const markdown = renderLlmsFull({
      entries: [
        makeEntry('published', { title: 'Published note' }, '# Detail\n\nThe result.'),
      ],
      site,
    })

    expect(markdown).toContain('# Caio Amaral: published entries')
    expect(markdown).toContain('# Published note')
    expect(markdown).toContain('## Detail')
  })

  it('keeps an empty full-text document valid', () => {
    expect(renderLlmsFull({ entries: [], site })).toBe(`# Caio Amaral: published entries

> Full text of the published notes, reviews, podcasts, talks, videos, and links on amaral.codes.
`)
  })

})

describe('agent content index', () => {
  it('creates a deterministic versioned contract for every public item', () => {
    const index = createAgentContentIndex({
      entries: [
        makeEntry('talk', {
          category: 'talk',
          language: undefined,
          talk: {
            format: 'talk',
            language: 'pt-BR',
            materials: [{ label: 'Slides', type: 'pdf', url: '/talks/example/slides.pdf' }],
          },
        }),
      ],
      projects: [
        makeProject('local'),
        makeProject('external', { externalUrl: 'https://github.com/example/project', order: 2 }),
      ],
      site,
    })

    expect(index).toEqual({
      schemaVersion: 1,
      site: {
        name: 'Caio Amaral',
        url: 'https://amaral.codes/',
        llms: 'https://amaral.codes/llms.txt',
        fullText: 'https://amaral.codes/llms-full.txt',
      },
      entries: [
        expect.objectContaining({
          id: 'talk',
          language: 'pt-BR',
          urls: {
            html: 'https://amaral.codes/posts/talk',
            markdown: 'https://amaral.codes/posts/talk.md',
          },
        }),
      ],
      projects: [
        expect.objectContaining({
          id: 'local',
          urls: { html: 'https://amaral.codes/projects/local' },
        }),
        expect.objectContaining({
          id: 'external',
          urls: { external: 'https://github.com/example/project' },
        }),
      ],
    })
    expect(JSON.stringify(index)).not.toContain('generatedAt')
    expect(JSON.stringify(index)).not.toContain('status')
  })
})
