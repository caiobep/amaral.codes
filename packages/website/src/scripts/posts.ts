import type { EntryCategory } from '../content/schemas'
import { normalizeSearchText } from '../features/search/normalize-search-text'
import { getQueryParameter, setQueryParameter } from '../lib/query-parameters'

type PostFilter = 'all' | EntryCategory

interface PostElements {
  container: HTMLElement
  searchInput: HTMLInputElement
  filterButtons: HTMLButtonElement[]
  visibleCount: HTMLElement
  emptyState: HTMLElement
  endState: HTMLElement
  clearButton: HTMLButtonElement
  queryClearButton: HTMLButtonElement
}

interface PostContext {
  elements: PostElements
  activeFilter: PostFilter
  filters: ReadonlySet<PostFilter>
}

const requireElement = (root: ParentNode, selector: string) => {
  const element = root.querySelector(selector)
  if (!element) throw new Error(`Post element not found: ${selector}`)
  return element
}

const getInitialFilter = (filters: ReadonlySet<PostFilter>): PostFilter => {
  const params = new URLSearchParams(window.location.search)
  const filter = getQueryParameter(params, 'category') as PostFilter
  return filters.has(filter) ? filter : 'all'
}

const postMatches = (post: HTMLElement, query: string, filter: PostFilter) => {
  const content = normalizeSearchText(post.dataset.search ?? post.textContent)
  const matchesQuery = !query || content.includes(query)
  const matchesFilter = filter === 'all'
    || post.dataset.category === filter
  return matchesQuery && matchesFilter
}

const filterPostElements = (context: PostContext, query: string) => {
  const posts = context.elements.container.querySelectorAll<HTMLElement>('.post')
  let visibleCount = 0

  posts.forEach((post) => {
    const visible = postMatches(post, query, context.activeFilter)
    post.hidden = !visible
    if (!visible) return
    visibleCount += 1
  })

  return visibleCount
}

const updatePostUrl = (context: PostContext, query: string) => {
  const url = new URL(window.location.href)
  const rawQuery = context.elements.searchInput.value.trim()

  setQueryParameter(url.searchParams, 'query', query ? rawQuery : undefined)
  setQueryParameter(url.searchParams, 'featured', undefined)
  setQueryParameter(
    url.searchParams,
    'category',
    context.activeFilter === 'all' ? undefined : context.activeFilter,
  )

  window.history.replaceState({}, '', url)
}

const syncPostControls = (context: PostContext, visibleCount: number) => {
  context.elements.visibleCount.textContent = String(visibleCount)
  context.elements.emptyState.hidden = visibleCount !== 0
  context.elements.endState.hidden = visibleCount === 0
  context.elements.queryClearButton.hidden = context.elements.searchInput.value.length === 0
  context.elements.filterButtons.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.filter === context.activeFilter))
  })
}

const filterPosts = (context: PostContext) => {
  const query = normalizeSearchText(context.elements.searchInput.value.trim())
  const visibleCount = filterPostElements(context, query)
  syncPostControls(context, visibleCount)
  updatePostUrl(context, query)
}

const bindPostEvents = (context: PostContext) => {
  context.elements.searchInput.addEventListener('input', () => filterPosts(context))
  context.elements.filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const filter = button.dataset.filter as PostFilter
      if (!context.filters.has(filter)) return
      context.activeFilter = filter
      filterPosts(context)
    })
  })
  context.elements.clearButton.addEventListener('click', () => {
    context.elements.searchInput.value = ''
    context.activeFilter = 'all'
    context.elements.searchInput.focus()
    filterPosts(context)
  })
  context.elements.queryClearButton.addEventListener('click', () => {
    context.elements.searchInput.value = ''
    context.elements.searchInput.focus()
    filterPosts(context)
  })
  window.addEventListener('keydown', (event) => {
    if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return
    event.preventDefault()
    context.elements.searchInput.focus()
  })
}

const initializePosts = () => {
  const container = document.querySelector<HTMLElement>('.posts')
  if (!container || container.dataset.ready === 'true') return

  try {
    const filterButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-filter]'))
    const filters = new Set(
      filterButtons.map((button) => button.dataset.filter as PostFilter),
    )
    const context: PostContext = {
      activeFilter: getInitialFilter(filters),
      filters,
      elements: {
        container,
        searchInput: requireElement(document, '#search-post') as HTMLInputElement,
        filterButtons,
        visibleCount: requireElement(document, '#visible-post-count') as HTMLElement,
        emptyState: requireElement(document, '.empty-state') as HTMLElement,
        endState: requireElement(document, '[data-end-state]') as HTMLElement,
        clearButton: requireElement(document, '[data-clear-search]') as HTMLButtonElement,
        queryClearButton: requireElement(document, '[data-clear-post-query]') as HTMLButtonElement,
      },
    }

    container.dataset.ready = 'true'
    const params = new URLSearchParams(window.location.search)
    context.elements.searchInput.value = getQueryParameter(params, 'query') ?? ''
    bindPostEvents(context)
    filterPosts(context)
  } catch (error) {
    console.error('Unable to initialize post filters.', error)
  }
}

document.addEventListener('astro:page-load', initializePosts)
initializePosts()
