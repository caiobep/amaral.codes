import type { SearchDocument } from '../../../lib/search'

type SearchModule = typeof import('../../../lib/search')
type SearchEngine = ReturnType<SearchModule['createSearchEngine']>

export interface HeaderSearchRuntime {
  engine: SearchEngine
  search: SearchModule['searchDocuments']
}

export interface HeaderSearchElements {
  allResultsLink: HTMLAnchorElement
  clearButton: HTMLButtonElement
  closeButton: HTMLButtonElement
  desktopLink: HTMLAnchorElement
  form: HTMLFormElement
  input: HTMLInputElement
  results: HTMLOListElement
  status: HTMLElement
  trigger: HTMLButtonElement
}

export interface HeaderSearchState {
  activeIndex: number
  requestVersion: number
  runtime?: HeaderSearchRuntime
  runtimePromise?: Promise<HeaderSearchRuntime>
}

export type { SearchDocument }
