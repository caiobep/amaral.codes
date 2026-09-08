import rss from '@astrojs/rss'
import type { EntryCategory, EntryData } from '../../content/schemas'
import { resolvePublicAssetUrl } from '../assets'
import { getEntryHref } from '../routes'

export interface RssFeedDefinition {
  slug: string
  path: string
  title: string
  feedTitle: string
  description: string
  category?: EntryCategory
}

export interface RssEntry {
  id: string
  data: Pick<EntryData, 'category' | 'date' | 'podcast' | 'summary' | 'title'>
}

export const RSS_FEEDS = [
  {
    slug: 'everything',
    path: '/rss.xml',
    title: 'Everything',
    feedTitle: 'Caio Amaral',
    description: 'All new public entries from Caio Amaral.',
  },
  {
    slug: 'reviews',
    path: '/feeds/reviews.xml',
    title: 'Reviews',
    feedTitle: 'Reviews · Caio Amaral',
    description: 'Reviews of movies, books, apps, games, and other things worth remembering.',
    category: 'review',
  },
  {
    slug: 'videos',
    path: '/feeds/videos.xml',
    title: 'Videos',
    feedTitle: 'Videos · Caio Amaral',
    description: 'New videos and notes published alongside them.',
    category: 'video',
  },
  {
    slug: 'podcasts',
    path: '/feeds/podcasts.xml',
    title: 'Podcasts',
    feedTitle: 'Podcasts · Caio Amaral',
    description: 'Podcast episodes, appearances, and accompanying notes.',
    category: 'podcast',
  },
  {
    slug: 'talks',
    path: '/feeds/talks.xml',
    title: 'Talks',
    feedTitle: 'Talks · Caio Amaral',
    description: 'Talks, workshops, and accompanying materials.',
    category: 'talk',
  },
] as const satisfies readonly RssFeedDefinition[]

export const ALL_RSS_FEED: RssFeedDefinition = RSS_FEEDS[0]
export const DEDICATED_RSS_FEEDS: readonly RssFeedDefinition[] = RSS_FEEDS.slice(1)

export function selectRssEntries(entries: readonly RssEntry[], feed: RssFeedDefinition) {
  return feed.category
    ? entries.filter((entry) => entry.data.category === feed.category)
    : [...entries]
}

export function selectAdvertisedRssFeeds(
  entries: readonly RssEntry[],
  feeds: readonly RssFeedDefinition[] = RSS_FEEDS,
): RssFeedDefinition[] {
  const categories = new Set(entries.map(entry => entry.data.category))
  return feeds.filter(feed => !feed.category || categories.has(feed.category))
}

export function getPodcastEnclosure(entry: RssEntry) {
  const { audioBytes, audioUrl } = entry.data.podcast ?? {}
  if (!audioBytes || !audioUrl) return undefined

  return {
    url: resolvePublicAssetUrl(audioUrl),
    length: audioBytes,
    type: 'audio/mpeg',
  }
}

export async function createRssResponse(
  feed: RssFeedDefinition,
  entries: readonly RssEntry[],
  site: URL,
) {
  const response = await rss({
    title: feed.feedTitle,
    description: feed.description,
    site,
    items: selectRssEntries(entries, feed).map((entry) => ({
      title: entry.data.title,
      pubDate: new Date(entry.data.date),
      description: entry.data.summary ?? 'A note from Caio Amaral.',
      link: getEntryHref(entry.id),
      enclosure: getPodcastEnclosure(entry),
    })),
  })

  const xml = await response.text()
  const styledXml = xml.replace(
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<?xml version="1.0" encoding="UTF-8"?><?xml-stylesheet type="text/xsl" href="/rss.xsl"?>',
  )

  return new Response(styledXml, {
    headers: response.headers,
    status: response.status,
  })
}
