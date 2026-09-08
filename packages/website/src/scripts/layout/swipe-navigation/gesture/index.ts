import type {
  SwipeContext,
  SwipeGesture,
} from '../types'

const ignoredSelector = [
  'button',
  'input',
  'textarea',
  'select',
  'label',
  'summary',
  'video',
  'audio',
  'model',
  '[contenteditable="true"]',
  '[data-swipe-ignore]',
].join(',')

export function createGesture(touch: Touch): SwipeGesture {
  return {
    startX: touch.clientX,
    startY: touch.clientY,
    lastX: touch.clientX,
    lastY: touch.clientY,
    startedAt: Date.now(),
    cancelled: false,
  }
}

export function shouldIgnoreTarget(main: HTMLElement, target: EventTarget | null) {
  if (!(target instanceof Element)) return true
  if (target.closest(ignoredSelector)) return true

  let element: Element | null = target
  while (element !== main) {
    if (isHorizontallyScrollableElement(element)) return true
    element = element.parentElement
    if (!element) return false
  }
  return false
}

export function updateGestureFromTouchEvent(context: SwipeContext, event: TouchEvent) {
  const gesture = context.state.gesture
  if (!gesture || event.touches.length !== 1) return false

  const touch = event.touches[0]
  if (!touch) return false
  updateGesturePosition(gesture, touch)
  return true
}

export function isDeliberateSwipe(gesture: SwipeGesture) {
  const distanceX = Math.abs(gesture.lastX - gesture.startX)
  const distanceY = Math.abs(gesture.lastY - gesture.startY)
  const minimumDistance = Math.min(96, Math.max(64, window.innerWidth * 0.18))
  return [
    distanceX >= minimumDistance,
    distanceX > distanceY * 1.35,
    Date.now() - gesture.startedAt < 1000,
  ].every(Boolean)
}

function updateGesturePosition(gesture: SwipeGesture, touch: Touch) {
  gesture.lastX = touch.clientX
  gesture.lastY = touch.clientY
  const distanceX = Math.abs(gesture.lastX - gesture.startX)
  const distanceY = Math.abs(gesture.lastY - gesture.startY)
  const isVertical = [distanceY > 18, distanceY > distanceX * 1.15].every(Boolean)
  gesture.cancelled = gesture.cancelled || isVertical
}

function isHorizontallyScrollableElement(element: Element) {
  return element instanceof HTMLElement && canScrollHorizontally(element)
}

function canScrollHorizontally(element: HTMLElement) {
  const styles = window.getComputedStyle(element)
  const scrollableOverflow = ['auto', 'scroll'].includes(styles.overflowX)
  return scrollableOverflow && element.scrollWidth > element.clientWidth + 2
}
