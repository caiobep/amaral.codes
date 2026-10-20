import { expect, it } from 'vitest'
import { createSatteriMarkdownProcessor } from '@astrojs/markdown-satteri'
import richLinkCards from './plugin.mjs'

it('renders saved metadata as inert static markup while preserving inline links and fenced code', async () => {
  const href = 'https://example.com/article'
  const card = { url: href, title: '<script>untrusted text</script>', description: 'Useful source', image: '/link-previews/image.webp', imageAlt: 'Source cover' }
  const renderer = await createSatteriMarkdownProcessor({ hastPlugins: [richLinkCards()], syntaxHighlight: false })
  const result = await renderer.render(`[Original](${href})\n\nSee [inline](${href}).\n\n\`\`\`html\n<a>code</a>\n\`\`\``, { frontmatter: { linkCards: [card] } })
  expect(result.code).toContain('external-card--image')
  expect(result.code).toContain('&lt;script&gt;untrusted text&lt;/script&gt;')
  expect(result.code).not.toContain('<script>')
  expect(result.code).toContain('src="/link-previews/image.webp"')
  expect(result.code).toContain('See <a href="https://example.com/article">inline</a>')
  expect(result.code).toContain('&lt;a&gt;code&lt;/a&gt;')
})

it('keeps unsupported links unchanged and supports text-only saved cards', async () => {
  const renderer = await createSatteriMarkdownProcessor({ hastPlugins: [richLinkCards()], syntaxHighlight: false })
  const result = await renderer.render('[Plain](https://example.com/plain)\n\n[Saved](https://example.com/saved)\n\nEmpty paragraph.', { frontmatter: { linkCards: [{ url: 'https://example.com/saved', title: 'Saved title' }] } })
  expect(result.code).toContain('href="https://example.com/plain">Plain</a>')
  expect(result.code).toContain('Saved title</strong>')
  expect(result.code).not.toContain('external-card--image')
})
