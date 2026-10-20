import type { EntryRecord, ProjectRecord } from '../content/selectors'
import { getEntryHref } from '../routes'
import { createCanonicalUrl } from '../site'

const publicPages = ['/', '/about', '/contact', '/posts', '/projects', '/rss']

export function createSiteSitemap(entries: readonly EntryRecord[], projects: readonly ProjectRecord[], site: URL): string {
  const pages = publicPages.map(pathname => sitemapUrl(pathname, site))
  const posts = entries.map(entry => sitemapUrl(getEntryHref(entry.id, entry.data.translation), site))
  const cases = projects.filter(project => !project.data.externalUrl).map(project => sitemapUrl(`/projects/${project.id}`, site))
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[...pages, ...posts, ...cases].join('')}</urlset>`
}

function sitemapUrl(pathname: string, site: URL): string {
  const location = escapeXml(createCanonicalUrl(pathname, site))
  return `<url><loc>${location}</loc></url>`
}

function escapeXml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;')
}
