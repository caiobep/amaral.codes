export type SwipeDirection = 'next' | 'previous'

export interface SwipeGesture {
  startX: number
  startY: number
  lastX: number
  lastY: number
  startedAt: number
  cancelled: boolean
}

export interface SwipeState {
  gesture: SwipeGesture | undefined
  suppressClickUntil: number
  navigationQueued: boolean
}

export interface SwipeContext {
  main: HTMLElement
  navLinks: HTMLAnchorElement[]
  state: SwipeState
}
