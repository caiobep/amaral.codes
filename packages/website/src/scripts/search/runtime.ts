import { searchDocuments } from '../../lib/search'
import { getQueryParameter, setQueryParameter } from '../../lib/query-parameters'
import type { SearchFilter } from '../../lib/search'
import { findSearchElements, focusSearchInput } from './elements'
import { loadSearchEngine } from './engine'
import { getStatusText, renderResults } from './results'
import type { SearchContext } from './types'

export function initializeSearch() {
  const root = document.querySelector<HTMLElement>('[data-search-root]')
  if (!root || root.dataset.ready === 'true') return

  try {
    const params = new URLSearchParams(window.location.search)
    const context: SearchContext = {
      elements: findSearchElements(root),
      state: { activeFilter: getInitialFilter(params), requestVersion: 0 },
    }

    root.dataset.ready = 'true'
    context.elements.input.value = getQueryParameter(params, 'query') ?? ''
    focusSearchInput(context.elements.input)
    bindSearchEvents(context)()
  } catch (error) {
    console.error('Unable to initialize search.', error)
  }
}

function getInitialFilter(params: URLSearchParams): SearchFilter {
  const filter = getQueryParameter(params, 'category')
  if (filter === 'writing' || filter === 'project') return filter
  return 'all'
}

function bindSearchEvents(context: SearchContext) {
  const queueSearch = () => {
    runSearch(context).catch((error: unknown) => console.error('Search failed.', error))
  }

  context.elements.form.addEventListener('submit', (event) => {
    event.preventDefault()
    queueSearch()
  })
  context.elements.input.addEventListener('input', queueSearch)
  context.elements.clearButton.addEventListener('click', () => clearSearch(context, queueSearch))
  context.elements.filterButtons.forEach((button) => {
    button.addEventListener('click', () => selectFilter(context, button, queueSearch))
  })

  return queueSearch
}

function clearSearch(context: SearchContext, queueSearch: () => void) {
  context.elements.input.value = ''
  context.elements.input.focus()
  queueSearch()
}

function selectFilter(
  context: SearchContext,
  button: HTMLButtonElement,
  queueSearch: () => void,
) {
  const filter = button.dataset.searchFilter
  if (filter !== 'all' && filter !== 'writing' && filter !== 'project') return
  context.state.activeFilter = filter
  queueSearch()
}

async function runSearch(context: SearchContext) {
  const { elements, state } = context
  const query = elements.input.value.trim()
  const version = ++state.requestVersion

  updateUrl(context)
  syncControls(context, query)
  if (query.length < 2) { showShortQueryStatus(context, query); return }

  elements.status.textContent = 'Searching…'

  try {
    const engine = await loadSearchEngine(state)
    if (version !== state.requestVersion) return
    const matches = searchDocuments(engine, query, state.activeFilter)
    renderResults(elements.results, matches)
    elements.status.textContent = getStatusText(query, matches.length)
  } catch (error) {
    console.error('Unable to load the static search index.', error)
    if (version !== state.requestVersion) return
    renderResults(elements.results, [])
    elements.status.textContent = 'Search could not load. Please try again.'
  }
}

function updateUrl({ elements, state }: SearchContext) {
  const url = new URL(window.location.href)
  const query = elements.input.value.trim()

  setQueryParameter(url.searchParams, 'query', query)
  setQueryParameter(
    url.searchParams,
    'category',
    state.activeFilter === 'all' ? undefined : state.activeFilter,
  )

  window.history.replaceState({}, '', url)
}

function syncControls({ elements, state }: SearchContext, query: string) {
  elements.clearButton.hidden = query.length === 0
  elements.filterButtons.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.searchFilter === state.activeFilter))
  })
}

function showShortQueryStatus({ elements }: SearchContext, query: string) {
  renderResults(elements.results, [])
  elements.status.textContent = query.length === 1
    ? 'Keep typing to search.'
    : 'Type at least two characters to search.'
}
