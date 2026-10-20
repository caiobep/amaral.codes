import { resolveEntryLanguage } from '@amaral.codes/content-contract/entry-language'
import type { Heading, Nodes } from 'mdast'
import { fromMarkdown } from 'mdast-util-from-markdown'
import type { EntryData } from '../../content/schemas'
import { ENTRY_CATEGORY_PRESENTATION } from '../../features/entries/category-presentation'
import { PODCAST_SERVICE_LABELS } from '../../features/podcasts/service-presentation'

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

interface SourceEdit {
  end: number
  replacement: string
  start: number
}

function createSourceHeadingEdit(body: string, start: number, end: number): SourceEdit | undefined {
  if (body[start] === '#') return { end: start, replacement: '#', start }
  const underlineStart = body.lastIndexOf('\n', end - 1) + 1
  const marker = /=+/u.exec(body.slice(underlineStart, end))
  if (!marker) return undefined
  const markerStart = underlineStart + marker.index
  return {
    end: markerStart + marker[0].length,
    replacement: '-'.repeat(marker[0].length),
    start: markerStart,
  }
}

function createHeadingEdit(body: string, node: Heading): SourceEdit | undefined {
  const start = node.position?.start.offset
  const end = node.position?.end.offset
  if (start === undefined || end === undefined) return undefined
  return createSourceHeadingEdit(body, start, end)
}

function collectHeadingEdits(body: string, node: Nodes, edits: SourceEdit[]): void {
  if (node.type === 'heading' && node.depth === 1) {
    const edit = createHeadingEdit(body, node)
    if (edit) edits.push(edit)
  }
  if ('children' in node) node.children.forEach((child) => collectHeadingEdits(body, child, edits))
}

function applySourceEdits(body: string, edits: readonly SourceEdit[]): string {
  return [...edits]
    .sort((left, right) => right.start - left.start)
    .reduce((result, edit) => (
      `${result.slice(0, edit.start)}${edit.replacement}${result.slice(edit.end)}`
    ), body)
}

function normalizeBodyHeadings(body: string): string {
  const normalizedBody = body
    .replace(/^(?:[ \t]*\r?\n)+/u, '')
    .replace(/(?:\r?\n[ \t]*)+$/u, '')
  const edits: SourceEdit[] = []
  collectHeadingEdits(normalizedBody, fromMarkdown(normalizedBody), edits)
  return applySourceEdits(normalizedBody, edits)
}

function renderMetadata(data: EntryData, canonicalUrl: string): string[] {
  const topics = data.topics.length > 0 ? [`- Topics: ${data.topics.join(', ')}`] : []
  const language = resolveEntryLanguage(data)

  return [
    '- Author: Caio Amaral',
    `- Type: ${ENTRY_CATEGORY_PRESENTATION[data.category].singularLabel}`,
    `- Published: ${data.date}`,
    `- Language: ${language}`,
    ...topics,
    `- Canonical: ${canonicalUrl}`,
  ]
}

function renderPodcast(data: EntryData): string[] {
  if (!data.podcast) return []

  const playerLinks = data.podcast.players.map(({ service, url }) => (
    `- [Listen on ${PODCAST_SERVICE_LABELS[service]}](${url})`
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
