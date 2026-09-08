export type ScrollDirection = 'down' | 'up' | 'none'

export interface HeaderVisibilityState {
  direction: ScrollDirection
  hidden: boolean
  lastY: number
  travel: number
}

export interface HeaderVisibilityInput {
  canHide: boolean
  currentY: number
  hideAfterY: number
}

export interface HeaderFollowInput {
  currentY: number
  following: boolean
  hidden: boolean
  visibility: string | undefined
}

const HIDE_TRAVEL = 24
const SHOW_TRAVEL = 10
const TOP_REVEAL_Y = 16

export const shouldFollowHeader = (input: HeaderFollowInput) => {
  if (input.hidden) return input.following && input.visibility !== 'detached'
  return input.currentY > 0 && (input.following || input.visibility !== 'visible')
}

const getDirection = (delta: number): ScrollDirection => {
  if (delta > 0) return 'down'
  if (delta < 0) return 'up'
  return 'none'
}

const getTravel = (state: HeaderVisibilityState, direction: ScrollDirection, delta: number) => {
  if (direction === 'none') return state.travel
  return direction === state.direction ? state.travel + Math.abs(delta) : Math.abs(delta)
}

const getHidden = (
  state: HeaderVisibilityState,
  input: HeaderVisibilityInput,
  direction: ScrollDirection,
  travel: number,
) => {
  const movingUpEnough = [direction === 'up', travel >= SHOW_TRAVEL].every(Boolean)
  const shouldShow = [!input.canHide, input.currentY <= TOP_REVEAL_Y, movingUpEnough].some(Boolean)
  const shouldHide = [
    direction === 'down',
    travel >= HIDE_TRAVEL,
    input.currentY > input.hideAfterY,
  ].every(Boolean)

  if (shouldShow) return false
  if (shouldHide) return true
  return state.hidden
}

export const createHeaderVisibilityState = (currentY = 0): HeaderVisibilityState => ({
  direction: 'none',
  hidden: false,
  lastY: Math.max(0, currentY),
  travel: 0,
})

export const resolveHeaderVisibility = (
  state: HeaderVisibilityState,
  input: HeaderVisibilityInput,
): HeaderVisibilityState => {
  const currentY = Math.max(0, input.currentY)
  const delta = currentY - state.lastY
  const direction = getDirection(delta)
  const travel = getTravel(state, direction, delta)
  const crossedHideBoundary = [
    direction === 'down',
    state.lastY <= input.hideAfterY,
    currentY > input.hideAfterY,
  ].every(Boolean)
  const measuredTravel = crossedHideBoundary ? currentY - input.hideAfterY : travel
  const hidden = getHidden(state, { ...input, currentY }, direction, measuredTravel)

  return {
    direction: direction === 'none' ? state.direction : direction,
    hidden,
    lastY: currentY,
    travel: hidden === state.hidden ? measuredTravel : 0,
  }
}
