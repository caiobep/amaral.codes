import { describe, expect, it } from 'vitest'
import {
  createHeaderVisibilityState,
  resolveHeaderVisibility,
  shouldFollowHeader,
} from './index'

const move = (currentY: number, state = createHeaderVisibilityState()) => resolveHeaderVisibility(state, {
  canHide: true,
  currentY,
  hideAfterY: 100,
})

describe('mobile header visibility', () => {
  it('stays visible near the top and through small movements', () => {
    expect(move(12).hidden).toBe(false)
    expect(move(105, move(90)).hidden).toBe(false)
  })

  it('hides after deliberate downward travel beyond the header', () => {
    const firstMove = move(110, move(90))
    expect(move(130, firstMove).hidden).toBe(true)
  })

  it('shows after the reader starts moving up', () => {
    const hidden = move(150, move(110))
    expect(move(139, hidden).hidden).toBe(false)
  })

  it('shows at the top or whenever hiding is disabled', () => {
    const hidden = move(150, move(110))
    expect(move(0, hidden).hidden).toBe(false)
    expect(resolveHeaderVisibility(hidden, {
      canHide: false,
      currentY: 160,
      hideAfterY: 100,
    }).hidden).toBe(false)
  })

  it('clamps overscroll positions to zero', () => {
    expect(move(-30).lastY).toBe(0)
  })

  it('follows the viewport only when revealing away from the top', () => {
    expect(shouldFollowHeader({
      currentY: 180,
      following: false,
      hidden: false,
      visibility: 'detached',
    })).toBe(true)
    expect(shouldFollowHeader({
      currentY: 180,
      following: false,
      hidden: false,
      visibility: 'visible',
    })).toBe(false)
    expect(shouldFollowHeader({
      currentY: 0,
      following: true,
      hidden: false,
      visibility: 'visible',
    })).toBe(false)
  })

  it('stops following after a hidden header detaches', () => {
    expect(shouldFollowHeader({
      currentY: 180,
      following: true,
      hidden: true,
      visibility: 'hidden',
    })).toBe(true)
    expect(shouldFollowHeader({
      currentY: 180,
      following: false,
      hidden: true,
      visibility: 'detached',
    })).toBe(false)
  })
})
