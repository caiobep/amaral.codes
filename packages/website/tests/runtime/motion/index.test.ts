import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { element, mount } from '../dom'

const reducedMotion = '(prefers-reduced-motion: reduce)'
const coarsePointer = '(hover: none) and (pointer: coarse)'
const finePointer = '(hover: hover) and (pointer: fine)'
const markup = `<section id="near" data-reveal></section><section id="boundary" data-reveal></section>
  <section id="far" data-reveal></section><div data-portrait-motion></div>
  <article data-lead-story-motion></article><div data-stagger><span></span><svg></svg>
  ${'<span></span>'.repeat(7)}</div>`

let browser: ReturnType<typeof mount>
let matches: Map<string, boolean>

beforeEach(() => {
  vi.resetModules()
  browser = mount(markup)
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 })
  matches = new Map([[finePointer, true]])
  const matchMedia = window.matchMedia.bind(window)
  vi.spyOn(window, 'matchMedia').mockImplementation(query => {
    const media = matchMedia(query)
    vi.spyOn(media, 'matches', 'get').mockReturnValue(matches.get(query) ?? false)
    return media
  })
  for (const [id, top] of [['near', 919], ['boundary', 920], ['far', 1200]] as const) {
    vi.spyOn(element(`#${id}`), 'getBoundingClientRect').mockReturnValue(new DOMRect(0, top, 100, 100))
  }
})

afterEach(async () => {
  await browser.happyDOM.close()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function stubRevealObserver() {
  let notify: IntersectionObserverCallback | undefined
  const observer = {
    root: null, rootMargin: '0px 0px -5% 0px', thresholds: [0.04],
    observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn(), takeRecords: vi.fn(() => []),
  } satisfies IntersectionObserver
  const create = vi.fn(function (callback: IntersectionObserverCallback) {
    notify = callback
    return observer
  })
  vi.stubGlobal('IntersectionObserver', create)
  return {
    create,
    observer,
    emit(target: Element, isIntersecting: boolean) {
      if (!notify) throw new Error('Reveal observer was not initialized')
      const rect = target.getBoundingClientRect()
      notify([{
        target, isIntersecting, intersectionRatio: Number(isIntersecting), time: 0,
        boundingClientRect: rect, intersectionRect: rect, rootBounds: null,
      }], observer)
    },
  }
}

function pointer(target: HTMLElement, type: string, clientX: number, clientY: number) {
  target.dispatchEvent(new PointerEvent(type, { clientX, clientY }))
}

describe('page reveal motion', () => {
  it('reveals above-fold content immediately and observes remaining content only once', async () => {
    const { initializePageMotion } = await import('../../../src/scripts/layout/motion')
    const first = stubRevealObserver()
    initializePageMotion()
    expect(document.documentElement.classList.contains('reveal-ready')).toBe(true)
    expect(element('#near').classList.contains('is-visible')).toBe(true)
    expect(element('#boundary').classList.contains('is-visible')).toBe(false)
    expect(element('#far').classList.contains('is-visible')).toBe(false)
    expect(first.create).toHaveBeenCalledExactlyOnceWith(expect.any(Function), {
      rootMargin: '0px 0px -5% 0px', threshold: 0.04,
    })
    expect(first.observer.observe).toHaveBeenCalledTimes(2)
    expect(first.observer.observe).toHaveBeenCalledWith(element('#boundary'))
    expect(first.observer.observe).toHaveBeenCalledWith(element('#far'))
    for (const item of Array.from(document.querySelectorAll('[data-reveal]'))) {
      expect(item.getAttribute('data-reveal-ready')).toBe('true')
    }
    const second = stubRevealObserver()
    initializePageMotion()
    expect(second.observer.observe).not.toHaveBeenCalled()
    first.emit(element('#far'), false)
    expect(element('#far').classList.contains('is-visible')).toBe(false)
    expect(first.observer.unobserve).not.toHaveBeenCalled()
    first.emit(element('#far'), true)
    first.emit(element('#boundary'), true)
    expect(element('#far').classList.contains('is-visible')).toBe(true)
    expect(element('#boundary').classList.contains('is-visible')).toBe(true)
    expect(first.observer.unobserve).toHaveBeenCalledTimes(2)
    expect(first.observer.unobserve).toHaveBeenCalledWith(element('#far'))
    expect(first.observer.unobserve).toHaveBeenCalledWith(element('#boundary'))
  })

  it('sets capped stagger positions without styling non-HTML children', async () => {
    const { initializePageMotion } = await import('../../../src/scripts/layout/motion')
    stubRevealObserver()
    initializePageMotion()
    expect(Array.from(document.querySelectorAll<HTMLElement>('[data-stagger] span'))
      .map(child => child.style.getPropertyValue('--stagger-index')))
      .toEqual(['0', '2', '3', '4', '5', '6', '6', '6'])
    expect(document.querySelector('[data-stagger] svg')?.getAttribute('style')).toBeNull()
  })

  it.each([
    { mode: 'reduced motion', reduce: true, coarse: false, direction: '' },
    { mode: 'coarse pointer', reduce: false, coarse: true, direction: '' },
    { mode: 'forward swipe', reduce: false, coarse: false, direction: 'next' },
    { mode: 'backward swipe', reduce: false, coarse: false, direction: 'previous' },
  ])('reveals content without observers for $mode', async ({ reduce, coarse, direction }) => {
    matches.set(reducedMotion, reduce)
    matches.set(coarsePointer, coarse)
    matches.set(finePointer, !coarse)
    document.documentElement.dataset.navigationDirection = direction
    const { initializePageMotion } = await import('../../../src/scripts/layout/motion')
    const observer = stubRevealObserver()
    initializePageMotion()
    expect(observer.create).not.toHaveBeenCalled()
    expect(document.documentElement.classList.contains('reveal-ready')).toBe(true)
    for (const item of Array.from(document.querySelectorAll('[data-reveal]'))) {
      expect(item.classList.contains('is-visible')).toBe(true)
    }
  })

  it('allows pages without motion surfaces', async () => {
    document.body.innerHTML = ''
    const { initializePageMotion } = await import('../../../src/scripts/layout/motion')
    const observer = stubRevealObserver()
    initializePageMotion()
    expect(document.documentElement.classList.contains('reveal-ready')).toBe(true)
    expect(observer.observer.observe).not.toHaveBeenCalled()
  })
})

describe('pointer motion', () => {
  it('moves portraits relative to their bounds and resets on pointer leave without duplicate listeners', async () => {
    const portrait = element('[data-portrait-motion]')
    const bounds = vi.spyOn(portrait, 'getBoundingClientRect')
      .mockReturnValue(new DOMRect(10, 20, 200, 100))
    const { initializePageMotion } = await import('../../../src/scripts/layout/motion')
    stubRevealObserver()
    initializePageMotion()
    initializePageMotion()
    expect(portrait.dataset.pointerMotion).toBe('ready')
    pointer(portrait, 'pointermove', 210, 120)
    expect(bounds).toHaveBeenCalledTimes(1)
    expect(portrait.style.getPropertyValue('--portrait-x')).toBe('5px')
    expect(portrait.style.getPropertyValue('--portrait-y')).toBe('4px')
    pointer(portrait, 'pointermove', 10, 20)
    expect(portrait.style.getPropertyValue('--portrait-x')).toBe('-5px')
    expect(portrait.style.getPropertyValue('--portrait-y')).toBe('-4px')
    portrait.dispatchEvent(new PointerEvent('pointerleave'))
    expect(portrait.style.getPropertyValue('--portrait-x')).toBe('0px')
    expect(portrait.style.getPropertyValue('--portrait-y')).toBe('0px')
  })

  it('tilts lead stories only inside the card and refreshes cached bounds on reentry', async () => {
    const card = element('[data-lead-story-motion]')
    const bounds = vi.spyOn(card, 'getBoundingClientRect')
      .mockReturnValueOnce(new DOMRect(10, 20, 200, 100))
      .mockReturnValue(new DOMRect(30, 40, 400, 200))
    const { initializePageMotion } = await import('../../../src/scripts/layout/motion')
    stubRevealObserver()
    initializePageMotion()
    initializePageMotion()
    pointer(card, 'pointermove', 210, 120)
    expect(card.dataset.parallaxActive).toBeUndefined()
    expect(bounds).not.toHaveBeenCalled()
    pointer(card, 'pointerenter', 210, 120)
    expect(card.dataset.parallaxActive).toBe('true')
    expect(card.style.getPropertyValue('--lead-rotate-x')).toBe('-1.25deg')
    expect(card.style.getPropertyValue('--lead-rotate-y')).toBe('1.6deg')
    pointer(card, 'pointermove', 10, 20)
    expect(bounds).toHaveBeenCalledTimes(1)
    expect(card.style.getPropertyValue('--lead-rotate-x')).toBe('1.25deg')
    expect(card.style.getPropertyValue('--lead-rotate-y')).toBe('-1.6deg')
    card.dispatchEvent(new PointerEvent('pointerleave'))
    expect(card.dataset.parallaxActive).toBeUndefined()
    expect(card.style.getPropertyValue('--lead-rotate-x')).toBe('0deg')
    expect(card.style.getPropertyValue('--lead-rotate-y')).toBe('0deg')
    pointer(card, 'pointermove', 210, 120)
    expect(card.dataset.parallaxActive).toBeUndefined()
    pointer(card, 'pointerenter', 230, 140)
    expect(bounds).toHaveBeenCalledTimes(2)
    expect(card.dataset.parallaxActive).toBe('true')
    expect(card.style.getPropertyValue('--lead-rotate-x')).toBe('0deg')
    expect(card.style.getPropertyValue('--lead-rotate-y')).toBe('0deg')
  })

  it.each([
    { mode: 'reduced motion', reduce: true, coarse: false },
    { mode: 'coarse pointer', reduce: false, coarse: true },
    { mode: 'no hover-capable fine pointer', reduce: false, coarse: false },
  ])('leaves pointer effects disabled for $mode', async ({ reduce, coarse }) => {
    matches.set(reducedMotion, reduce)
    matches.set(coarsePointer, coarse)
    matches.set(finePointer, reduce)
    const { initializePageMotion } = await import('../../../src/scripts/layout/motion')
    stubRevealObserver()
    initializePageMotion()
    const portrait = element('[data-portrait-motion]')
    const card = element('[data-lead-story-motion]')
    pointer(portrait, 'pointermove', 200, 100)
    pointer(card, 'pointerenter', 200, 100)
    pointer(card, 'pointermove', 200, 100)
    expect(portrait.dataset.pointerMotion).toBeUndefined()
    expect(card.dataset.pointerMotion).toBeUndefined()
    expect(card.dataset.parallaxActive).toBeUndefined()
    expect(portrait.style.getPropertyValue('--portrait-x')).toBe('')
    expect(portrait.style.getPropertyValue('--portrait-y')).toBe('')
    expect(card.style.getPropertyValue('--lead-rotate-x')).toBe('')
    expect(card.style.getPropertyValue('--lead-rotate-y')).toBe('')
  })
})
