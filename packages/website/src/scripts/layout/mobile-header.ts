import {
  createHeaderVisibilityState,
  resolveHeaderVisibility,
  shouldFollowHeader,
  type HeaderVisibilityState,
} from './header-visibility'

const mobileMedia = '(max-width: 920px) and (hover: none) and (pointer: coarse)'
const DETACH_DELAY = 150

let detachTimer = 0
let revealFrame = 0

const clearScheduledVisibility = () => {
  window.clearTimeout(detachTimer)
  window.cancelAnimationFrame(revealFrame)
  detachTimer = 0
  revealFrame = 0
}

const setHeaderFollowing = (header: HTMLElement, following: boolean) => {
  const value = String(following)
  if (header.dataset.scrollFollowing === value) return
  header.dataset.scrollFollowing = value
}

const showHeader = (header: HTMLElement) => {
  const visibility = header.dataset.scrollVisibility
  if (visibility === 'visible') return

  clearScheduledVisibility()
  if (visibility !== 'detached') {
    header.dataset.scrollVisibility = 'visible'
    return
  }

  header.dataset.scrollVisibility = 'hidden'
  revealFrame = window.requestAnimationFrame(() => {
    revealFrame = window.requestAnimationFrame(() => {
      header.dataset.scrollVisibility = 'visible'
      revealFrame = 0
    })
  })
}

const hideHeader = (header: HTMLElement) => {
  if (['hidden', 'detached'].includes(header.dataset.scrollVisibility ?? '')) return

  clearScheduledVisibility()
  header.dataset.scrollVisibility = 'hidden'
  detachTimer = window.setTimeout(() => {
    if (header.dataset.scrollVisibility === 'hidden') {
      header.dataset.scrollVisibility = 'detached'
      setHeaderFollowing(header, false)
    }
    detachTimer = 0
  }, DETACH_DELAY)
}

const setHeaderVisibility = (header: HTMLElement, hidden: boolean, currentY: number) => {
  const following = shouldFollowHeader({
    currentY,
    following: header.dataset.scrollFollowing === 'true',
    hidden,
    visibility: header.dataset.scrollVisibility,
  })
  setHeaderFollowing(header, following)
  if (hidden) hideHeader(header)
  else showHeader(header)
}

export const initializeMobileHeader = () => {
  const header = document.querySelector<HTMLElement>('.site-header')
  if (!header) return

  setHeaderVisibility(header, false, window.scrollY)
  if (header.dataset.scrollBehavior === 'ready') return
  header.dataset.scrollBehavior = 'ready'

  const media = window.matchMedia(mobileMedia)
  let state: HeaderVisibilityState = createHeaderVisibilityState(window.scrollY)
  let hideAfterY = header.offsetHeight
  let frame = 0
  let viewportWidth = window.innerWidth

  const reset = () => {
    hideAfterY = header.offsetHeight
    state = createHeaderVisibilityState(window.scrollY)
    setHeaderVisibility(header, false, window.scrollY)
  }

  const update = () => {
    frame = 0
    state = resolveHeaderVisibility(state, {
      canHide: media.matches && !header.matches(':focus-within'),
      currentY: window.scrollY,
      hideAfterY,
    })
    setHeaderVisibility(header, state.hidden, window.scrollY)
  }

  const queueUpdate = () => {
    if (frame) return
    frame = window.requestAnimationFrame(update)
  }

  const handleResize = () => {
    if (window.innerWidth === viewportWidth) return
    viewportWidth = window.innerWidth
    reset()
  }

  window.addEventListener('scroll', queueUpdate, { passive: true })
  window.addEventListener('resize', handleResize, { passive: true })
  header.addEventListener('focusin', reset)
  media.addEventListener('change', reset)
}
