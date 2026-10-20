import type { EntryData } from '../../content/schemas'

type PodcastPlayer = NonNullable<EntryData['podcast']>['players'][number]

export const PODCAST_SERVICE_LABELS = {
  applePodcasts: 'Apple Podcasts',
  overcast: 'Overcast',
  pocketCasts: 'Pocket Casts',
  spotify: 'Spotify',
} as const satisfies Record<PodcastPlayer['service'], string>
