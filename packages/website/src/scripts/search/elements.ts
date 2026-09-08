import type { SearchElements } from './types'

export function findSearchElements(root: HTMLElement): SearchElements {
  return {
    root,
    form: requireElement(root, '[data-search-form]') as HTMLFormElement,
    input: requireElement(root, '[data-search-input]') as HTMLInputElement,
    clearButton: requireElement(root, '[data-clear-search]') as HTMLButtonElement,
    status: requireElement(root, '[data-search-status]') as HTMLElement,
    results: requireElement(root, '[data-search-results]') as HTMLOListElement,
    filterButtons: Array.from(root.querySelectorAll('[data-search-filter]')),
  }
}

export function focusSearchInput(input: HTMLInputElement) {
  requestAnimationFrame(() => input.focus({ preventScroll: true }))
}

function requireElement(root: ParentNode, selector: string) {
  const element = root.querySelector(selector)
  if (!element) throw new Error(`Search element not found: ${selector}`)
  return element
}
