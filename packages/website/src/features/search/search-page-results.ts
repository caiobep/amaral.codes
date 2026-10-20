import type { SearchDocument } from './search-document'
import { ENTRY_CATEGORY_PRESENTATION } from '../entries/category-presentation'

export function renderResults(results: HTMLOListElement, matches: SearchDocument[]) {
  results.replaceChildren(...matches.map(createResultElement))
}

export function getStatusText(query: string, count: number) {
  if (count === 0) return `No results for “${query}”.`
  return `${String(count)} ${count === 1 ? 'result' : 'results'} for “${query}”.`
}

function createResultElement(match: SearchDocument) {
  const item = document.createElement('li')
  const link = document.createElement('a')
  const meta = document.createElement('p')
  const kind = document.createElement('span')
  const category = document.createElement('span')
  const date = document.createElement('span')
  const copy = document.createElement('div')
  const title = document.createElement('h2')
  const summary = document.createElement('p')
  const arrow = document.createElement('i')

  link.href = match.href
  if (match.external) Object.assign(link, { target: '_blank', rel: 'noopener noreferrer' })

  kind.textContent = formatContentType(match)
  category.textContent = match.category
  date.textContent = formatDate(match.date)
  appendResultMetadata({
    meta,
    kind,
    category,
    date,
    isProject: match.type === 'project',
  })

  title.textContent = match.title
  summary.textContent = match.summary
  copy.append(title)
  if (summary.textContent) copy.append(summary)
  arrow.textContent = match.external ? '↗' : '→'
  arrow.setAttribute('aria-hidden', 'true')

  link.append(meta, copy, arrow)
  item.append(link)
  return item
}

interface ResultMetadataElements {
  meta: HTMLParagraphElement
  kind: HTMLSpanElement
  category: HTMLSpanElement
  date: HTMLSpanElement
  isProject: boolean
}

function appendResultMetadata({
  meta,
  kind,
  category,
  date,
  isProject,
}: ResultMetadataElements) {
  meta.append(...(isProject ? [kind, category] : [kind]))
  if (date.textContent) meta.append(date)
  meta.setAttribute('aria-label', [
    kind.textContent,
    ...(isProject ? [category.textContent] : []),
    date.textContent,
  ].filter(Boolean).join(', '))
}

function formatContentType(match: SearchDocument) {
  return match.type === 'project'
    ? 'Project'
    : ENTRY_CATEGORY_PRESENTATION[match.category].singularLabel
}

function formatDate(date: string | undefined) {
  if (!date) return ''
  const parsed = new Date(`${date.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(parsed.valueOf())) return date
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parsed)
}
