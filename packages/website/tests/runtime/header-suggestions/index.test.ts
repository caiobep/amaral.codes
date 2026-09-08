import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getHeaderSearchElements } from '../../../src/scripts/layout/header-search/elements'
import { handleDesktopSearchShortcut } from '../../../src/scripts/layout/header-search/shortcut'
import { getSuggestionStatus, handleSuggestionKeydown, renderSuggestions, showShortQuery } from '../../../src/scripts/layout/header-search/suggestions'
import type { HeaderSearchElements, HeaderSearchState, SearchDocument } from '../../../src/scripts/layout/header-search/model'
import { element, mount } from '../dom'

const doc: SearchDocument = { id: 'note', type: 'writing', title: 'Tools', summary: 'Used at work', content: '', href: '/posts/tools', category: 'note', topics: [], date: '2022-01-01', external: false }

describe('header search suggestions and shortcuts', () => {
  let browser: ReturnType<typeof mount>
  let elements: HeaderSearchElements
  let state: HeaderSearchState
  beforeEach(() => {
    browser = mount(`<button data-header-search-open>Search</button><a data-header-search-link href="/search">Search page</a>
      <form><a data-header-search-all></a><button data-header-search-clear></button><button data-header-search-close></button>
      <input data-header-search-input><ol data-header-search-results></ol><p data-header-search-status></p></form>`)
    elements = getHeaderSearchElements(element('form', HTMLFormElement))
    state = { activeIndex: -1, requestVersion: 0 }
  })
  afterEach(async () => { await browser.happyDOM.close(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it('renders safe metadata and resets the active option when suggestions change', () => {
    const undated = { ...doc }
    delete undated.date
    renderSuggestions(elements, state, [doc, { ...undated, type: 'project', summary: '', external: true, title: '<img onerror=bad>' }, { ...doc, date: 'invalid' }])
    expect(elements.results.textContent).toContain('note · 2022')
    expect(elements.results.textContent).toContain('Project')
    expect(elements.results.querySelector('img')).toBeNull()
    expect(elements.results.querySelector('[target="_blank"]')?.getAttribute('rel')).toBe('noopener noreferrer')
    expect(elements.input.getAttribute('aria-expanded')).toBe('true')
    handleSuggestionKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' }), elements, state)
    renderSuggestions(elements, state, [])
    expect(elements.input.hasAttribute('aria-activedescendant')).toBe(false)
    expect(state.activeIndex).toBe(-1)
    expect(elements.input.getAttribute('aria-expanded')).toBe('false')
    expect(getSuggestionStatus([], 'tools')).toContain('No results')
    expect(getSuggestionStatus([doc], 'tools')).toBe('1 suggestion')
    expect(getSuggestionStatus([doc, doc], 'tools')).toBe('2 suggestions')
  })

  it('wraps keyboard selection in both directions and opens the selected option', () => {
    const key = (value: string) => handleSuggestionKeydown(new KeyboardEvent('keydown', { key: value, cancelable: true }), elements, state)
    key('ArrowDown')
    key('ArrowUp')
    key('Enter')
    renderSuggestions(elements, state, [doc, { ...doc, id: 'second' }])
    key('ArrowUp')
    expect(state.activeIndex).toBe(1)
    key('ArrowDown')
    expect(state.activeIndex).toBe(0)
    key('ArrowDown')
    const option = element('#header-search-option-1', HTMLAnchorElement)
    const click = vi.spyOn(option, 'click')
    key('Enter')
    expect(click).toHaveBeenCalledOnce()
    expect(option.getAttribute('aria-selected')).toBe('true')
    key('x')
    expect(state.activeIndex).toBe(1)
    showShortQuery(elements, state, 't')
    expect(elements.status.textContent).toBe('Keep typing to search.')
    expect(elements.allResultsLink.hidden).toBe(true)
    showShortQuery(elements, state, '')
    expect(elements.status.textContent).toContain('writing and projects')
  })

  it('uses desktop modifier shortcuts immediately but leaves editing and browser shortcuts alone', () => {
    browser.happyDOM.setViewport({ width: 1440, height: 900 })
    const media = vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList)
    const click = vi.spyOn(elements.desktopLink, 'click')
    for (const modifier of ['metaKey', 'ctrlKey']) {
      for (const key of ['k', 'P']) handleDesktopSearchShortcut(new KeyboardEvent('keydown', { key, [modifier]: true }), elements)
    }
    expect(click).toHaveBeenCalledTimes(4)
    for (const options of [{ key: 'k' }, { key: 'x', ctrlKey: true }, { key: 'k', ctrlKey: true, repeat: true }, { key: 'k', ctrlKey: true, shiftKey: true }, { key: 'p', metaKey: true, altKey: true }]) {
      handleDesktopSearchShortcut(new KeyboardEvent('keydown', options), elements)
    }
    elements.input.addEventListener('keydown', event => handleDesktopSearchShortcut(event, elements))
    elements.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
    expect(click).toHaveBeenCalledTimes(4)
    window.history.replaceState({}, '', '/search')
    elements.input.setAttribute('data-search-input', '')
    handleDesktopSearchShortcut(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }), elements)
    expect(document.activeElement).toBe(elements.input)
    media.mockReturnValue({ matches: false } as MediaQueryList)
    handleDesktopSearchShortcut(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }), elements)
    expect(click).toHaveBeenCalledTimes(4)
  })

  it('reports incomplete markup at the boundary', () => {
    elements.status.remove()
    expect(() => getHeaderSearchElements(elements.form)).toThrow('data-header-search-status')
  })
})
