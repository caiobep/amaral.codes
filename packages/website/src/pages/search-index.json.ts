import type { APIRoute } from 'astro'
import { getEntryIndex, getProjectIndex } from '../lib/content'
import { createSearchDocuments } from '../lib/search'

export const GET: APIRoute = async () => {
  const [{ entries }, { projects }] = await Promise.all([
    getEntryIndex(),
    getProjectIndex(),
  ])
  const documents = createSearchDocuments(entries, projects)

  return new Response(JSON.stringify(documents), {
    headers: {
      'Cache-Control': 'public, max-age=3600',
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}
