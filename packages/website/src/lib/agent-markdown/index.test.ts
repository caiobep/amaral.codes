import { describe, expect, it } from 'vitest'
import type { EntryData } from '../../content/schemas'
import { renderEntryMarkdown } from '.'

const makeEntry = (overrides: Partial<EntryData> = {}): EntryData => ({
  category: 'note',
  date: '2026-08-17',
  summary: 'What changed after I tried it.',
  title: 'A useful note',
  topics: ['Software', 'Tools'],
  ...overrides,
})

describe('renderEntryMarkdown', () => {
  it('renders agent-readable metadata and preserves authored content', () => {
    const markdown = renderEntryMarkdown({
      body: '# First section\n\nThe result.',
      canonicalUrl: 'https://amaral.codes/posts/a-useful-note',
      data: makeEntry({ language: 'pt-BR' }),
    })

    expect(markdown).toBe(`# A useful note

What changed after I tried it.

- Author: Caio Amaral
- Type: Note
- Published: 2026-08-17
- Language: pt-BR
- Topics: Software, Tools
- Canonical: https://amaral.codes/posts/a-useful-note

## First section

The result.
`)
  })

  it('keeps heading-like code intact while lowering article headings', () => {
    const markdown = renderEntryMarkdown({
      body: '```md\n# Example\n```\n\n# Explanation',
      canonicalUrl: 'https://amaral.codes/posts/code',
      data: makeEntry({ topics: [] }),
    })

    expect(markdown).toContain('```md\n# Example\n```')
    expect(markdown).toContain('## Explanation')
    expect(markdown).not.toContain('Topics:')
  })

  it('omits an absent summary without rendering an empty value', () => {
    const markdown = renderEntryMarkdown({
      body: 'The observation.',
      canonicalUrl: 'https://amaral.codes/posts/without-summary',
      data: makeEntry({ summary: undefined, topics: [] }),
    })

    expect(markdown).not.toContain('undefined')
    expect(markdown).toContain('# A useful note\n\n- Author: Caio Amaral')
  })
})

describe('entry media links', () => {
  it('includes podcast destinations and hosted audio', () => {
    const markdown = renderEntryMarkdown({
      body: '',
      canonicalUrl: 'https://amaral.codes/posts/an-episode',
      data: makeEntry({
        category: 'podcast',
        podcast: {
          audioBytes: 1200,
          audioUrl: '/podcasts/an-episode.mp3',
          episode: '12',
          players: [
            { service: 'applePodcasts', url: 'https://podcasts.apple.com/example' },
            { service: 'spotify', url: 'https://open.spotify.com/example' },
            { service: 'pocketCasts', url: 'https://pocketcasts.com/example' },
            { service: 'overcast', url: 'https://overcast.fm/example' },
          ],
          show: 'A podcast',
          sourceUrl: 'https://example.com/episode',
        },
      }),
    })

    expect(markdown).toContain('## Listen')
    expect(markdown).toContain('[Episode notes](https://example.com/episode)')
    expect(markdown).toContain('[Listen to the hosted audio](/podcasts/an-episode.mp3)')
    expect(markdown).toContain('[Listen on Pocket Casts](https://pocketcasts.com/example)')
  })

  it('includes talk materials and omits absent optional sections', () => {
    const markdown = renderEntryMarkdown({
      body: '',
      canonicalUrl: 'https://amaral.codes/posts/a-talk',
      data: makeEntry({
        category: 'talk',
        talk: {
          format: 'talk',
          language: 'pt-BR',
          materials: [{ label: 'Slide deck', type: 'pdf', url: '/talks/a-talk/slides.pdf' }],
        },
        topics: [],
      }),
    })

    expect(markdown).toContain('## Materials\n- [Slide deck](/talks/a-talk/slides.pdf)')
    expect(markdown).not.toContain('## Listen')
    expect(markdown).toContain('- Language: pt-BR')
    expect(markdown).toContain('Canonical: https://amaral.codes/posts/a-talk')
    expect(markdown).toMatch(/\[Slide deck\]\(\/talks\/a-talk\/slides\.pdf\)\n$/u)
  })
})
