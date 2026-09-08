import type { APIRoute } from 'astro'
import { renderLlmsIndex } from '../lib/agent-discovery'
import { getEntryIndex, getProjectIndex } from '../lib/content'
import { requireSite } from '../lib/site'

export const GET: APIRoute = async ({ site }) => {
  const [{ entries }, { projects }] = await Promise.all([
    getEntryIndex(),
    getProjectIndex(),
  ])
  const markdown = renderLlmsIndex({
    entries,
    projects,
    site: requireSite(site),
  })

  return new Response(markdown, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}
