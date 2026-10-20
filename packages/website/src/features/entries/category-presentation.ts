import type { EntryCategory } from '../../content/schemas'

interface EntryCategoryPresentation {
  singularLabel: string
  filterLabel: string
  discoveryLabel: string
  backLink: {
    href: string
    label: string
  }
}

export const ENTRY_CATEGORY_PRESENTATION = {
  essay: {
    singularLabel: 'Essay',
    filterLabel: 'Essays',
    discoveryLabel: 'Essays',
    backLink: { href: '/posts', label: 'All notes' },
  },
  note: {
    singularLabel: 'Note',
    filterLabel: 'Short notes',
    discoveryLabel: 'Notes',
    backLink: { href: '/posts', label: 'All notes' },
  },
  review: {
    singularLabel: 'Review',
    filterLabel: 'Reviews',
    discoveryLabel: 'Reviews',
    backLink: { href: '/posts?category=review', label: 'All reviews' },
  },
  link: {
    singularLabel: 'Link',
    filterLabel: 'Links',
    discoveryLabel: 'Links',
    backLink: { href: '/posts', label: 'All notes' },
  },
  video: {
    singularLabel: 'Video',
    filterLabel: 'Videos',
    discoveryLabel: 'Videos',
    backLink: { href: '/posts', label: 'All notes' },
  },
  podcast: {
    singularLabel: 'Podcast',
    filterLabel: 'Podcasts',
    discoveryLabel: 'Podcasts',
    backLink: { href: '/posts?category=podcast', label: 'All podcasts' },
  },
  talk: {
    singularLabel: 'Talk',
    filterLabel: 'Talks',
    discoveryLabel: 'Talks',
    backLink: { href: '/posts?category=talk', label: 'All talks' },
  },
} as const satisfies Record<EntryCategory, EntryCategoryPresentation>

export const ENTRY_CATEGORY_PRESENTATIONS = (
  Object.keys(ENTRY_CATEGORY_PRESENTATION) as EntryCategory[]
).map((category) => ({
  category,
  ...ENTRY_CATEGORY_PRESENTATION[category],
}))
