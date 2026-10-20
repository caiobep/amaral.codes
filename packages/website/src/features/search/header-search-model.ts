import type { SearchDocument } from './search-document'

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
}

export type { SearchDocument }
