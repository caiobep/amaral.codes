import { getHeaderSearchElements } from '../elements'
import type {
  HeaderSearchElements,
  HeaderSearchState,
  SearchDocument,
} from '../model'
import { handleOverlayKeydown, setSearchOpen } from '../overlay'
import { handleDesktopSearchShortcut } from '../shortcut'
import {
  getSuggestionStatus,
  handleSuggestionKeydown,
  renderSuggestions,
  setAllResultsLink,
  showShortQuery,
} from '../suggestions'

function loadHeaderSearchRuntime(state: HeaderSearchState) {
  if (state.runtime) return Promise.resolve(state.runtime)
  if (state.runtimePromise) return state.runtimePromise

  state.runtimePromise = Promise.all([
    fetch('/search-index.json'),
    import('../../../../lib/search'),
  ]).then(async ([response, searchModule]) => {
    if (!response.ok) throw new Error(`Search index returned ${String(response.status)}`)
    const documents = await response.json() as SearchDocument[]
    state.runtime = {
      engine: searchModule.createSearchEngine(documents),
      search: searchModule.searchDocuments,
    }
    return state.runtime
  }).catch((error: unknown) => {
    delete state.runtimePromise
    throw error
  })

  return state.runtimePromise
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
    const runtime = await loadHeaderSearchRuntime(state)
    if (version !== state.requestVersion) return
    const matches = runtime.search(runtime.engine, query, 'all', 6)
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
) {
  const queueSearch = () => {
    runHeaderSearch(elements, state)
      .catch((error: unknown) => console.error('Header search failed.', error))
  }

  elements.trigger.addEventListener('click', () => {
    setSearchOpen(elements, true)
    loadHeaderSearchRuntime(state)
      .catch((error: unknown) => console.error('Search preload failed.', error))
    queueSearch()
  })
  elements.closeButton.addEventListener('click', () => setSearchOpen(elements, false))
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
  elements.form.addEventListener('keydown', event => handleOverlayKeydown(event, elements))
  elements.form.addEventListener('submit', event => {
    if (elements.input.value.trim().length >= 2) return
    event.preventDefault()
    queueSearch()
  })
  elements.results.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return
    const link = event.target.closest('a')
    if (link?.getAttribute('target') === '_blank') setSearchOpen(elements, false, false)
  })
  document.addEventListener(
    'keydown',
    event => handleDesktopSearchShortcut(event, elements),
  )
}

function bindSearchBreakpoint(elements: HeaderSearchElements, state: HeaderSearchState) {
  window.matchMedia('(max-width: 920px)').addEventListener('change', event => {
    if (event.matches || elements.form.dataset.open !== 'true') return
    state.requestVersion += 1
    showShortQuery(elements, state, '')
    setSearchOpen(elements, false)
  })
}

function bindHeaderSearch(form: HTMLFormElement) {
  if (form.dataset.headerSearch === 'ready') return

  try {
    const elements = getHeaderSearchElements(form)
    const state: HeaderSearchState = { activeIndex: -1, requestVersion: 0 }
    form.dataset.headerSearch = 'ready'
    bindSearchInteractions(elements, state)
    bindSearchBreakpoint(elements, state)
  } catch (error) {
    console.error('Unable to initialize header search.', error)
  }
}

export function initializeHeaderSearch() {
  document.querySelectorAll<HTMLFormElement>('[data-header-search]')
    .forEach(bindHeaderSearch)
}
