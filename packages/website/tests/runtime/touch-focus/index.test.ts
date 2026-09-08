import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initializeTouchFocus } from '../../../src/scripts/layout/touch-focus'
import { element, mount } from '../dom'

const markup = `<a id="link" href="/posts">Writing</a><button id="button">Menu</button>
  <div id="tabstop" tabindex="0">Focusable region</div><input id="input"><textarea id="textarea"></textarea>`

describe('touch focus runtime', () => {
  let browser: ReturnType<typeof mount>
  let touchDevice: boolean

  beforeEach(() => {
    browser = mount(markup)
    touchDevice = true
    const media = window.matchMedia('(hover: none) and (pointer: coarse)')
    vi.spyOn(media, 'matches', 'get').mockImplementation(() => touchDevice)
    vi.spyOn(window, 'matchMedia').mockReturnValue(media)
  })

  afterEach(async () => {
    await browser.happyDOM.close()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it.each([
    { touch: false, immersive: false },
    { touch: true, immersive: true },
  ])('leaves focus alone when touch=$touch and immersive=$immersive', ({ touch, immersive }) => {
    touchDevice = touch
    Object.defineProperty(document, 'immersiveEnabled', { value: immersive })
    initializeTouchFocus()
    element('#link').focus()
    dispatchTouch('touchstart', [0, 0])
    dispatchTouch('touchmove', [20, 0])
    expect(document.activeElement).toBe(element('#link'))
    expect(document.documentElement.dataset.touchFocus).toBeUndefined()
  })

  it('registers passive listeners once and keeps focus during taps and sub-threshold movement', () => {
    const listen = vi.spyOn(document, 'addEventListener')
    initializeTouchFocus()
    initializeTouchFocus()
    expect(listen.mock.calls.map(([type]) => type)).toEqual([
      'touchstart', 'touchmove', 'touchend', 'touchcancel',
    ])
    expect(listen.mock.calls.every(([, , options]) => (
      typeof options === 'object' && options.passive === true
    ))).toBe(true)
    expect(document.documentElement.dataset.touchFocus).toBe('ready')

    element('#button').focus()
    dispatchTouch('touchmove', [50, 50])
    dispatchTouch('touchstart')
    dispatchTouch('touchmove', [50, 50])
    expect(document.activeElement).toBe(element('#button'))
    dispatchTouch('touchstart', [10, 10])
    dispatchTouch('touchmove')
    dispatchTouch('touchmove', [16, 14])
    expect(document.activeElement).toBe(element('#button'))
  })

  it.each(['#link', '#button', '#tabstop'])('blurs %s at the movement boundary without cancelling scrolling', (selector) => {
    initializeTouchFocus()
    const target = element(selector)
    const blur = vi.spyOn(target, 'blur')
    target.focus()
    dispatchTouch('touchstart', [10, 10])
    const move = dispatchTouch('touchmove', [18, 10])
    expect(blur).toHaveBeenCalledOnce()
    expect(document.activeElement).not.toBe(target)
    expect(move.defaultPrevented).toBe(false)
  })

  it.each(['#input', '#textarea'])('preserves editing focus on %s during scrolling', (selector) => {
    initializeTouchFocus()
    const target = element(selector)
    target.focus()
    dispatchTouch('touchstart', [10, 10])
    dispatchTouch('touchmove', [100, 100])
    expect(document.activeElement).toBe(target)
  })

  it.each(['touchend', 'touchcancel'])('clears the gesture origin on %s and starts the next gesture independently', (type) => {
    initializeTouchFocus()
    element('#link').focus()
    dispatchTouch('touchstart', [0, 0])
    dispatchTouch(type)
    dispatchTouch('touchmove', [100, 100])
    expect(document.activeElement).toBe(element('#link'))
    dispatchTouch('touchstart', [100, 100])
    dispatchTouch('touchmove', [105, 100])
    expect(document.activeElement).toBe(element('#link'))
    dispatchTouch('touchmove', [108, 100])
    expect(document.activeElement).not.toBe(element('#link'))
  })

  it('tolerates a gesture while the document has no active element', () => {
    initializeTouchFocus()
    vi.spyOn(document, 'activeElement', 'get').mockReturnValue(null)
    dispatchTouch('touchstart', [0, 0])
    expect(() => dispatchTouch('touchmove', [20, 20])).not.toThrow()
  })
})

function dispatchTouch(type: string, point?: readonly [number, number]): TouchEvent {
  const touches = point ? [new Touch({
    identifier: 1,
    target: document.body,
    clientX: point[0],
    clientY: point[1],
  })] : []
  const event = new TouchEvent(type, { touches, bubbles: true, cancelable: true })
  document.dispatchEvent(event)
  return event
}
