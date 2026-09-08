import { describe, expect, it } from 'vitest'
import { createArticleDescription } from '.'

const createDescription = (overrides: Partial<Parameters<typeof createArticleDescription>[0]> = {}) => (
  createArticleDescription({
    contentHtml: '<p>Content fallback.</p>',
    title: 'Example article',
    ...overrides,
  })
)

describe('createArticleDescription', () => {
  it('preserves an authored summary while normalizing its whitespace', () => {
    expect(createDescription({
      contentHtml: '<p>This content should not replace the summary.</p>',
      summary: '  An authored summary\nwith deliberate wording.  ',
    })).toBe('An authored summary with deliberate wording.')
  })

  it('derives a readable fallback from public prose when the summary is absent', () => {
    expect(createDescription({
      contentHtml: [
        '<h2>Implementation details</h2>',
        '<p><img src="diagram.webp" alt="A diagram"></p>',
        '<p>JavaScript <code>Map</code> values &#x26; plain objects &#38; arrays &amp; sets.</p>',
        '<blockquote><p>The comparison uses insertion order.</p></blockquote>',
      ].join(''),
    })).toBe(
      'JavaScript Map values & plain objects & arrays & sets. The comparison uses insertion order.',
    )
  })

  it('creates different fallbacks for entries with different content', () => {
    const first = createDescription({ contentHtml: '<p>A note about image optimization.</p>' })
    const second = createDescription({ contentHtml: '<p>A note about parallel processing.</p>' })

    expect(first).not.toBe(second)
  })

  it('caps descriptions at 160 characters without splitting the final word', () => {
    const description = createDescription({
      summary: 'Architecture decisions should remain explicit and traceable across application boundaries. '
        + 'This authored summary intentionally continues beyond the metadata limit so it must be shortened.',
    })

    expect(description).toHaveLength(159)
    expect(description).toBe(
      'Architecture decisions should remain explicit and traceable across application boundaries. '
      + 'This authored summary intentionally continues beyond the metadata...',
    )
  })

  it('uses the public title when the entry has no readable prose', () => {
    expect(createDescription({
      contentHtml: '<figure><img src="cover.webp" alt="Cover"></figure>',
      title: 'A visual field note',
    })).toBe('A visual field note by Caio Amaral.')
  })
})
