import { getQueryParameter, setQueryParameter } from '../../lib/query-parameters'
import type { SearchFilter } from './search-document'
import { loadBrowserSearch } from './load-browser-search'
import { getStatusText, renderResults } from './search-page-results'

interface SearchPageElements {
  root: HTMLElement
  form: HTMLFormElement
  input: HTMLInputElement
  clearButton: HTMLButtonElement
  status: HTMLElement
  results: HTMLOListElement
  filterButtons: HTMLButtonElement[]
}

interface SearchContext {
  elements: SearchPageElements
  state: {
    activeFilter: SearchFilter
    requestVersion: number
  }
}

function requireSearchPageElement(root: ParentNode, selector: string) {
  const element = root.querySelector(selector)
  if (!element) throw new Error(`Search element not found: ${selector}`)
  return element
}

function findSearchPageElements(root: HTMLElement): SearchPageElements {
  return {
    root,
    form: requireSearchPageElement(root, '[data-search-form]') as HTMLFormElement,
    input: requireSearchPageElement(root, '[data-search-input]') as HTMLInputElement,
    clearButton: requireSearchPageElement(root, '[data-clear-search]') as HTMLButtonElement,
    status: requireSearchPageElement(root, '[data-search-status]') as HTMLElement,
    results: requireSearchPageElement(root, '[data-search-results]') as HTMLOListElement,
    filterButtons: Array.from(root.querySelectorAll('[data-search-filter]')),
  }
}

function focusSearchInput(input: HTMLInputElement) {
  requestAnimationFrame(() => input.focus({ preventScroll: true }))
}

export function initializeSearchPage() {
  const root = document.querySelector<HTMLElement>('[data-search-root]')
  if (!root || root.dataset.ready === 'true') return

  try {
    const params = new URLSearchParams(window.location.search)
    const context: SearchContext = {
      elements: findSearchPageElements(root),
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

document.addEventListener('astro:page-load', initializeSearchPage)
initializeSearchPage()

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
    const runtime = await loadBrowserSearch()
    if (version !== state.requestVersion) return
    const matches = runtime.searchDocuments(runtime.engine, query, state.activeFilter)
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
