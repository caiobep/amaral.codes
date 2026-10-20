import type {
  HeaderSearchElements,
  HeaderSearchState,
} from './header-search-model'
import { handleOverlayKeydown, setSearchOpen } from './header-search-overlay'
import { loadBrowserSearch } from './load-browser-search'
import {
  getSuggestionStatus,
  handleSuggestionKeydown,
  renderSuggestions,
  setAllResultsLink,
  showShortQuery,
} from './header-search-suggestions'

const DESKTOP_SHORTCUT_MEDIA = '(min-width: 921px) and (hover: hover) and (pointer: fine)'

function requireHeaderSearchElement(root: ParentNode, selector: string) {
  const element = root.querySelector(selector)
  if (!element) throw new Error(`Header search element not found: ${selector}`)
  return element
}

export function getHeaderSearchElements(form: HTMLFormElement): HeaderSearchElements {
  return {
    allResultsLink: requireHeaderSearchElement(form, '[data-header-search-all]') as HTMLAnchorElement,
    clearButton: requireHeaderSearchElement(form, '[data-header-search-clear]') as HTMLButtonElement,
    closeButton: requireHeaderSearchElement(form, '[data-header-search-close]') as HTMLButtonElement,
    desktopLink: requireHeaderSearchElement(document, '[data-header-search-link]') as HTMLAnchorElement,
    form,
    input: requireHeaderSearchElement(form, '[data-header-search-input]') as HTMLInputElement,
    results: requireHeaderSearchElement(form, '[data-header-search-results]') as HTMLOListElement,
    status: requireHeaderSearchElement(form, '[data-header-search-status]') as HTMLElement,
    trigger: requireHeaderSearchElement(document, 'button[data-header-search-open]') as HTMLButtonElement,
  }
}

function isEditableTarget(target: EventTarget | null) {
  return target instanceof Element
    && target.closest('input, textarea, select, [contenteditable="true"]') !== null
}

function hasSearchShortcutModifier(event: KeyboardEvent) {
  return (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey
}

function hasSearchShortcutKey(event: KeyboardEvent) {
  const key = event.key.toLowerCase()
  return key === 'k' || key === 'p'
}

function isDesktopSearchShortcut(event: KeyboardEvent) {
  return window.matchMedia(DESKTOP_SHORTCUT_MEDIA).matches
    && !event.repeat
    && hasSearchShortcutKey(event)
    && hasSearchShortcutModifier(event)
}

export function handleDesktopSearchShortcut(event: KeyboardEvent, elements: HeaderSearchElements) {
  if (!isDesktopSearchShortcut(event) || isEditableTarget(event.target)) return
  event.preventDefault()
  if (window.location.pathname.startsWith('/search')) {
    document.querySelector<HTMLInputElement>('[data-search-input]')
      ?.focus({ preventScroll: true })
    return
  }
  elements.desktopLink.click()
}

function closeHeaderSearch(
  elements: HeaderSearchElements,
  state: HeaderSearchState,
  restoreFocus = true,
) {
  state.requestVersion += 1
  showShortQuery(elements, state, '')
  setSearchOpen(elements, false, restoreFocus)
}

async function runHeaderSearch(
  elements: HeaderSearchElements,
  state: HeaderSearchState,
) {
  const query = elements.input.value.trim()
  const version = ++state.requestVersion
  elements.clearButton.hidden = query.length === 0

  if (query.length < 2) {
    showShortQuery(elements, state, query)
    return
  }

  elements.status.textContent = 'Searching…'
  renderSuggestions(elements, state, [])
  setAllResultsLink(elements.allResultsLink, query, true)

  try {
    const runtime = await loadBrowserSearch()
    if (version !== state.requestVersion) return
    const matches = runtime.searchDocuments(runtime.engine, query, 'all', 6)
    renderSuggestions(elements, state, matches)
    elements.status.textContent = getSuggestionStatus(matches, query)
  } catch (error) {
    console.error('Unable to load header search.', error)
    if (version !== state.requestVersion) return
    renderSuggestions(elements, state, [])
    elements.status.textContent = 'Search could not load. Please try again.'
  }
}

function bindSearchInteractions(
  elements: HeaderSearchElements,
  state: HeaderSearchState,
  closeSearch: (restoreFocus?: boolean) => void,
) {
  const queueSearch = () => {
    runHeaderSearch(elements, state)
      .catch((error: unknown) => console.error('Header search failed.', error))
  }

  elements.trigger.addEventListener('click', () => {
    setSearchOpen(elements, true)
    loadBrowserSearch()
      .catch((error: unknown) => console.error('Search preload failed.', error))
    queueSearch()
  })
  elements.closeButton.addEventListener('click', () => closeSearch())
  elements.form.addEventListener(
    'keydown',
    event => handleOverlayKeydown(event, elements, closeSearch),
  )
  elements.results.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return
    const link = event.target.closest('a')
    if (link?.getAttribute('target') === '_blank') closeSearch(false)
  })
  elements.clearButton.addEventListener('click', () => {
    elements.input.value = ''
    elements.input.focus({ preventScroll: true })
    queueSearch()
  })
  elements.input.addEventListener('input', queueSearch)
  elements.input.addEventListener(
    'keydown',
    event => handleSuggestionKeydown(event, elements, state),
  )
  elements.form.addEventListener('submit', event => {
    if (elements.input.value.trim().length >= 2) return
    event.preventDefault()
    queueSearch()
  })
  document.addEventListener(
    'keydown',
    event => handleDesktopSearchShortcut(event, elements),
  )
}

function createCloseSearch(
  elements: HeaderSearchElements,
  state: HeaderSearchState,
) {
  return (restoreFocus = true) => (
    closeHeaderSearch(elements, state, restoreFocus)
  )
}

function bindSearchBreakpoint(elements: HeaderSearchElements, state: HeaderSearchState) {
  window.matchMedia('(max-width: 920px)').addEventListener('change', event => {
    if (event.matches || elements.form.dataset.open !== 'true') return
    closeHeaderSearch(elements, state)
  })
}

function bindHeaderSearch(form: HTMLFormElement) {
  if (form.dataset.headerSearch === 'ready') return

  try {
    const elements = getHeaderSearchElements(form)
    const state: HeaderSearchState = { activeIndex: -1, requestVersion: 0 }
    const closeSearch = createCloseSearch(elements, state)
    form.dataset.headerSearch = 'ready'
    bindSearchInteractions(elements, state, closeSearch)
    bindSearchBreakpoint(elements, state)
  } catch (error) {
    console.error('Unable to initialize header search.', error)
  }
}

export function initializeHeaderSearch() {
  document.querySelectorAll<HTMLFormElement>('[data-header-search]')
    .forEach(bindHeaderSearch)
}
