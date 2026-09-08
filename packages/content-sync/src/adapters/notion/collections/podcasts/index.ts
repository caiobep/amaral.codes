import type { PageObjectResponse as NotionPage } from '@notionhq/client'
import type { EntryData, PodcastData } from '@amaral.codes/content-contract'
import { requirePublicHttpsUrl } from '@amaral.codes/content-contract/public-url'
import type { ContentMapper } from '../../../../application/ports.ts'
import { createSlug } from '../../../../domain/slug/index.ts'
import {
  getDate,
  getMultiSelect,
  getText,
  getTitle,
  getUrl,
} from '../../properties/index.ts'

type PodcastPlayer = PodcastData['players'][number]['service']

const PLAYER_BY_HOST: Readonly<Partial<Record<string, PodcastPlayer>>> = {
  'overcast.fm': 'overcast',
  'open.spotify.com': 'spotify',
  'pocketcasts.com': 'pocketCasts',
  'podcasts.apple.com': 'applePodcasts',
} as const

export const podcastsMapper: ContentMapper<NotionPage, EntryData> = {
  isPublished: page => Boolean(page.public_url),
  map: (page) => {
    const title = getTitle(page)
    const link = requirePublicHttpsUrl(requireUrl(page, 'Link'), 'Link')

    return {
      slug: createSlug(title),
      metadata: {
        title,
        date: requireDate(page, 'Created'),
        summary: requireText(page, 'Description'),
        category: 'podcast',
        topics: getMultiSelect(page, 'Tags'),
        podcast: {
          show: readShow(page, title),
          episode: readEpisode(title),
          sourceUrl: link,
          players: [{ service: readPlayer(link), url: link }],
        },
      },
    }
  },
}

function readShow(page: NotionPage, title: string): string {
  const [tag] = getMultiSelect(page, 'Tags')
  const candidate = tag ?? title.split(/#|\d/u, 1)[0]?.trim()
  if (!candidate) return 'Podcast'
  if (/^rebuild\s*cast$/iu.test(candidate)) return 'RebuildCast'
  if (/^lambda3$/iu.test(candidate)) return 'Lambda3 Podcast'
  return candidate
}

function readEpisode(title: string): string | undefined {
  return /(?:podcast\s+|#)\s*(\d+)/iu.exec(title)?.[1]
}

function readPlayer(url: string): PodcastPlayer {
  const hostname = new URL(url).hostname.toLowerCase()
  const service = PLAYER_BY_HOST[hostname]
  if (service) return service
  throw new Error(`Unsupported podcast player: ${hostname}`)
}

function requireDate(page: NotionPage, name: string): string {
  const value = getDate(page, name)
  if (value) return value
  throw new Error(`"${getTitle(page)}" is missing ${name}`)
}

function requireText(page: NotionPage, name: string): string {
  const value = getText(page, name)
  if (value) return value
  throw new Error(`"${getTitle(page)}" is missing ${name}`)
}

function requireUrl(page: NotionPage, name: string): string {
  const value = getUrl(page, name)
  if (value) return value
  throw new Error(`"${getTitle(page)}" is missing ${name}`)
}
