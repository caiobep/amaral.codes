import type { HeaderSearchElements } from './model'

function requireElement(root: ParentNode, selector: string) {
  const element = root.querySelector(selector)
  if (!element) throw new Error(`Header search element not found: ${selector}`)
  return element
}

export function getHeaderSearchElements(form: HTMLFormElement): HeaderSearchElements {
  return {
    allResultsLink: requireElement(form, '[data-header-search-all]') as HTMLAnchorElement,
    clearButton: requireElement(form, '[data-header-search-clear]') as HTMLButtonElement,
    closeButton: requireElement(form, '[data-header-search-close]') as HTMLButtonElement,
    desktopLink: requireElement(document, '[data-header-search-link]') as HTMLAnchorElement,
    form,
    input: requireElement(form, '[data-header-search-input]') as HTMLInputElement,
    results: requireElement(form, '[data-header-search-results]') as HTMLOListElement,
    status: requireElement(form, '[data-header-search-status]') as HTMLElement,
    trigger: requireElement(document, 'button[data-header-search-open]') as HTMLButtonElement,
  }
}
