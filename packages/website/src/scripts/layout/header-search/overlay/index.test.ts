// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getHeaderSearchElements } from '../elements'
import { handleOverlayKeydown, setSearchOpen } from './index'

function setup() {
  document.body.innerHTML = `
    <a class="skip-link" href="#main">Skip</a>
    <a class="brand" href="/">Home</a><nav class="site-nav"><a href="/projects">Projects</a></nav>
    <div class="header-actions">
      <a data-header-search-link href="/search">Search</a>
      <button data-header-search-open aria-expanded="false">Search</button>
      <form data-header-search data-open="false" aria-hidden="true" inert>
        <button data-header-search-close type="button">Close</button>
        <input data-header-search-input aria-expanded="false">
        <button data-header-search-clear type="button" hidden>Clear</button>
        <p data-header-search-status></p><ol data-header-search-results></ol>
        <a data-header-search-all href="/search" hidden>All results</a>
      </form>
    </div><main id="main"></main><footer class="footer-shell"></footer>`
  const form = document.querySelector('form')
  if (!form) throw new Error('Missing fixture form')
  return getHeaderSearchElements(form)
}

const frames: FrameRequestCallback[] = []
const matchMedia = vi.fn<(query: string) => MediaQueryList>()

beforeEach(() => {
  frames.length = 0
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => frames.push(callback))
  matchMedia.mockReset().mockReturnValue({ matches: true } as MediaQueryList)
  vi.stubGlobal('matchMedia', matchMedia)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
  delete document.documentElement.dataset.searchOverlayOpen
})

describe('search overlay state and focus', () => {
  it('opens the form, makes background content inert, and focuses the input next frame', () => {
    const elements = setup()
    setSearchOpen(elements, true)
    expect(elements.form.dataset.open).toBe('true')
    expect(elements.form.getAttribute('aria-hidden')).toBe('false')
    expect(elements.form.hasAttribute('inert')).toBe(false)
    expect(elements.trigger.getAttribute('aria-expanded')).toBe('true')
    expect(document.documentElement.dataset.searchOverlayOpen).toBe('true')
    for (const element of Array.from(document.querySelectorAll<HTMLElement>('main, nav, footer, .brand, .skip-link, .header-actions > :not(form)'))) {
      expect(element.inert).toBe(true)
    }
    expect(document.activeElement).not.toBe(elements.input)
    frames[0]?.(0)
    expect(document.activeElement).toBe(elements.input)
  })

  it('closes the form, resets combobox state, releases the background and restores mobile focus', () => {
    const elements = setup()
    setSearchOpen(elements, true)
    frames[0]?.(0)
    elements.input.setAttribute('aria-expanded', 'true')
    elements.input.setAttribute('aria-activedescendant', 'result-1')
    setSearchOpen(elements, false)
    expect(elements.form.dataset.open).toBe('false')
    expect(elements.form.getAttribute('aria-hidden')).toBe('true')
    expect(elements.form.hasAttribute('inert')).toBe(true)
    expect(elements.input.getAttribute('aria-expanded')).toBe('false')
    expect(elements.input.hasAttribute('aria-activedescendant')).toBe(false)
    expect(elements.trigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.documentElement.dataset.searchOverlayOpen).toBe('false')
    expect(document.activeElement).toBe(elements.trigger)
    for (const element of Array.from(document.querySelectorAll<HTMLElement>('main, nav, footer, .brand, .skip-link, .header-actions > :not(form)'))) {
      expect(element.inert).toBe(false)
    }
  })

  it('restores focus to the visible desktop search link above the mobile breakpoint', () => {
    const elements = setup()
    setSearchOpen(elements, true)
    frames[0]?.(0)
    matchMedia.mockReturnValue({ matches: false } as MediaQueryList)
    setSearchOpen(elements, false)
    expect(document.activeElement).toBe(elements.desktopLink)
    expect(matchMedia).toHaveBeenCalledWith('(max-width: 920px)')
  })

  it('does not let a queued opening frame refocus a closed overlay', () => {
    const elements = setup()
    const focusInput = vi.spyOn(elements.input, 'focus')
    setSearchOpen(elements, true)
    setSearchOpen(elements, false)
    frames[0]?.(0)
    expect(focusInput).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(elements.trigger)
  })

  it('can close without stealing focus from a control outside the form', () => {
    const elements = setup()
    elements.desktopLink.focus()
    setSearchOpen(elements, false, false)
    expect(document.activeElement).toBe(elements.desktopLink)
  })

  it('blurs focused overlay content even when restoration is disabled', () => {
    const elements = setup()
    setSearchOpen(elements, true)
    frames[0]?.(0)
    setSearchOpen(elements, false, false)
    expect(document.activeElement).toBe(document.body)
  })
})

describe('search overlay keyboard containment', () => {
  it.each([
    ['closeButton', true, 'input'],
    ['input', false, 'closeButton'],
  ] as const)('wraps from %s with shift=%s to %s', (from, shiftKey, to) => {
    const elements = setup()
    setSearchOpen(elements, true)
    elements[from].focus()
    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, cancelable: true })
    handleOverlayKeydown(event, elements)
    expect(document.activeElement).toBe(elements[to])
    expect(event.defaultPrevented).toBe(true)
  })

  it('leaves native tab navigation between interior controls alone', () => {
    const elements = setup()
    setSearchOpen(elements, true)
    elements.closeButton.focus()
    const event = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true })
    handleOverlayKeydown(event, elements)
    expect(event.defaultPrevented).toBe(false)
  })

  it('handles an empty form and ignores unrelated keys', () => {
    const elements = setup()
    elements.form.replaceChildren()
    for (const key of ['Tab', 'ArrowRight']) {
      const event = new KeyboardEvent('keydown', { key, cancelable: true })
      handleOverlayKeydown(event, elements)
      expect(event.defaultPrevented).toBe(false)
    }
  })

  it('closes on Escape and returns focus', () => {
    const elements = setup()
    setSearchOpen(elements, true)
    const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })
    handleOverlayKeydown(event, elements)
    expect(event.defaultPrevented).toBe(true)
    expect(elements.form.dataset.open).toBe('false')
    expect(document.activeElement).toBe(elements.trigger)
  })
})
