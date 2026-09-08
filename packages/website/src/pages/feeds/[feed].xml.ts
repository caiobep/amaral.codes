import type { APIContext } from 'astro'
import { getEntryIndex } from '../../lib/content'
import {
  createRssResponse,
  DEDICATED_RSS_FEEDS,
  selectAdvertisedRssFeeds,
  type RssFeedDefinition,
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
  const { feed } = context.props as { feed: RssFeedDefinition }

  return createRssResponse(feed, entries, site)
}
