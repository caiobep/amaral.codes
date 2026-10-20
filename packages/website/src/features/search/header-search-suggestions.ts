import type {
  HeaderSearchElements,
  HeaderSearchState,
  SearchDocument,
} from './header-search-model'

function formatSuggestionMeta(match: SearchDocument) {
  const kind = match.type === 'writing' ? match.category : 'Project'
  if (!match.date) return kind
  const date = new Date(`${match.date.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(date.valueOf())) return kind
  const year = new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'UTC' })
    .format(date)
  return `${kind} · ${year}`
}

function createSuggestion(match: SearchDocument, index: number) {
  const item = document.createElement('li')
  const link = document.createElement('a')
  const meta = document.createElement('small')
  const title = document.createElement('strong')
  const summary = document.createElement('span')
  const arrow = document.createElement('i')

  link.href = match.href
  link.id = `header-search-option-${String(index)}`
  link.role = 'option'
  link.tabIndex = -1
  link.setAttribute('aria-selected', 'false')
  if (match.external) Object.assign(link, { target: '_blank', rel: 'noopener noreferrer' })
  meta.textContent = formatSuggestionMeta(match)
  title.textContent = match.title
  summary.textContent = match.summary
  arrow.textContent = match.external ? '↗' : '→'
  arrow.setAttribute('aria-hidden', 'true')
  link.append(meta, title)
  if (summary.textContent) link.append(summary)
  link.append(arrow)
  item.role = 'none'
  item.append(link)
  return item
}

function getSuggestionOptions(elements: HeaderSearchElements) {
  return Array.from(elements.results.querySelectorAll<HTMLElement>('[role="option"]'))
}

function resetActiveSuggestion(
  elements: HeaderSearchElements,
  state: HeaderSearchState,
) {
  state.activeIndex = -1
  elements.input.removeAttribute('aria-activedescendant')
  getSuggestionOptions(elements)
    .forEach(option => option.setAttribute('aria-selected', 'false'))
}

export function renderSuggestions(
  elements: HeaderSearchElements,
  state: HeaderSearchState,
  matches: SearchDocument[],
) {
  elements.results.replaceChildren(...matches.map(createSuggestion))
  resetActiveSuggestion(elements, state)
  elements.input.setAttribute('aria-expanded', String(matches.length > 0))
}

export function setAllResultsLink(
  link: HTMLAnchorElement,
  query: string,
  visible: boolean,
) {
  link.href = `/search?${new URLSearchParams({ query }).toString()}`
  link.hidden = !visible
}

export function showShortQuery(
  elements: HeaderSearchElements,
  state: HeaderSearchState,
  query: string,
) {
  renderSuggestions(elements, state, [])
  setAllResultsLink(elements.allResultsLink, query, false)
  elements.status.textContent = query.length === 1
    ? 'Keep typing to search.'
    : 'Search writing and projects.'
}

export function getSuggestionStatus(matches: SearchDocument[], query: string) {
  if (matches.length === 0) return `No results for “${query}”.`
  return `${String(matches.length)} ${matches.length === 1 ? 'suggestion' : 'suggestions'}`
}

function setActiveSuggestion(
  elements: HeaderSearchElements,
  state: HeaderSearchState,
  index: number,
) {
  const options = getSuggestionOptions(elements)
  if (options.length === 0) return

  const activeIndex = (index + options.length) % options.length
  options.forEach((option, optionIndex) => {
    option.setAttribute('aria-selected', String(optionIndex === activeIndex))
  })
  const activeOption = options[activeIndex]
  if (!activeOption) return
  state.activeIndex = activeIndex
  elements.input.setAttribute('aria-activedescendant', activeOption.id)
  activeOption.scrollIntoView({ block: 'nearest' })
}

function moveActiveSuggestion(
  elements: HeaderSearchElements,
  state: HeaderSearchState,
  direction: -1 | 1,
) {
  const options = getSuggestionOptions(elements)
  if (options.length === 0) return
  const startingIndex = state.activeIndex < 0 && direction < 0
    ? options.length
    : state.activeIndex
  setActiveSuggestion(elements, state, startingIndex + direction)
}

function openActiveSuggestion(elements: HeaderSearchElements, state: HeaderSearchState) {
  const option = getSuggestionOptions(elements)[state.activeIndex]
  if (option instanceof HTMLAnchorElement) option.click()
}

export function handleSuggestionKeydown(
  event: KeyboardEvent,
  elements: HeaderSearchElements,
  state: HeaderSearchState,
) {
  if (event.key === 'ArrowDown') {
    event.preventDefault()
    moveActiveSuggestion(elements, state, 1)
    return
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault()
    moveActiveSuggestion(elements, state, -1)
    return
  }
  if (event.key === 'Enter' && state.activeIndex >= 0) {
    event.preventDefault()
    openActiveSuggestion(elements, state)
  }
}
