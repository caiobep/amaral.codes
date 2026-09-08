import type { APIRoute } from 'astro'
import { renderLlmsFull } from '../lib/agent-discovery'
import { getEntryIndex } from '../lib/content'
import { requireSite } from '../lib/site'

export const GET: APIRoute = async ({ site }) => {
  const { entries } = await getEntryIndex()
  const markdown = renderLlmsFull({
    entries,
    site: requireSite(site),
  })

  return new Response(markdown, {
    headers: {
      'Cache-Control': 'public, max-age=3600',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}
