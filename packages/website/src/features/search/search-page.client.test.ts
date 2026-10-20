// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetBrowserSearchForTesting } from './load-browser-search'
import { initializeSearchPage } from './search-page.client'
import type { SearchDocument } from './search-document'
import { element, input, mount } from '../../../tests/runtime/dom'

const note: SearchDocument = { id: 'note', type: 'writing', category: 'note', title: 'Tools for work', summary: 'Software notes', href: '/posts/tools', topics: ['tools'], content: '', date: '2022-01-01', external: false }
const project: SearchDocument = { id: 'project', type: 'project', category: 'software', title: 'Tools project', summary: '', href: 'https://example.com/tools', topics: [], content: '', external: true }
const documents = [note, project]
const markup = `<section data-search-root><form data-search-form>
  <input data-search-input><button type="button" data-clear-search>Clear</button>
  <button type="button" data-search-filter="all">All</button>
  <button type="button" data-search-filter="writing">Notes</button>
  <button type="button" data-search-filter="project">Projects</button>
  <button type="button" data-search-filter="invalid">Invalid</button>
  </form><p data-search-status></p><ol data-search-results></ol></section>`

describe('search page runtime', () => {
  let browser: ReturnType<typeof mount>
  beforeEach(() => {
    resetBrowserSearchForTesting()
    browser = mount(markup, 'http://localhost/search?category=writing&query=tools')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(documents))))
  })
  afterEach(async () => { await browser.happyDOM.close(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it('initializes from the URL, filters live, clears, and focuses the input', async () => {
    initializeSearchPage()
    initializeSearchPage()
    await vi.waitFor(() => expect(element('[data-search-status]').textContent).toContain('1 result'))
    expect(element('[data-search-results]').textContent).toContain('Tools for work')
    element('[data-search-filter="project"]').click()
    await vi.waitFor(() => expect(element('[data-search-results]').textContent).toContain('Tools project'))
    expect(window.location.search).toContain('category=project')
    element('[data-search-filter="invalid"]').click()
    expect(window.location.search).toContain('category=project')
    element('[data-search-filter="all"]').click()
    await vi.waitFor(() => expect(element('[data-search-status]').textContent).toContain('2 results'))
    input('[data-search-input]', 'not-present')
    element('[data-search-form]').dispatchEvent(new Event('submit', { cancelable: true }))
    await vi.waitFor(() => expect(element('[data-search-status]').textContent).toContain('No results'))
    element('[data-clear-search]').click()
    expect(element('[data-search-status]').textContent).toContain('at least two')
    expect(document.activeElement).toBe(element('[data-search-input]'))
    expect(element('[data-search-results]').childElementCount).toBe(0)
    input('[data-search-input]', 't')
    expect(element('[data-search-status]').textContent).toBe('Keep typing to search.')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('ignores obsolete results after a query is cleared during loading', async () => {
    let respond: (value: Response) => void = () => { throw new Error('Request not started') }
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(resolve => { respond = resolve })))
    initializeSearchPage()
    input('[data-search-input]', '')
    respond(new Response(JSON.stringify(documents)))
    await browser.happyDOM.waitUntilComplete()
    expect(element('[data-search-results]').childElementCount).toBe(0)
    expect(element('[data-search-status]').textContent).toContain('at least two')
  })

  it('reports network failure and retries on the next query', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValue(new Response(JSON.stringify(documents))))
    initializeSearchPage()
    await vi.waitFor(() => expect(element('[data-search-status]').textContent).toContain('could not load'))
    input('[data-search-input]', 'tools')
    await vi.waitFor(() => expect(element('[data-search-status]').textContent).toContain('1 result'))
    expect(error).toHaveBeenCalled()
  })

  it('handles an absent or malformed search surface without crashing the page', () => {
    document.body.innerHTML = ''
    initializeSearchPage()
    document.body.innerHTML = '<section data-search-root></section>'
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    initializeSearchPage()
    expect(error).toHaveBeenCalledWith('Unable to initialize search.', expect.any(Error))
  })

})
