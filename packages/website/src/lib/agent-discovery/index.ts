import type { EntryCategory, EntryData, ProjectData } from '../../content/schemas'
import { renderEntryMarkdown } from '../agent-markdown'
import { getEntryHref, getProjectHref } from '../routes'

const CATEGORY_SECTIONS = [
  { category: 'essay', title: 'Essays' },
  { category: 'note', title: 'Notes' },
  { category: 'review', title: 'Reviews' },
  { category: 'link', title: 'Links' },
  { category: 'video', title: 'Videos' },
  { category: 'podcast', title: 'Podcasts' },
  { category: 'talk', title: 'Talks' },
] as const satisfies readonly { category: EntryCategory, title: string }[]

interface AgentEntry {
  id: string
  body?: string
  data: EntryData
}

interface AgentProject {
  id: string
  data: ProjectData
}

interface AgentDiscoveryInput {
  entries: readonly AgentEntry[]
  projects: readonly AgentProject[]
  site: URL
}

interface ContentUrls {
  html?: string
  markdown?: string
  external?: string
}

interface ContentIndexEntry {
  id: string
  type: 'entry'
  category: EntryData['category']
  title: string
  summary?: string
  date: string
  language: 'en' | 'pt-BR'
  topics: string[]
  urls: ContentUrls
}

interface ContentIndexProject {
  id: string
  type: 'project'
  kind: ProjectData['kind']
  title: string
  summary: string
  category: string
  technologies: string[]
  urls: ContentUrls
}

export interface AgentContentIndex {
  schemaVersion: 1
  site: {
    name: 'Caio Amaral'
    url: string
    llms: string
    fullText: string
  }
  entries: ContentIndexEntry[]
  projects: ContentIndexProject[]
}

function absoluteUrl(pathname: string, site: URL): string {
  return new URL(pathname, site).toString()
}

function singleLine(value: string): string {
  return value.replace(/\s+/gu, ' ').trim()
}

function escapeLinkLabel(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('[', '\\[').replaceAll(']', '\\]')
}

function getEntryLanguage(data: EntryData): 'en' | 'pt-BR' {
  return data.language ?? data.talk?.language ?? 'en'
}

function getEntryMarkdownUrl(entry: AgentEntry, site: URL): string {
  return absoluteUrl(`${getEntryHref(entry.id)}.md`, site)
}

function renderEntryLink(entry: AgentEntry, site: URL): string {
  const summary = entry.data.summary ? `: ${singleLine(entry.data.summary)}` : ''
  return `- [${escapeLinkLabel(entry.data.title)}](${getEntryMarkdownUrl(entry, site)})${summary}`
}

function renderProjectLink(project: AgentProject, site: URL): string {
  const url = project.data.externalUrl ?? absoluteUrl(getProjectHref(project.id), site)
  return `- [${escapeLinkLabel(project.data.title)}](${url}): ${singleLine(project.data.summary)}`
}

function renderSection(title: string, links: readonly string[]): string | undefined {
  if (links.length === 0) return undefined
  return `## ${title}\n\n${links.join('\n')}`
}

export function renderLlmsIndex({ entries, projects, site }: AgentDiscoveryInput): string {
  const featuredEntries = entries
    .filter((entry) => entry.data.featuredOrder !== undefined)
    .sort((left, right) => (left.data.featuredOrder ?? 0) - (right.data.featuredOrder ?? 0))
  const sections = [
    renderSection('Start here', featuredEntries.map((entry) => renderEntryLink(entry, site))),
    ...CATEGORY_SECTIONS.map(({ category, title }) => renderSection(
      title,
      entries
        .filter((entry) => entry.data.category === category)
        .map((entry) => renderEntryLink(entry, site)),
    )),
    renderSection('Projects', projects.map((project) => renderProjectLink(project, site))),
    renderSection('Optional', [
      `- [Full published content](${absoluteUrl('/llms-full.txt', site)}): All published entries in one Markdown document`,
      `- [Content index](${absoluteUrl('/content-index.json', site)}): Versioned JSON metadata for public entries and projects`,
      `- [RSS feed](${absoluteUrl('/rss.xml', site)}): Updates for feed readers`,
    ]),
  ].filter((section): section is string => Boolean(section))

  return `# Caio Amaral\n\n> Caio Amaral's personal site for notes, projects, reviews, podcast appearances, talks, and links.\n\nThe links below point to clean Markdown where it is available. This index, the full-text file, and the JSON index contain published material.\n\n${sections.join('\n\n')}\n`
}

export function renderLlmsFull({ entries, site }: Omit<AgentDiscoveryInput, 'projects'>): string {
  const documents = entries.map((entry) => renderEntryMarkdown({
    body: entry.body ?? '',
    canonicalUrl: absoluteUrl(getEntryHref(entry.id), site),
    data: entry.data,
  }).trim())
  const body = documents.length > 0 ? `\n\n---\n\n${documents.join('\n\n---\n\n')}` : ''

  return `# Caio Amaral: published entries\n\n> Full text of the published notes, reviews, podcasts, talks, videos, and links on amaral.codes.${body}\n`
}

export function createAgentContentIndex({
  entries,
  projects,
  site,
}: AgentDiscoveryInput): AgentContentIndex {
  return {
    schemaVersion: 1,
    site: {
      name: 'Caio Amaral',
      url: absoluteUrl('/', site),
      llms: absoluteUrl('/llms.txt', site),
      fullText: absoluteUrl('/llms-full.txt', site),
    },
    entries: entries.map((entry) => ({
      id: entry.id,
      type: 'entry',
      category: entry.data.category,
      title: entry.data.title,
      ...(entry.data.summary ? { summary: entry.data.summary } : {}),
      date: entry.data.date,
      language: getEntryLanguage(entry.data),
      topics: [...entry.data.topics],
      urls: {
        html: absoluteUrl(getEntryHref(entry.id), site),
        markdown: getEntryMarkdownUrl(entry, site),
      },
    })),
    projects: projects.map((project) => ({
      id: project.id,
      type: 'project',
      kind: project.data.kind,
      title: project.data.title,
      summary: project.data.summary,
      category: project.data.category,
      technologies: [...project.data.technologies],
      urls: project.data.externalUrl
        ? { external: project.data.externalUrl }
        : { html: absoluteUrl(getProjectHref(project.id), site) },
    })),
  }
}
