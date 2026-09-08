import { describe, expect, it } from 'vitest'
import { resolveSwipeDestination } from './index'

const navHrefs = ['/', '/posts', '/projects', '/about']

describe('swipe navigation destinations', () => {
  it('uses adjacent tabs for top-level routes', () => {
    expect(resolveSwipeDestination({
      direction: 'previous',
      currentIndex: 1,
      navHrefs,
    })).toBe('/')
  })

  it('uses an article route override before an adjacent tab', () => {
    expect(resolveSwipeDestination({
      direction: 'previous',
      currentIndex: 1,
      navHrefs,
      overrideHref: '/posts',
    })).toBe('/posts')
  })

  it('does not wrap past the final tab', () => {
    expect(resolveSwipeDestination({
      direction: 'next',
      currentIndex: navHrefs.length - 1,
      navHrefs,
    })).toBeUndefined()
  })
})
