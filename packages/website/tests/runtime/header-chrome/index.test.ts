import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { element, mount } from '../dom'

const markup = '<header class="site-header"><a href="/posts">Writing</a></header>'
const mobileQuery = '(max-width: 920px) and (hover: none) and (pointer: coarse)'

describe('mobile header runtime', () => {
  let browser: ReturnType<typeof mount>
  let initialize: () => void
  let frames: ReturnType<typeof controlAnimationFrames>
  let media: MediaQueryList
  let mobile: boolean
  let currentY: number
  let headerHeight: number

  beforeEach(async () => {
    vi.resetModules()
    browser = mount(markup)
    mobile = true
    currentY = 0
    headerHeight = 80
    window.innerWidth = 390
    vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => currentY)
    vi.spyOn(element('.site-header'), 'offsetHeight', 'get').mockImplementation(() => headerHeight)
    media = window.matchMedia(mobileQuery)
    vi.spyOn(media, 'matches', 'get').mockImplementation(() => mobile)
    vi.spyOn(window, 'matchMedia').mockReturnValue(media)
    frames = controlAnimationFrames()
    const { initializeMobileHeader } = await import('../../../src/scripts/layout/mobile-header')
    initialize = initializeMobileHeader
  })

  afterEach(async () => {
    await browser.happyDOM.close()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  const queueScroll = (y: number) => {
    currentY = y
    window.dispatchEvent(new Event('scroll'))
  }

  const scroll = (y: number) => {
    queueScroll(y)
    frames.flush()
  }

  it('does nothing without a header and initializes a subsequently inserted header', () => {
    document.body.innerHTML = ''
    const listen = vi.spyOn(window, 'addEventListener')
    initialize()
    expect(listen).not.toHaveBeenCalled()

    document.body.innerHTML = markup
    initialize()
    expect(element('.site-header').dataset).toMatchObject({
      scrollBehavior: 'ready', scrollVisibility: 'visible', scrollFollowing: 'false',
    })
  })

  it('registers scroll, resize, focus, and media listeners only once', () => {
    const matchMedia = vi.spyOn(window, 'matchMedia')
    const listen = vi.spyOn(window, 'addEventListener')
    const focus = vi.spyOn(element('.site-header'), 'addEventListener')
    const change = vi.spyOn(media, 'addEventListener')
    initialize()
    const listenerCount = listen.mock.calls.length
    initialize()

    expect(matchMedia).toHaveBeenCalledExactlyOnceWith(mobileQuery)
    expect(listen).toHaveBeenCalledWith('scroll', expect.any(Function), { passive: true })
    expect(listen).toHaveBeenCalledWith('resize', expect.any(Function), { passive: true })
    expect(listen).toHaveBeenCalledTimes(listenerCount)
    expect(focus).toHaveBeenCalledExactlyOnceWith('focusin', expect.any(Function))
    expect(change).toHaveBeenCalledExactlyOnceWith('change', expect.any(Function))
  })

  it('coalesces scroll events, waits for travel beyond the header, then detaches after the transition', async () => {
    const header = element('.site-header')
    const timer = vi.spyOn(window, 'setTimeout')
    initialize()
    queueScroll(20)
    queueScroll(60)
    queueScroll(100)
    expect(frames.request).toHaveBeenCalledOnce()
    frames.flush()
    expect(header.dataset.scrollVisibility).toBe('visible')

    scroll(110)
    expect(header.dataset.scrollVisibility).toBe('hidden')
    expect(timer).toHaveBeenCalledExactlyOnceWith(expect.any(Function), 150)
    scroll(115)
    expect(timer).toHaveBeenCalledOnce()
    await vi.waitFor(() => expect(header.dataset.scrollVisibility).toBe('detached'))
    expect(header.dataset.scrollFollowing).toBe('false')
    scroll(140)
    expect(header.dataset.scrollVisibility).toBe('detached')
    expect(timer).toHaveBeenCalledOnce()
  })

  it('restores a detached header over two animation frames when scrolling upward', async () => {
    const header = element('.site-header')
    currentY = 100
    initialize()
    expect(header.dataset.scrollFollowing).toBe('true')
    scroll(140)
    expect(header.dataset.scrollFollowing).toBe('true')
    await vi.waitFor(() => expect(header.dataset.scrollVisibility).toBe('detached'))
    expect(header.dataset.scrollFollowing).toBe('false')

    scroll(120)
    expect(header.dataset.scrollVisibility).toBe('hidden')
    expect(header.dataset.scrollFollowing).toBe('true')
    frames.flush()
    expect(header.dataset.scrollVisibility).toBe('hidden')
    frames.flush()
    expect(header.dataset.scrollVisibility).toBe('visible')
    scroll(110)
    expect(header.dataset.scrollVisibility).toBe('visible')
    scroll(0)
    expect(header.dataset.scrollFollowing).toBe('false')
  })

  it('cancels pending detachment when the scroll direction reverses before the transition finishes', async () => {
    const header = element('.site-header')
    const clearTimer = vi.spyOn(window, 'clearTimeout')
    initialize()
    scroll(110)
    expect(header.dataset.scrollVisibility).toBe('hidden')
    clearTimer.mockClear()

    scroll(90)
    expect(header.dataset.scrollVisibility).toBe('visible')
    expect(clearTimer).toHaveBeenCalledOnce()
    await browser.happyDOM.waitUntilComplete()
    expect(header.dataset.scrollVisibility).toBe('visible')
  })

  it('keeps focused header controls visible and resets when mobile media changes', () => {
    const header = element('.site-header')
    // happy-dom does not implement :focus-within; derive it from actual DOM focus.
    const matches = vi.spyOn(header, 'matches').mockImplementation(() => header.contains(document.activeElement))
    initialize()
    element('a').focus()
    scroll(120)
    expect(matches).toHaveBeenCalledWith(':focus-within')
    expect(header.dataset.scrollVisibility).toBe('visible')
    element('a').blur()
    scroll(160)
    expect(header.dataset.scrollVisibility).toBe('hidden')

    mobile = false
    media.dispatchEvent(new Event('change'))
    expect(header.dataset.scrollVisibility).toBe('visible')
    scroll(200)
    expect(header.dataset.scrollVisibility).toBe('visible')
  })

  it('ignores height-only viewport resize events but remeasures the header after width changes', () => {
    const header = element('.site-header')
    initialize()
    // Prime happy-dom's media change listener before measuring resize-only behavior.
    window.dispatchEvent(new Event('resize'))
    scroll(110)
    window.dispatchEvent(new Event('resize'))
    expect(header.dataset.scrollVisibility).toBe('hidden')

    headerHeight = 160
    window.innerWidth = 800
    window.dispatchEvent(new Event('resize'))
    expect(header.dataset.scrollVisibility).toBe('visible')
    scroll(170)
    expect(header.dataset.scrollVisibility).toBe('visible')
    scroll(185)
    expect(header.dataset.scrollVisibility).toBe('hidden')
  })

  it('cancels an unfinished detached reveal when focus immediately resets visibility', async () => {
    const header = element('.site-header')
    initialize()
    scroll(120)
    await vi.waitFor(() => expect(header.dataset.scrollVisibility).toBe('detached'))
    scroll(100)
    expect(header.dataset.scrollVisibility).toBe('hidden')
    frames.cancel.mockClear()

    element('a').focus()
    expect(header.dataset.scrollVisibility).toBe('visible')
    expect(frames.cancel).toHaveBeenCalledOnce()
    frames.flush()
    frames.flush()
    expect(header.dataset.scrollVisibility).toBe('visible')
  })

  it('does not detach a header whose visibility changed before the timeout fired', async () => {
    const header = element('.site-header')
    initialize()
    scroll(110)
    header.dataset.scrollVisibility = 'visible'
    await browser.happyDOM.waitUntilComplete()
    expect(header.dataset.scrollVisibility).toBe('visible')
  })
})

function controlAnimationFrames() {
  const pending = new Map<number, FrameRequestCallback>()
  let nextId = 0
  const request = vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => {
    const id = ++nextId
    pending.set(id, callback)
    return id
  })
  const cancel = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => {
    pending.delete(id)
  })
  return {
    request,
    cancel,
    flush: () => {
      const callbacks = Array.from(pending.values())
      pending.clear()
      callbacks.forEach(callback => callback(performance.now()))
    },
  }
}
