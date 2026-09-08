import { describe, expect, it } from 'vitest'
import { PUBLIC_ASSET_ORIGIN } from '../assets'
import {
  ALL_RSS_FEED,
  createRssResponse,
  getPodcastEnclosure,
  RSS_FEEDS,
  selectAdvertisedRssFeeds,
  selectRssEntries,
  type RssEntry,
} from './index'

const reviewEntry: RssEntry = {
  id: 'a-review',
  data: {
    category: 'review',
    date: '2026-07-25',
    summary: 'A review summary.',
    title: 'A review',
  },
}

const podcastEntry: RssEntry = {
  id: 'a-podcast',
  data: {
    category: 'podcast',
    date: '2026-07-23',
    summary: 'A podcast summary.',
    title: 'A podcast',
    podcast: {
      show: 'A show',
      sourceUrl: 'https://example.com/episode',
      players: [
        {
          service: 'spotify',
          url: 'https://open.spotify.com/episode/example',
        },
      ],
      audioUrl: '/podcasts/episode.mp3',
      audioBytes: 1234,
    },
  },
}

const entries: RssEntry[] = [
  reviewEntry,
  {
    id: 'a-note',
    data: {
      category: 'note',
      date: '2026-07-24',
      summary: undefined,
      title: 'A note',
    },
  },
  podcastEntry,
]

describe('RSS feeds', () => {
  it('keeps stable public paths for every feed', () => {
    expect(RSS_FEEDS.map(({ path }) => path)).toEqual([
      '/rss.xml',
      '/feeds/reviews.xml',
      '/feeds/videos.xml',
      '/feeds/podcasts.xml',
      '/feeds/talks.xml',
    ])
  })

  it('returns everything or filters by the feed category', () => {
    expect(selectRssEntries(entries, ALL_RSS_FEED)).toHaveLength(3)
    expect(selectRssEntries(entries, RSS_FEEDS[1]).map(({ id }) => id)).toEqual(['a-review'])
  })

  it('advertises dedicated feeds only when published entries exist', () => {
    expect(selectAdvertisedRssFeeds(entries).map(({ slug }) => slug)).toEqual([
      'everything',
      'reviews',
      'podcasts',
    ])
    expect(selectAdvertisedRssFeeds([
      ...entries,
      {
        id: 'a-video',
        data: {
          category: 'video',
          date: '2026-07-26',
          summary: 'A video summary.',
          title: 'A video',
        },
      },
    ]).map(({ slug }) => slug)).toContain('videos')
  })

  it('adds playable enclosures only when audio metadata is complete', () => {
    expect(getPodcastEnclosure(podcastEntry)).toEqual({
      url: `${PUBLIC_ASSET_ORIGIN}/podcasts/episode.mp3`,
      length: 1234,
      type: 'audio/mpeg',
    })
    expect(getPodcastEnclosure(reviewEntry)).toBeUndefined()
  })

  it('builds styled RSS with summaries and article links', async () => {
    const response = await createRssResponse(ALL_RSS_FEED, entries, new URL('https://amaral.codes'))
    const xml = await response.text()

    expect(xml).toContain('<?xml-stylesheet type="text/xsl" href="/rss.xsl"?>')
    expect(xml).toContain('<title>A review</title>')
    expect(xml).toContain('<description>A review summary.</description>')
    expect(xml).toContain('<description>A note from Caio Amaral.</description>')
    expect(xml).toContain('https://amaral.codes/posts/a-note/')
    expect(xml).toContain(`<enclosure url="${PUBLIC_ASSET_ORIGIN}/podcasts/episode.mp3" length="1234" type="audio/mpeg"/>`)
  })
})
