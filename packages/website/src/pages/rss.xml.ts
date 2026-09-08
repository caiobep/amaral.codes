import type { APIContext } from 'astro'
import { getEntryIndex } from '../lib/content'
import { ALL_RSS_FEED, createRssResponse } from '../lib/rss'
import { requireSite } from '../lib/site'

export async function GET(context: APIContext) {
  const { entries } = await getEntryIndex()
  const site = requireSite(context.site)

  return createRssResponse(ALL_RSS_FEED, entries, site)
}
