import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { element, input, mount } from '../dom'

const posts = `<input id="search-post"><button data-filter="all">All</button>
  <button data-filter="note">Notes</button><button data-filter="talk">Talks</button>
  <div class="posts"><article class="post" data-category="note" data-search="Café tools">Coffee</article>
  <article class="post" data-category="talk">JavaScript talk</article></div>
  <span id="visible-post-count"></span><div class="empty-state"></div><div data-end-state></div>
  <button data-clear-search>Reset</button><button data-clear-post-query>Clear query</button>`
const projects = `<div data-project-controls><input id="search-projects">
  <button data-project-filter="all">All</button><button data-project-filter="software">Software</button>
  <button data-project-filter="physical">Physical</button></div>
  <section data-project-group><article data-project data-project-label="software" data-project-search="Café tools">Coffee</article></section>
  <section data-project-group><article data-project data-project-label="physical">Desk stand</article></section>
  <button data-clear-project-search>Reset</button><div class="project-empty-state"></div>`

describe('collection filtering', () => {
  let browser: ReturnType<typeof mount>
  beforeEach(() => { vi.resetModules(); browser = mount() })
  afterEach(async () => { await browser.happyDOM.close(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it('filters notes from URL state, handles accents, and preserves categories when clearing query', async () => {
    document.body.innerHTML = posts
    window.history.replaceState({}, '', '/posts?category=note&query=cafe&featured=true')
    await import('../../../src/scripts/posts')
    expect(element('#visible-post-count').textContent).toBe('1')
    expect(window.location.search).not.toContain('featured')
    expect(element('[data-filter="note"]').getAttribute('aria-pressed')).toBe('true')
    element('[data-clear-post-query]').click()
    expect(window.location.search).toBe('?category=note')
    expect(document.activeElement).toBe(element('#search-post'))
    element('[data-filter="talk"]').click()
    expect(element('.post[data-category="note"]').hidden).toBe(true)
    input('#search-post', 'absent')
    expect(element('.empty-state').hidden).toBe(false)
    expect(element('[data-end-state]').hidden).toBe(true)
    element('[data-clear-search]').click()
    expect(element('#visible-post-count').textContent).toBe('2')
    expect(window.location.search).toBe('')
    document.dispatchEvent(new Event('astro:page-load'))
    const button = element('[data-filter="talk"]')
    button.dataset.filter = 'invalid'
    button.click()
    expect(element('#visible-post-count').textContent).toBe('2')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'K', ctrlKey: true }))
    expect(document.activeElement).toBe(element('#search-post'))
    element('[data-clear-search]').focus()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', metaKey: true }))
    expect(document.activeElement).toBe(element('[data-clear-search]'))
  })

  it('defaults unknown note categories and reports incomplete markup', async () => {
    await import('../../../src/scripts/posts')
    document.body.innerHTML = posts
    window.history.replaceState({}, '', '/posts?category=invalid')
    document.dispatchEvent(new Event('astro:page-load'))
    expect(element('#visible-post-count').textContent).toBe('2')
    document.body.innerHTML = '<div class="posts"></div>'
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    document.dispatchEvent(new Event('astro:page-load'))
    expect(error).toHaveBeenCalledWith('Unable to initialize post filters.', expect.any(Error))
  })

  it('filters projects and hides empty groups while keeping URL and reset coherent', async () => {
    document.body.innerHTML = projects
    window.history.replaceState({}, '', '/projects?label=software&query=cafe')
    await import('../../../src/scripts/project-filters')
    expect(element('[data-project-label="physical"]').hidden).toBe(true)
    element('[data-project-filter="physical"]').click()
    expect(element('.project-empty-state').hidden).toBe(false)
    input('#search-projects', 'desk')
    expect(element('[data-project-label="physical"]').hidden).toBe(false)
    expect(element('[data-project-group]').hidden).toBe(true)
    expect(window.location.search).toContain('label=physical')
    element('[data-clear-project-search]').click()
    expect(document.querySelectorAll('[data-project-group]:not([hidden])')).toHaveLength(2)
    expect(document.activeElement).toBe(element('#search-projects'))
    expect(window.location.search).toBe('')
    document.dispatchEvent(new Event('astro:page-load'))
    const button = element('[data-project-filter="physical"]')
    button.dataset.projectFilter = 'invalid'
    button.click()
    expect(window.location.search).toBe('')
    delete button.dataset.projectFilter
    button.click()
    expect(window.location.search).toBe('')
  })

  it('defaults unknown project labels and reports incomplete controls', async () => {
    await import('../../../src/scripts/project-filters')
    document.body.innerHTML = projects
    window.history.replaceState({}, '', '/projects?label=invalid')
    document.dispatchEvent(new Event('astro:page-load'))
    expect(document.querySelectorAll('[data-project]:not([hidden])')).toHaveLength(2)
    document.body.innerHTML = '<div data-project-controls></div>'
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    document.dispatchEvent(new Event('astro:page-load'))
    expect(error).toHaveBeenCalledWith('Unable to initialize project filters.', expect.any(Error))
  })
})
