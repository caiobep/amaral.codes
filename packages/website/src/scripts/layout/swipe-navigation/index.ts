import { resolveSwipeDestination } from '../swipe-destination'
import { triggerSwipeFeedback } from './feedback'
import {
  createGesture,
  isDeliberateSwipe,
  shouldIgnoreTarget,
  updateGestureFromTouchEvent,
} from './gesture'
import type {
  SwipeContext,
  SwipeDirection,
  SwipeGesture,
} from './types'

type SpatialDocument = Document & { immersiveEnabled?: boolean }

const centerActiveNavigation = (nav: HTMLElement | null, navLinks: HTMLAnchorElement[]) => {
  const activeLink = navLinks.find((link) => link.getAttribute('aria-current') === 'page')
  const isMobile = window.matchMedia('(max-width: 920px)').matches
  if (!nav || !activeLink || !isMobile) return
  requestAnimationFrame(() => {
    nav.scrollLeft = activeLink.offsetLeft - (nav.clientWidth - activeLink.offsetWidth) / 2
  })
}

const canInitializeSwipe = (main: HTMLElement | null) => {
  const spatialDocument = document as SpatialDocument
  const canSwipe = window.matchMedia('(max-width: 920px) and (hover: none) and (pointer: coarse)').matches
  return Boolean(main && main.dataset.swipeNavigation !== 'ready' && canSwipe && !spatialDocument.immersiveEnabled)
}

const handleTouchStart = (context: SwipeContext, event: TouchEvent) => {
  const touch = event.touches[0]
  const invalidStart = [
    context.state.navigationQueued,
    event.touches.length !== 1,
    !touch,
    shouldIgnoreTarget(context.main, event.target),
    touch ? touch.clientX < 28 : true,
    touch ? touch.clientX > window.innerWidth - 28 : true,
  ].some(Boolean)

  context.state.gesture = invalidStart || !touch ? undefined : createGesture(touch)
}

const handleTouchMove = (context: SwipeContext, event: TouchEvent) => {
  if (!updateGestureFromTouchEvent(context, event)) {
    context.state.gesture = undefined
  }
}

const getSwipeOverride = (main: HTMLElement, direction: SwipeDirection) => (
  direction === 'previous' ? main.dataset.swipePreviousHref : main.dataset.swipeNextHref
)

const navigateForGesture = (context: SwipeContext, gesture: SwipeGesture) => {
  const direction: SwipeDirection = gesture.lastX - gesture.startX < 0 ? 'next' : 'previous'
  const currentIndex = context.navLinks.findIndex((link) => link.getAttribute('aria-current') === 'page')
  if (currentIndex < 0) return

  const targetHref = resolveSwipeDestination({
    direction,
    currentIndex,
    navHrefs: context.navLinks.map((link) => link.href),
    overrideHref: getSwipeOverride(context.main, direction),
  })
  triggerSwipeFeedback(direction)
  if (!targetHref) return

  context.state.navigationQueued = true
  window.location.assign(targetHref)
}

const handleTouchEnd = (context: SwipeContext, event: TouchEvent) => {
  const gesture = context.state.gesture
  context.state.gesture = undefined
  if (!gesture || gesture.cancelled) return

  const touch = event.changedTouches[0]
  if (touch) Object.assign(gesture, { lastX: touch.clientX, lastY: touch.clientY })
  if (!isDeliberateSwipe(gesture)) return

  context.state.suppressClickUntil = Date.now() + 500
  navigateForGesture(context, gesture)
}

const bindSwipeEvents = (context: SwipeContext) => {
  context.main.addEventListener('click', (event) => {
    if (Date.now() >= context.state.suppressClickUntil) return
    event.preventDefault()
    event.stopPropagation()
  }, { capture: true })
  context.main.addEventListener('touchstart', (event) => handleTouchStart(context, event), { passive: true })
  context.main.addEventListener('touchmove', (event) => handleTouchMove(context, event), { passive: true })
  context.main.addEventListener('touchend', (event) => handleTouchEnd(context, event), { passive: true })
  context.main.addEventListener('touchcancel', () => { context.state.gesture = undefined }, { passive: true })
}

export const initializeSwipeNavigation = () => {
  const main = document.querySelector<HTMLElement>('main')
  const nav = document.querySelector<HTMLElement>('.site-nav')
  const navLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>('.site-nav a'))
  centerActiveNavigation(nav, navLinks)
  if (!canInitializeSwipe(main) || !main) return

  main.dataset.swipeNavigation = 'ready'
  bindSwipeEvents({
    main,
    navLinks,
    state: { gesture: undefined, suppressClickUntil: 0, navigationQueued: false },
  })
}
