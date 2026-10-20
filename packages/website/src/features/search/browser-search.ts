import Fuse, { type IFuseOptions } from 'fuse.js'
import { normalizeSearchText } from './normalize-search-text'
import type { SearchDocument, SearchFilter } from './search-document'

export type { SearchDocument, SearchFilter } from './search-document'

export interface SearchEngine {
  documents: SearchDocument[]
  fuzzy: Fuse<SearchDocument>
}

const SEARCH_OPTIONS: IFuseOptions<SearchDocument> = {
  ignoreDiacritics: true,
  ignoreLocation: true,
  minMatchCharLength: 2,
  threshold: 0.3,
  fieldNormWeight: 0.8,
  keys: [
    { name: 'title', weight: 0.45 },
    { name: 'summary', weight: 0.25 },
    { name: 'topics', weight: 0.15 },
    { name: 'category', weight: 0.1 },
    { name: 'date', weight: 0.05 },
  ],
}

const getExactMatchRank = (document: SearchDocument, query: string) => {
  const fields = [
    document.title,
    document.topics.join(' '),
    document.category,
    document.summary,
    document.date ?? '',
    document.content,
  ]

  for (const [fieldIndex, field] of fields.entries()) {
    const position = normalizeSearchText(field).indexOf(query)
    if (position >= 0) return fieldIndex * 1_000_000 + position
  }

  return Number.POSITIVE_INFINITY
}

export const createSearchEngine = (documents: readonly SearchDocument[]): SearchEngine => {
  const searchableDocuments = [...documents]
  return {
    documents: searchableDocuments,
    fuzzy: new Fuse(searchableDocuments, SEARCH_OPTIONS),
  }
}

export const searchDocuments = (
  engine: SearchEngine,
  query: string,
  filter: SearchFilter = 'all',
  limit = 24,
) => {
  const normalizedQuery = normalizeSearchText(query.trim())
  if (normalizedQuery.length < 2) return []

  const matchesFilter = (document: SearchDocument) => filter === 'all' || document.type === filter
  const exactMatches = engine.documents
    .filter(matchesFilter)
    .map((document) => ({ document, rank: getExactMatchRank(document, normalizedQuery) }))
    .filter(({ rank }) => Number.isFinite(rank))
    .sort((left, right) => left.rank - right.rank)
    .map(({ document }) => document)
  const exactIds = new Set(exactMatches.map(({ id }) => id))
  const fuzzyMatches = engine.fuzzy.search(normalizedQuery)
    .map(({ item }) => item)
    .filter(matchesFilter)
    .filter(({ id }) => !exactIds.has(id))

  return [...exactMatches, ...fuzzyMatches].slice(0, limit)
}
