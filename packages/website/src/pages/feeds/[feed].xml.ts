import type { APIContext } from 'astro'
import { getEntryIndex } from '../../lib/content'
import {
  createRssResponse,
  DEDICATED_RSS_FEEDS,
  selectAdvertisedRssFeeds,
} from '../../lib/rss'
import { requireSite } from '../../lib/site'

export async function getStaticPaths() {
  const { entries } = await getEntryIndex()
  const advertisedFeeds = selectAdvertisedRssFeeds(entries)
  return DEDICATED_RSS_FEEDS.filter(feed => advertisedFeeds.includes(feed)).map((feed) => ({
    params: { feed: feed.slug },
    props: { feed },
  }))
}

export async function GET(context: APIContext) {
  const { entries } = await getEntryIndex()
  const site = requireSite(context.site)
  const feed = selectAdvertisedRssFeeds(entries, DEDICATED_RSS_FEEDS)
    .find(feed => feed.slug === context.params.feed)
  if (!feed) return new Response('Feed not found', { status: 404 })

  return createRssResponse(feed, entries, site)
}
