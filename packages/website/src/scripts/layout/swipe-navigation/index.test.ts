// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initializeSwipeNavigation } from './index'

const navigate = vi.fn<(url: string | URL) => void>()
const matchMedia = vi.fn<(query: string) => MediaQueryList>()
const nextFrame = vi.fn<(callback: FrameRequestCallback) => number>()
const vibrate = vi.fn<(duration: number) => boolean>()

function element(selector: string) {
  const match = document.querySelector<HTMLElement>(selector)
  if (!match) throw new Error(`Missing fixture element: ${selector}`)
  return match
}

function setup() {
  document.body.innerHTML = `
    <nav class="site-nav"><a href="/" aria-current="page">Home</a><a href="/projects">Projects</a></nav>
    <main><p>Content</p><button>Action</button><input></main>`
  const main = element('main')
  initializeSwipeNavigation()
  return main
}

function dispatchTouches(target: Element, type: string, positions: number[][]) {
  const touches = positions.map(([clientX, clientY]) => ({ clientX, clientY }))
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperties(event, {
    touches: { value: type === 'touchend' ? [] : touches },
    changedTouches: { value: touches },
  })
  target.dispatchEvent(event)
}

function swipe(target: Element, endX = 85) {
  dispatchTouches(target, 'touchstart', [[220, 320]])
  dispatchTouches(target, 'touchmove', [[endX, 325]])
  dispatchTouches(target, 'touchend', [[endX, 325]])
}

beforeEach(() => {
  vi.useFakeTimers()
  navigate.mockReset()
  matchMedia.mockReset().mockReturnValue({ matches: true } as MediaQueryList)
  nextFrame.mockReset().mockImplementation(callback => { callback(0); return 1 })
  vi.spyOn(window, 'matchMedia').mockImplementation(matchMedia)
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(nextFrame)
  vi.spyOn(window.location, 'assign').mockImplementation(navigate)
  vibrate.mockReset().mockReturnValue(false)
  vi.stubGlobal('navigator', { vibrate })
  vi.stubGlobal('innerWidth', 390)
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
  delete document.documentElement.dataset.swipeFeedback
  delete document.documentElement.dataset.swipeFeedbackMode
  document.documentElement.style.removeProperty('--swipe-feedback-top')
})

describe('swipe navigation lifecycle', () => {
  it('does not navigate or suppress clicks after a vertical-then-horizontal gesture', () => {
    const main = setup()
    dispatchTouches(main, 'touchstart', [[220, 320]])
    dispatchTouches(main, 'touchmove', [[218, 380]])
    dispatchTouches(main, 'touchmove', [[85, 385]])
    dispatchTouches(main, 'touchend', [[85, 385]])
    expect(navigate).not.toHaveBeenCalled()
    expect(document.documentElement.dataset.swipeFeedback).toBeUndefined()
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    main.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(false)
    swipe(main)
    expect(navigate).toHaveBeenCalledWith(expect.stringMatching(/\/projects$/))
  })

  it('navigates once for a deliberate horizontal swipe and temporarily suppresses its click', () => {
    const main = setup()
    const bubbled = vi.fn()
    document.body.addEventListener('click', bubbled)
    swipe(main)
    expect(navigate).toHaveBeenCalledTimes(1)
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    main.dispatchEvent(click)
    expect(click.defaultPrevented).toBe(true)
    expect(bubbled).not.toHaveBeenCalled()
    swipe(main)
    expect(navigate).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(500)
    const nextClick = new MouseEvent('click', { bubbles: true, cancelable: true })
    main.dispatchEvent(nextClick)
    expect(nextClick.defaultPrevented).toBe(false)
    expect(bubbled).toHaveBeenCalledOnce()
    document.body.removeEventListener('click', bubbled)
  })

  it.each(['touchcancel', 'multitouch'])('discards a gesture on %s and accepts a fresh gesture', cancellation => {
    const main = setup()
    dispatchTouches(main, 'touchstart', [[220, 320]])
    if (cancellation === 'touchcancel') main.dispatchEvent(new Event('touchcancel'))
    else dispatchTouches(main, 'touchmove', [[150, 320], [250, 320]])
    dispatchTouches(main, 'touchmove', [[85, 325]])
    dispatchTouches(main, 'touchend', [[85, 325]])
    expect(navigate).not.toHaveBeenCalled()
    swipe(main)
    expect(navigate).toHaveBeenCalledOnce()
  })
})

describe('swipe event qualification', () => {
  it.each([
    { positions: [] },
    { positions: [[10, 320]] },
    { positions: [[380, 320]] },
    { positions: [[220, 320], [300, 320]] },
  ])('ignores invalid starts at $positions', ({ positions }) => {
    const main = setup()
    dispatchTouches(main, 'touchstart', positions)
    dispatchTouches(main, 'touchend', [[85, 325]])
    expect(navigate).not.toHaveBeenCalled()
  })

  it.each(['button', 'input'])('does not swipe from a %s', selector => {
    const main = setup()
    swipe(element(`main ${selector}`))
    expect(main.dataset.swipeNavigation).toBe('ready')
    expect(navigate).not.toHaveBeenCalled()
  })

  it('requires a deliberate distance and duration, including final touch coordinates', () => {
    const main = setup()
    swipe(main, 210)
    expect(navigate).not.toHaveBeenCalled()
    dispatchTouches(main, 'touchstart', [[220, 320]])
    vi.advanceTimersByTime(1000)
    dispatchTouches(main, 'touchend', [[85, 325]])
    expect(navigate).not.toHaveBeenCalled()
    dispatchTouches(main, 'touchstart', [[220, 320]])
    dispatchTouches(main, 'touchend', [[85, 325]])
    expect(navigate).toHaveBeenCalledOnce()
  })

  it('uses the last move if the ending event has no changed touch', () => {
    const main = setup()
    dispatchTouches(main, 'touchstart', [[220, 320]])
    dispatchTouches(main, 'touchmove', [[85, 325]])
    dispatchTouches(main, 'touchend', [])
    expect(navigate).toHaveBeenCalledOnce()
  })
})

describe('swipe navigation initialization and destinations', () => {
  it('centers the active mobile tab and binds listeners only once', () => {
    const main = setup()
    const nav = element('nav')
    const active = element('a')
    Object.defineProperty(nav, 'clientWidth', { value: 200 })
    Object.defineProperties(active, { offsetLeft: { value: 120 }, offsetWidth: { value: 80 } })
    initializeSwipeNavigation()
    expect(nav.scrollLeft).toBe(60)
    swipe(main)
    expect(navigate).toHaveBeenCalledOnce()
  })

  it('does not bind swipe handlers or center navigation on a desktop', () => {
    matchMedia.mockReturnValue({ matches: false } as MediaQueryList)
    const main = setup()
    expect(main.dataset.swipeNavigation).toBeUndefined()
    expect(nextFrame).not.toHaveBeenCalled()
    swipe(main)
    expect(navigate).not.toHaveBeenCalled()
  })

  it('does not enable swipe navigation for an immersive document', () => {
    Object.defineProperty(document, 'immersiveEnabled', { configurable: true, value: true })
    try {
      expect(setup().dataset.swipeNavigation).toBeUndefined()
    } finally {
      Reflect.deleteProperty(document, 'immersiveEnabled')
    }
  })

  it('handles missing main, navigation and active link', () => {
    document.body.replaceChildren()
    initializeSwipeNavigation()
    const main = setup()
    element('a').removeAttribute('aria-current')
    initializeSwipeNavigation()
    swipe(main)
    expect(navigate).not.toHaveBeenCalled()
    expect(document.documentElement.dataset.swipeFeedback).toBeUndefined()
  })

  it('provides edge feedback without wrapping to another tab', () => {
    const main = setup()
    swipe(main, 370)
    expect(navigate).not.toHaveBeenCalled()
    expect(document.documentElement.dataset.swipeFeedback).toBe('previous')
    expect(document.documentElement.dataset.swipeFeedbackMode).toBe('visual')
    vi.advanceTimersByTime(180)
    expect(document.documentElement.dataset.swipeFeedback).toBeUndefined()
    expect(document.documentElement.style.getPropertyValue('--swipe-feedback-top')).toBe('')
  })

  it.each([['next', 85], ['previous', 370]] as const)('uses the %s route override', (direction, endX) => {
    const main = setup()
    main.dataset.swipeNextHref = '/next-article'
    main.dataset.swipePreviousHref = '/previous-article'
    swipe(main, endX)
    expect(navigate).toHaveBeenCalledWith(`/${direction}-article`)
  })
})

describe('swipe feedback lifecycle', () => {
  it('uses haptic feedback when supported and clears its visual marker after 180ms', () => {
    const main = setup()
    vibrate.mockReturnValue(true)
    vi.stubGlobal('scrollY', 240)
    vi.stubGlobal('innerHeight', 844)
    swipe(main, 370)
    expect(vibrate).toHaveBeenCalledExactlyOnceWith(12)
    expect(document.documentElement.dataset.swipeFeedback).toBe('previous')
    expect(document.documentElement.dataset.swipeFeedbackMode).toBe('haptic')
    expect(document.documentElement.style.getPropertyValue('--swipe-feedback-top')).toBe('662px')
    vi.advanceTimersByTime(179)
    expect(document.documentElement.dataset.swipeFeedback).toBe('previous')
    vi.advanceTimersByTime(1)
    expect(document.documentElement.dataset.swipeFeedback).toBeUndefined()
    expect(document.documentElement.dataset.swipeFeedbackMode).toBeUndefined()
  })

  it('still navigates and supplies visual feedback when the vibration API is unavailable', () => {
    vi.stubGlobal('navigator', {})
    swipe(setup())
    expect(navigate).toHaveBeenCalledOnce()
    expect(document.documentElement.dataset.swipeFeedback).toBe('next')
    expect(document.documentElement.dataset.swipeFeedbackMode).toBe('visual')
    vi.advanceTimersByTime(180)
    expect(document.documentElement.dataset.swipeFeedbackMode).toBeUndefined()
  })

  it('does not clear the next directional marker when previous edge feedback expires', () => {
    const main = setup()
    swipe(main, 370)
    vi.advanceTimersByTime(90)
    swipe(main)
    expect(document.documentElement.dataset.swipeFeedback).toBe('next')
    vi.advanceTimersByTime(90)
    expect(document.documentElement.dataset.swipeFeedback).toBe('next')
    vi.advanceTimersByTime(90)
    expect(document.documentElement.dataset.swipeFeedback).toBeUndefined()
  })
})
