import type { createSearchEngine } from '../../lib/search'
import type { SearchFilter } from '../../lib/search'

export type SearchEngine = ReturnType<typeof createSearchEngine>

export interface SearchElements {
  root: HTMLElement
  form: HTMLFormElement
  input: HTMLInputElement
  clearButton: HTMLButtonElement
  status: HTMLElement
  results: HTMLOListElement
  filterButtons: HTMLButtonElement[]
}

export interface SearchState {
  activeFilter: SearchFilter
  engine?: SearchEngine
  loadPromise?: Promise<SearchEngine>
  requestVersion: number
}

export interface SearchContext {
  elements: SearchElements
  state: SearchState
}
