import { describe, expect, it } from 'vitest'
import { getFocusWrapTarget } from './index'

describe('header search focus containment', () => {
  it('wraps backwards from the first control to the last control', () => {
    expect(getFocusWrapTarget(0, 3, true)).toBe(2)
  })

  it('wraps forwards from the last control to the first control', () => {
    expect(getFocusWrapTarget(2, 3, false)).toBe(0)
  })

  it('recovers focus when it is outside the overlay', () => {
    expect(getFocusWrapTarget(-1, 3, true)).toBe(2)
    expect(getFocusWrapTarget(-1, 3, false)).toBe(0)
  })

  it('does not move focus between interior controls', () => {
    expect(getFocusWrapTarget(1, 3, true)).toBeUndefined()
    expect(getFocusWrapTarget(1, 3, false)).toBeUndefined()
  })

  it('does not return a target when the overlay has no controls', () => {
    expect(getFocusWrapTarget(-1, 0, false)).toBeUndefined()
  })
})
