// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createGesture,
  isDeliberateSwipe,
  shouldIgnoreTarget,
  updateGestureFromTouchEvent,
} from './index'
import type { SwipeContext } from '../types'

function touch(clientX: number, clientY: number) {
  return { clientX, clientY } as Touch
}

function context(): SwipeContext {
  return {
    main: document.createElement('main'),
    navLinks: [],
    state: { gesture: createGesture(touch(220, 320)), suppressClickUntil: 0, navigationQueued: false },
  }
}

function move(state: SwipeContext, touches: Touch[]) {
  return updateGestureFromTouchEvent(state, { touches } as unknown as TouchEvent)
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('innerWidth', 390)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('swipe gesture lifecycle', () => {
  it('latches a vertical scroll even when the finger then moves horizontally', () => {
    const swipe = context()
    expect(move(swipe, [touch(218, 380)])).toBe(true)
    expect(swipe.state.gesture?.cancelled).toBe(true)
    expect(move(swipe, [touch(85, 385)])).toBe(true)
    expect(swipe.state.gesture).toMatchObject({ cancelled: true, lastX: 85, lastY: 385 })
  })

  it('starts each gesture with fresh coordinates, time and cancellation state', () => {
    expect(createGesture(touch(220, 320))).toEqual({
      startX: 220, startY: 320, lastX: 220, lastY: 320, startedAt: Date.now(), cancelled: false,
    })
    const swipe = context()
    move(swipe, [touch(218, 380)])
    swipe.state.gesture = createGesture(touch(220, 320))
    move(swipe, [touch(85, 325)])
    expect(swipe.state.gesture.cancelled).toBe(false)
  })

  it('rejects moves without a gesture or a single active touch', () => {
    const swipe = context()
    expect(move(swipe, [])).toBe(false)
    expect(move(swipe, [touch(100, 320), touch(200, 320)])).toBe(false)
    expect(updateGestureFromTouchEvent(swipe, { touches: { length: 1 } } as TouchEvent)).toBe(false)
    swipe.state.gesture = undefined
    expect(move(swipe, [touch(100, 320)])).toBe(false)
  })

  it.each([
    { width: 390, x: 135, y: 5, duration: 200, expected: true },
    { width: 320, x: 63, y: 0, duration: 200, expected: false },
    { width: 320, x: 64, y: 0, duration: 200, expected: true },
    { width: 900, x: 95, y: 0, duration: 200, expected: false },
    { width: 900, x: 96, y: 0, duration: 200, expected: true },
    { width: 390, x: 135, y: 110, duration: 200, expected: false },
    { width: 390, x: 135, y: 0, duration: 1000, expected: false },
  ])('checks width $width, distance ($x, $y), duration $duration', ({ width, x, y, duration, expected }) => {
    window.innerWidth = width
    const gesture = createGesture(touch(220, 320))
    gesture.lastX -= x
    gesture.lastY += y
    vi.advanceTimersByTime(duration)
    expect(isDeliberateSwipe(gesture)).toBe(expected)
  })

  it('does not cancel small vertical jitter or a horizontal-dominant move', () => {
    const swipe = context()
    move(swipe, [touch(219, 338)])
    expect(swipe.state.gesture?.cancelled).toBe(false)
    move(swipe, [touch(100, 345)])
    expect(swipe.state.gesture?.cancelled).toBe(false)
  })
})

describe('swipe target eligibility', () => {
  it('ignores non-elements and interactive controls', () => {
    const main = context().main
    expect(shouldIgnoreTarget(main, null)).toBe(true)
    for (const tag of ['button', 'input', 'textarea', 'select', 'label', 'summary', 'video', 'audio', 'model']) {
      expect(shouldIgnoreTarget(main, document.createElement(tag))).toBe(true)
    }
    const target = document.createElement('span')
    target.dataset.swipeIgnore = ''
    expect(shouldIgnoreTarget(main, target)).toBe(true)
  })

  it('ignores horizontally scrollable ancestors but accepts ordinary content', () => {
    const main = context().main
    const parent = document.createElement('div')
    const target = document.createElement('span')
    document.body.append(main)
    main.append(parent)
    parent.append(target)
    parent.style.overflowX = 'auto'
    Object.defineProperty(parent, 'clientWidth', { value: 100 })
    Object.defineProperty(parent, 'scrollWidth', { configurable: true, value: 100 })
    expect(shouldIgnoreTarget(main, target)).toBe(false)
    Object.defineProperty(parent, 'scrollWidth', { configurable: true, value: 103 })
    expect(shouldIgnoreTarget(main, target)).toBe(true)
    Object.defineProperty(parent, 'scrollWidth', { configurable: true, value: 102 })
    expect(shouldIgnoreTarget(main, target)).toBe(false)
    parent.remove()
    expect(shouldIgnoreTarget(main, target)).toBe(false)
  })
})
