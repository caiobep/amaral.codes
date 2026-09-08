import type { PageObjectResponse as NotionPage } from '@notionhq/client'
import type { PodcastData } from '@amaral.codes/content-contract'
import { requirePublicHttpsUrl } from '@amaral.codes/content-contract/public-url'
import {
  getNumber,
  getText,
  getTitle,
  getUrl,
} from '../../../properties/index.ts'
import { requireText, requireUrl } from '../required-properties/index.ts'

export function mapPodcast(page: NotionPage): PodcastData {
  type PodcastService = PodcastData['players'][number]['service']
  const players = [
    ['applePodcasts', getUrl(page, 'Apple Podcasts')],
    ['spotify', getUrl(page, 'Spotify')],
    ['pocketCasts', getUrl(page, 'Pocket Casts')],
    ['overcast', getUrl(page, 'Overcast')],
  ] as [PodcastService, string | undefined][]
  const availablePlayers = players
    .filter((entry): entry is [PodcastService, string] => Boolean(entry[1]))
    .map(([service, url]) => ({
      service,
      url: requirePublicHttpsUrl(url, `"${getTitle(page)}" podcast player URL`),
    }))

  return {
    show: requireText(page, 'Show'),
    episode: getText(page, 'Episode'),
    sourceUrl: requirePublicHttpsUrl(requireUrl(page, 'Source URL'), 'Source URL'),
    players: availablePlayers,
    audioUrl: readOptionalHttpUrl(page, 'Audio URL'),
    audioBytes: getNumber(page, 'Audio bytes'),
  }
}

function readOptionalHttpUrl(page: NotionPage, name: string): string | undefined {
  const value = getUrl(page, name)
  return value ? requirePublicHttpsUrl(value, name) : undefined
}
