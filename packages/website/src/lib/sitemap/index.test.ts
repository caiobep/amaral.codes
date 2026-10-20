import { expect, it } from 'vitest'
import { createSiteSitemap } from '.'

it('lists canonical website pages, published entries and local project pages together', () => {
  const xml = createSiteSitemap([
    { id: 'file-note', data: { category: 'note', date: '2026-10-01' } },
    { id: 'cms-note', data: { category: 'essay', date: '2026-10-11T12:00:00Z' } },
  ], [
    { id: 'local-project', data: { kind: 'software', order: 1 } },
    { id: 'external-project', data: { kind: 'software', order: 2, externalUrl: 'https://example.com/' } },
  ], new URL('https://amaral.codes'))
  expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')
  expect(xml).toContain('<loc>https://amaral.codes/posts/cms-note</loc>')
  expect(xml).not.toContain('<lastmod>')
  expect(xml).toContain('<loc>https://amaral.codes/posts/file-note</loc>')
  expect(xml).toContain('<loc>https://amaral.codes/projects/local-project</loc>')
  expect(xml).not.toMatch(/external-project|search|\.md|_preview|_emdash/)
  expect((xml.match(/<url>/g) ?? [])).toHaveLength(9)
})

it('escapes URL query delimiters in XML', () => {
  const xml = createSiteSitemap([], [{ id: 'project?x=1&y=2', data: { kind: 'software', order: 1 } }], new URL('https://amaral.codes'))
  expect(xml).toContain('project?x=1&amp;y=2</loc>')
})
