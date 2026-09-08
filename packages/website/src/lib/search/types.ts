export type SearchDocumentType = 'writing' | 'project'
export type SearchFilter = 'all' | SearchDocumentType

export interface SearchDocument {
  id: string
  type: SearchDocumentType
  title: string
  summary: string
  content: string
  href: string
  category: string
  topics: string[]
  date?: string
  external: boolean
}
