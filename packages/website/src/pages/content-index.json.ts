import type { APIRoute } from 'astro'
import { createAgentContentIndex } from '../lib/agent-discovery'
import { getEntryIndex, getProjectIndex } from '../lib/content'
import { requireSite } from '../lib/site'

export const GET: APIRoute = async ({ site }) => {
  const [{ entries }, { projects }] = await Promise.all([
    getEntryIndex(),
    getProjectIndex(),
  ])
  const index = createAgentContentIndex({
    entries,
    projects,
    site: requireSite(site),
  })

  return new Response(JSON.stringify(index, null, 2), {
    headers: {
      'Cache-Control': 'public, max-age=3600',
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}
