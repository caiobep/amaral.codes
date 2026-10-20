import { normalizeSearchText } from '../features/search/normalize-search-text'
import { getQueryParameter, setQueryParameter } from '../lib/query-parameters'

interface ProjectFilterElements {
  clearButton: HTMLButtonElement
  emptyState: HTMLElement
  filterButtons: HTMLButtonElement[]
  groups: HTMLElement[]
  projects: HTMLElement[]
  results: HTMLElement
  searchInput: HTMLInputElement
}

interface ProjectFilterContext {
  activeLabel: string
  elements: ProjectFilterElements
  labels: ReadonlySet<string>
}

const requireElement = (root: ParentNode, selector: string) => {
  const element = root.querySelector(selector)
  if (!element) throw new Error(`Project filter element not found: ${selector}`)
  return element
}

const getInitialLabel = (labels: ReadonlySet<string>) => {
  const params = new URLSearchParams(window.location.search)
  const label = getQueryParameter(params, 'label') ?? 'all'
  return labels.has(label) ? label : 'all'
}

const matchesProject = (project: HTMLElement, query: string, label: string) => {
  const searchText = normalizeSearchText(project.dataset.projectSearch ?? project.textContent)
  const matchesQuery = !query || searchText.includes(query)
  const matchesLabel = label === 'all' || project.dataset.projectLabel === label
  return matchesQuery && matchesLabel
}

const updateProjectVisibility = (context: ProjectFilterContext, query: string) => (
  context.elements.projects.filter((project) => {
    const visible = matchesProject(project, query, context.activeLabel)
    project.hidden = !visible
    return visible
  }).length
)

const updateGroupVisibility = (elements: ProjectFilterElements) => {
  elements.groups.forEach((group) => {
    group.hidden = group.querySelector('[data-project]:not([hidden])') === null
  })
}

const updateProjectUrl = (context: ProjectFilterContext, query: string) => {
  const url = new URL(window.location.href)
  const rawQuery = context.elements.searchInput.value.trim()
  setQueryParameter(url.searchParams, 'query', query ? rawQuery : undefined)
  setQueryParameter(
    url.searchParams,
    'label',
    context.activeLabel === 'all' ? undefined : context.activeLabel,
  )
  window.history.replaceState({}, '', url)
}

const syncProjectControls = (context: ProjectFilterContext, visibleCount: number) => {
  context.elements.emptyState.hidden = visibleCount !== 0
  context.elements.filterButtons.forEach((button) => {
    button.setAttribute(
      'aria-pressed',
      String(button.dataset.projectFilter === context.activeLabel),
    )
  })
}

const filterProjects = (context: ProjectFilterContext) => {
  const query = normalizeSearchText(context.elements.searchInput.value.trim())
  context.elements.results.dataset.searching = String(query.length > 0)
  const visibleCount = updateProjectVisibility(context, query)
  updateGroupVisibility(context.elements)
  syncProjectControls(context, visibleCount)
  updateProjectUrl(context, query)
}

const bindProjectFilterEvents = (context: ProjectFilterContext) => {
  context.elements.searchInput.addEventListener('input', () => filterProjects(context))
  context.elements.filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const label = button.dataset.projectFilter ?? 'all'
      if (!context.labels.has(label)) return
      context.activeLabel = label
      filterProjects(context)
    })
  })
  context.elements.clearButton.addEventListener('click', () => {
    context.activeLabel = 'all'
    context.elements.searchInput.value = ''
    context.elements.searchInput.focus()
    filterProjects(context)
  })
}

const initializeProjectFilters = () => {
  const controls = document.querySelector<HTMLElement>('[data-project-controls]')
  if (!controls || controls.dataset.ready === 'true') return

  try {
    const filterButtons = Array.from(
      controls.querySelectorAll<HTMLButtonElement>('[data-project-filter]'),
    )
    const labels = new Set(filterButtons.map((button) => button.dataset.projectFilter ?? 'all'))
    const context: ProjectFilterContext = {
      activeLabel: getInitialLabel(labels),
      labels,
      elements: {
        clearButton: requireElement(document, '[data-clear-project-search]') as HTMLButtonElement,
        emptyState: requireElement(document, '.project-empty-state') as HTMLElement,
        filterButtons,
        groups: Array.from(document.querySelectorAll<HTMLElement>('[data-project-group]')),
        projects: Array.from(document.querySelectorAll<HTMLElement>('[data-project]')),
        results: requireElement(document, '#project-results') as HTMLElement,
        searchInput: requireElement(controls, '#search-projects') as HTMLInputElement,
      },
    }

    controls.dataset.ready = 'true'
    const params = new URLSearchParams(window.location.search)
    context.elements.searchInput.value = getQueryParameter(params, 'query') ?? ''
    bindProjectFilterEvents(context)
    filterProjects(context)
  } catch (error) {
    console.error('Unable to initialize project filters.', error)
  }
}

document.addEventListener('astro:page-load', initializeProjectFilters)
initializeProjectFilters()
