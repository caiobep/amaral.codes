import type { EntryData } from '../../content/schemas'

const CATEGORY_LABELS: Record<EntryData['category'], string> = {
  essay: 'Essay',
  link: 'Link',
  note: 'Note',
  podcast: 'Podcast',
  review: 'Review',
  talk: 'Talk',
  video: 'Video',
}

const PLAYER_LABELS = {
  applePodcasts: 'Apple Podcasts',
  overcast: 'Overcast',
  pocketCasts: 'Pocket Casts',
  spotify: 'Spotify',
} as const

interface EntryMarkdownInput {
  body: string
  canonicalUrl: string
  data: EntryData
}

function compactSections(sections: readonly (readonly string[])[]): string[] {
  return sections.filter((section) => section.length > 0).flatMap((section, index) => (
    index === 0 ? section : ['', ...section]
  ))
}

function normalizeBodyHeadings(body: string): string {
  let fenceMarker: '`' | '~' | undefined

  return body.trim().split('\n').map((line) => {
    const fence = /^\s*(`{3,}|~{3,})/u.exec(line)?.[1]
    if (fence) fenceMarker = fenceMarker ? undefined : fence[0] as '`' | '~'
    if (fenceMarker || !/^#\s+/u.test(line)) return line
    return `#${line}`
  }).join('\n')
}

function renderMetadata(data: EntryData, canonicalUrl: string): string[] {
  const topics = data.topics.length > 0 ? [`- Topics: ${data.topics.join(', ')}`] : []
  const language = data.language ?? data.talk?.language ?? 'en'

  return [
    '- Author: Caio Amaral',
    `- Type: ${CATEGORY_LABELS[data.category]}`,
    `- Published: ${data.date}`,
    `- Language: ${language}`,
    ...topics,
    `- Canonical: ${canonicalUrl}`,
  ]
}

function renderPodcast(data: EntryData): string[] {
  if (!data.podcast) return []

  const playerLinks = data.podcast.players.map(({ service, url }) => (
    `- [Listen on ${PLAYER_LABELS[service]}](${url})`
  ))
  const audioLink = data.podcast.audioUrl
    ? [`- [Listen to the hosted audio](${data.podcast.audioUrl})`]
    : []

  return [
    '## Listen',
    `- [Episode notes](${data.podcast.sourceUrl})`,
    ...audioLink,
    ...playerLinks,
  ]
}

function renderTalk(data: EntryData): string[] {
  if (!data.talk) return []

  return [
    '## Materials',
    ...data.talk.materials.map(({ label, url }) => `- [${label}](${url})`),
  ]
}

export function renderEntryMarkdown({ body, canonicalUrl, data }: EntryMarkdownInput): string {
  const content = body.trim() ? [normalizeBodyHeadings(body)] : []
  const sections = compactSections([
    [`# ${data.title}`],
    data.summary ? [data.summary] : [],
    renderMetadata(data, canonicalUrl),
    renderPodcast(data),
    renderTalk(data),
    content,
  ])

  return `${sections.join('\n')}\n`
}
