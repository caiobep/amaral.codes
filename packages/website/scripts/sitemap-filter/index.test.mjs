import assert from 'node:assert/strict'
import { test } from 'vitest'
import { shouldIncludeInSitemap } from './index.mjs'

const siteUrl = (path) => new URL(path, 'https://amaral.codes').href

test.each([
  ['/search/', 'noindex'],
  ['/deeplink/', 'noindex redirect'],
  ['/offline/', 'offline fallback'],
  ['/utils/links/d/', 'redirect utility'],
  ['/utils/links/shortcuts/', 'shortcut utility'],
  ['/physical-projects/', 'redirect-only legacy route'],
  ['/reviews/', 'redirect-only legacy route'],
  ['/posts/an-article.md', 'alternate Markdown representation'],
  ['/llms.txt', 'agent discovery index'],
  ['/llms-full.txt', 'agent full-text representation'],
  ['/content-index.json', 'machine-readable content index'],
  ['/sitemap-site.xml', 'sitemap document'],
])('excludes %s as a %s route', (route) => {
  assert.equal(shouldIncludeInSitemap(siteUrl(route)), false)
})

test.each([
  '/',
  '/about/',
  '/contact/',
  '/posts/',
  '/posts/an-article/',
  '/projects/',
  '/rss/',
])('includes public route %s', (route) => {
  assert.equal(shouldIncludeInSitemap(siteUrl(route)), true)
})

test('normalizes route paths before applying the contract', () => {
  assert.equal(shouldIncludeInSitemap(siteUrl('/search')), false)
  assert.equal(shouldIncludeInSitemap(siteUrl('/about')), true)
})
