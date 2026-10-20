import type { EntryCategory } from '../../content/schemas'

export type SearchDocumentType = 'writing' | 'project'
export type SearchFilter = 'all' | SearchDocumentType

interface SearchDocumentFields {
  id: string
  title: string
  summary: string
  content: string
  href: string
  topics: string[]
  date?: string
  external: boolean
}

export type SearchDocument = SearchDocumentFields & (
  | { type: 'writing', category: EntryCategory }
  | { type: 'project', category: string }
)
