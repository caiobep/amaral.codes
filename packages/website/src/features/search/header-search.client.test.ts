// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getHeaderSearchElements, initializeHeaderSearch } from './header-search.client'
import { resetBrowserSearchForTesting } from './load-browser-search'

const documents = [{
  id: 'project:fixture', type: 'project', title: 'Lifecycle project',
  href: '/projects/fixture', summary: 'A test project', content: '',
  category: 'Software', topics: [], external: false,
}]

let media: MediaQueryList
let fetchIndex: ReturnType<typeof vi.fn<typeof fetch>>
const keydownListeners: EventListenerOrEventListenerObject[] = []

function setup() {
  document.body.innerHTML = `
    <nav class="site-nav"><a href="/projects">Projects</a></nav><main></main>
    <div class="header-actions">
      <a data-header-search-link href="/search">Search</a>
      <button data-header-search-open aria-expanded="false">Search</button>
      <form data-header-search data-open="false" aria-hidden="true" inert>
        <button type="button" data-header-search-close>Close</button>
        <input data-header-search-input aria-expanded="false">
        <button type="button" data-header-search-clear hidden>Clear</button>
        <p data-header-search-status></p><ol data-header-search-results></ol>
        <a data-header-search-all href="/search" hidden>All results</a>
      </form>
    </div>`
  const form = document.querySelector('form')
  if (!form) throw new Error('Missing fixture form')
  const elements = getHeaderSearchElements(form)
  initializeHeaderSearch()
  return elements
}

function resize(matches: boolean) {
  Object.defineProperty(media, 'matches', { configurable: true, value: matches })
  media.dispatchEvent(new MediaQueryListEvent('change', { matches }))
}

function query(input: HTMLInputElement, value: string) {
  input.value = value
  input.dispatchEvent(new Event('input'))
}

beforeEach(() => {
  resetBrowserSearchForTesting()
  const listen = document.addEventListener.bind(document)
  vi.spyOn(document, 'addEventListener').mockImplementation((type, listener, options) => {
    if (type === 'keydown') keydownListeners.push(listener)
    listen(type, listener, options)
  })
  media = Object.assign(new EventTarget(), { matches: true }) as MediaQueryList
  vi.spyOn(window, 'matchMedia').mockReturnValue(media)
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { callback(0); return 1 })
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  fetchIndex = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(documents)))
  vi.stubGlobal('fetch', fetchIndex)
})

afterEach(() => {
  keydownListeners.splice(0).forEach(listener => document.removeEventListener('keydown', listener))
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
  delete document.documentElement.dataset.searchOverlayOpen
})

describe('header search breakpoint lifecycle', () => {
  it('closes an open overlay on crossing 920px, clears selection and releases background focus', async () => {
    const elements = setup()
    elements.trigger.click()
    query(elements.input, 'lifecycle')
    await vi.waitFor(() => expect(elements.results.children).toHaveLength(1))
    elements.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
    expect(elements.input.getAttribute('aria-activedescendant')).toBe('header-search-option-0')
    resize(false)
    expect(elements.form.dataset.open).toBe('false')
    expect(elements.form.getAttribute('aria-hidden')).toBe('true')
    expect(elements.trigger.getAttribute('aria-expanded')).toBe('false')
    expect(elements.input.getAttribute('aria-expanded')).toBe('false')
    expect(elements.input.hasAttribute('aria-activedescendant')).toBe(false)
    expect(elements.results.children).toHaveLength(0)
    expect(elements.allResultsLink.hidden).toBe(true)
    expect(document.querySelector('main')?.inert).toBe(false)
    expect(document.querySelector('nav')?.inert).toBe(false)
    expect(document.activeElement).toBe(elements.desktopLink)
    resize(true)
    expect(elements.form.dataset.open).toBe('false')
    elements.trigger.click()
    await vi.waitFor(() => expect(elements.results.children).toHaveLength(1))
    expect(elements.input.hasAttribute('aria-activedescendant')).toBe(false)
    expect(document.activeElement).toBe(elements.input)
  })

  it('does not close on mobile or steal focus when an already closed overlay crosses the breakpoint', () => {
    const elements = setup()
    elements.trigger.click()
    resize(true)
    expect(elements.form.dataset.open).toBe('true')
    elements.closeButton.click()
    const projectLink = document.querySelector<HTMLAnchorElement>('nav a')
    projectLink?.focus()
    resize(false)
    expect(document.activeElement).toBe(projectLink)
  })

  it.each(['resolve', 'reject'] as const)('ignores a late search %s after the desktop transition', async outcome => {
    const pending = Promise.withResolvers<Response>()
    fetchIndex.mockReturnValue(pending.promise)
    const elements = setup()
    elements.trigger.click()
    query(elements.input, 'lifecycle')
    resize(false)
    if (outcome === 'resolve') pending.resolve(new Response(JSON.stringify(documents)))
    else pending.reject(new Error('offline'))
    await vi.dynamicImportSettled()
    await vi.waitFor(() => {
      if (outcome === 'resolve') expect(fetchIndex).toHaveResolved()
      else expect(console.error).toHaveBeenCalled()
    })
    expect(elements.results.children).toHaveLength(0)
    expect(elements.input.getAttribute('aria-expanded')).toBe('false')
    expect(elements.status.textContent).toBe('Search writing and projects.')
    expect(document.activeElement).toBe(elements.desktopLink)
  })

  it.each(['button', 'Escape'] as const)('ignores a late search after closing with %s', async closeWith => {
    const pending = Promise.withResolvers<Response>()
    fetchIndex.mockReturnValue(pending.promise)
    const elements = setup()
    elements.trigger.click()
    query(elements.input, 'lifecycle')
    if (closeWith === 'button') elements.closeButton.click()
    else elements.form.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    pending.resolve(new Response(JSON.stringify(documents)))
    await vi.dynamicImportSettled()
    await vi.waitFor(() => expect(fetchIndex).toHaveResolved())
    expect(elements.form.dataset.open).toBe('false')
    expect(elements.results.children).toHaveLength(0)
    expect(elements.input.getAttribute('aria-expanded')).toBe('false')
    expect(elements.status.textContent).toBe('Search writing and projects.')
  })
})

describe('header search runtime', () => {
  it('initializes each form only once and shares one pending and cached search runtime', async () => {
    const elements = setup()
    initializeHeaderSearch()
    elements.trigger.click()
    query(elements.input, 'lifecycle')
    query(elements.input, 'project')
    await vi.waitFor(() => expect(elements.results.children).toHaveLength(1))
    query(elements.input, 'fixture')
    await vi.waitFor(() => expect(elements.status.textContent).not.toBe('Searching…'))
    expect(fetchIndex).toHaveBeenCalledExactlyOnceWith('/search-index.json')
    expect(elements.form.dataset.headerSearch).toBe('ready')
  })

  it('clears results for a short query without allowing the preceding request to repopulate them', async () => {
    const pending = Promise.withResolvers<Response>()
    fetchIndex.mockReturnValue(pending.promise)
    const elements = setup()
    elements.trigger.click()
    query(elements.input, 'lifecycle')
    query(elements.input, 'l')
    expect(elements.status.textContent).toBe('Keep typing to search.')
    pending.resolve(new Response(JSON.stringify(documents)))
    await vi.dynamicImportSettled()
    await vi.waitFor(() => expect(fetchIndex).toHaveResolved())
    expect(elements.results.children).toHaveLength(0)
    expect(elements.allResultsLink.hidden).toBe(true)
    elements.clearButton.click()
    expect(elements.input.value).toBe('')
    expect(elements.clearButton.hidden).toBe(true)
    expect(elements.status.textContent).toBe('Search writing and projects.')
    expect(document.activeElement).toBe(elements.input)
  })

  it('reports an HTTP failure and allows a subsequent input to retry', async () => {
    fetchIndex.mockResolvedValueOnce(new Response('', { status: 503 }))
    const elements = setup()
    elements.trigger.click()
    query(elements.input, 'lifecycle')
    await vi.waitFor(() => expect(elements.status.textContent).toBe('Search could not load. Please try again.'))
    expect(console.error).toHaveBeenCalledWith('Search preload failed.', expect.any(Error))
    query(elements.input, 'lifecycle')
    await vi.waitFor(() => expect(elements.results.children).toHaveLength(1))
    expect(fetchIndex).toHaveBeenCalledTimes(2)
  })

  it('prevents submitting short queries but allows useful queries', () => {
    const elements = setup()
    const shortSubmit = new Event('submit', { cancelable: true })
    elements.form.dispatchEvent(shortSubmit)
    expect(shortSubmit.defaultPrevented).toBe(true)
    elements.input.value = 'lifecycle'
    const submit = new Event('submit', { cancelable: true })
    elements.form.dispatchEvent(submit)
    expect(submit.defaultPrevented).toBe(false)
  })

  it('closes via the bound Escape handler and external-result clicks', () => {
    const elements = setup()
    elements.trigger.click()
    elements.form.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(elements.form.dataset.open).toBe('false')
    elements.trigger.click()
    elements.results.dispatchEvent(new Event('click'))
    expect(elements.form.dataset.open).toBe('true')
    elements.results.innerHTML = '<li><a target="_blank"><strong>External</strong></a></li>'
    elements.results.querySelector('strong')?.click()
    expect(elements.form.dataset.open).toBe('false')
    expect(document.activeElement).not.toBe(elements.trigger)
  })

  it('reports missing required elements without marking a broken form ready', () => {
    document.body.innerHTML = '<form data-header-search></form>'
    initializeHeaderSearch()
    expect(document.querySelector('form')?.dataset.headerSearch).toBe('')
    expect(console.error).toHaveBeenCalledWith('Unable to initialize header search.', expect.any(Error))
  })
})

describe('header search event boundaries', () => {
  it('handles text-node result click targets without closing the overlay', () => {
    const elements = setup()
    elements.trigger.click()
    const text = document.createTextNode('Result text')
    elements.results.append(text)
    text.dispatchEvent(new Event('click', { bubbles: true }))
    expect(elements.form.dataset.open).toBe('true')
  })

  it('binds the desktop keyboard shortcut once per initialized form', () => {
    const elements = setup()
    initializeHeaderSearch()
    const openDesktopSearch = vi.spyOn(elements.desktopLink, 'click').mockImplementation(() => undefined)
    const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, cancelable: true })
    document.dispatchEvent(event)
    expect(openDesktopSearch).toHaveBeenCalledOnce()
    expect(event.defaultPrevented).toBe(true)
  })

  it('reports unexpected search interaction errors rather than dropping a rejected promise', async () => {
    const elements = setup()
    const error = new Error('Cannot update search status')
    vi.spyOn(elements.status, 'textContent', 'set').mockImplementationOnce(() => { throw error })
    elements.trigger.click()
    await vi.waitFor(() => expect(console.error).toHaveBeenCalledWith('Header search failed.', error))
  })
})
