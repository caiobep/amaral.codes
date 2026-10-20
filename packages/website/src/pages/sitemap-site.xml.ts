import type { APIRoute } from 'astro'
import { getEntryIndex, getProjectIndex } from '../lib/content'
import { createSiteSitemap } from '../lib/sitemap'
import { requireSite } from '../lib/site'

export const GET: APIRoute = async ({ site }) => {
  const [{ entries }, { projects }] = await Promise.all([getEntryIndex(), getProjectIndex()])
  return new Response(createSiteSitemap(entries, projects, requireSite(site)), {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}
