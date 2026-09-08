import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initializeNavigationState } from '../../../src/scripts/layout/navigation-state/runtime'
import { element, mount } from '../dom'

const markup = `<nav>
  <a data-nav-id="home" href="/">Home</a>
  <a data-nav-id="posts" href="/posts" aria-current="page">Writing</a>
  <a data-nav-id="projects" href="/projects">Projects</a>
  <a data-nav-id="about" href="/about">About</a>
  <a data-header-search-link href="/search" aria-current="page">Search</a>
</nav>`

describe('navigation runtime', () => {
  let browser: ReturnType<typeof mount>
  let mobile: boolean

  beforeEach(() => {
    browser = mount(markup)
    mobile = false
    const media = window.matchMedia('(max-width: 920px) and (hover: none) and (pointer: coarse)')
    vi.spyOn(media, 'matches', 'get').mockImplementation(() => mobile)
    vi.spyOn(window, 'matchMedia').mockReturnValue(media)
  })

  afterEach(async () => {
    await browser.happyDOM.close()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('moves the current-page marker on repeated initialization and clears stale markers', () => {
    for (const [pathname, active] of [
      ['/', 'home'], ['/projects/desk', 'projects'], ['/posts/note', 'posts'], ['/about', 'about'],
    ] as const) {
      window.history.replaceState({}, '', pathname)
      initializeNavigationState()
      expect(document.querySelectorAll('[aria-current="page"]')).toHaveLength(1)
      expect(element(`[data-nav-id="${active}"]`).getAttribute('aria-current')).toBe('page')
      expect(element('[data-header-search-link]').hasAttribute('aria-current')).toBe(false)
    }

    window.history.replaceState({}, '', '/contact')
    initializeNavigationState()
    expect(document.querySelectorAll('[aria-current]')).toHaveLength(0)
    expect(document.querySelectorAll('[data-astro-reload]')).toHaveLength(0)
  })

  it('marks search independently and tolerates missing navigation surfaces', () => {
    window.history.replaceState({}, '', '/search?query=tools')
    initializeNavigationState()
    expect(document.querySelectorAll('[data-nav-id][aria-current]')).toHaveLength(0)
    expect(element('[data-header-search-link]').getAttribute('aria-current')).toBe('page')

    document.body.innerHTML = ''
    expect(initializeNavigationState).not.toThrow()
    document.body.innerHTML = markup
    window.history.replaceState({}, '', '/posts/recovered')
    initializeNavigationState()
    expect(element('[data-nav-id="posts"]').getAttribute('aria-current')).toBe('page')
    expect(element('[data-header-search-link]').hasAttribute('aria-current')).toBe(false)
  })

  it('opts mobile same-origin page and query navigation into native loading only', () => {
    mobile = true
    window.history.replaceState({}, '', '/posts?category=note')
    document.body.innerHTML = `<a id="page" href="/projects">Page</a>
      <a id="query" href="?category=talk">Query</a>
      <a id="self" href="/about" target="_self">Self</a>
      <a id="hash" href="#section">Section</a>
      <a id="same" href="/posts?category=note">Same page</a>
      <a id="download" href="/asset.pdf" download>Download</a>
      <a id="blank" href="/projects" target="_blank">New tab</a>
      <a id="parent" href="/projects" target="_parent">Parent</a>
      <a id="external" href="https://example.com/posts">External</a>
      <a id="mail" href="mailto:hello@example.com">Email</a>
      <a id="phone" href="tel:+15555550100">Phone</a><a id="placeholder">Placeholder</a>`

    initializeNavigationState()
    initializeNavigationState()

    const nativeLinks = Array.from(document.querySelectorAll('[data-astro-reload]'))
    expect(nativeLinks.map(link => link.id)).toEqual(['page', 'query', 'self'])
    expect(nativeLinks.every(link => link.getAttribute('data-astro-reload') === '')).toBe(true)
  })

  it('marks links inserted by navigation without removing authored reload attributes on desktop', () => {
    mobile = true
    initializeNavigationState()
    document.body.innerHTML = markup
    window.history.replaceState({}, '', '/projects')
    initializeNavigationState()
    expect(element('[data-nav-id="home"]').hasAttribute('data-astro-reload')).toBe(true)
    expect(element('[data-nav-id="projects"]').hasAttribute('data-astro-reload')).toBe(false)
    expect(element('[data-nav-id="projects"]').getAttribute('aria-current')).toBe('page')

    mobile = false
    document.body.innerHTML = '<a href="/posts" data-astro-reload>Authored native navigation</a>'
    initializeNavigationState()
    expect(element('a').hasAttribute('data-astro-reload')).toBe(true)
  })
})
