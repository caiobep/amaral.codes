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
  it('derives CMS descriptions from prose without exposing code, image URLs, or raw markup', () => {
    expect(createDescription({
      contentHtml: '',
      contentMarkdown: '# Heading\n\nUseful **prose** with `Map` and [links](https://example.com/private-path).\n\n![Image alt](https://example.com/photo.png)\n\n```js\nconst secret = "do not describe code";\n```\n\n<script>ignored()</script>\n\n- Another thought.',
    })).toBe('Useful prose with Map and links. Another thought.')
  })

  it('keeps rendered prose and authored summaries ahead of the Markdown fallback', () => {
    expect(createDescription({ contentMarkdown: 'Markdown fallback.' })).toBe('Content fallback.')
    expect(createDescription({ contentHtml: '', contentMarkdown: 'Markdown fallback.', summary: 'My summary.' })).toBe('My summary.')
    expect(createDescription({ contentHtml: '', contentMarkdown: '> A quoted note.\n\nA line\nwith prose.' })).toBe('A quoted note. A line with prose.')
  })

  it('describes prose in static or aligned HTML while excluding headings and scripts', () => {
    expect(createDescription({ contentHtml: '', contentMarkdown: '<h2>A heading</h2><p style="text-align: center">A centered &amp; useful thought.</p><script>ignored()</script>' })).toBe('A centered & useful thought.')
    expect(createDescription({ contentHtml: '', contentMarkdown: 'First line.  \nSecond line.' })).toBe('First line. Second line.')
  })
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
