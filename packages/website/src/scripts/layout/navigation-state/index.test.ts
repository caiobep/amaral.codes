import { describe, expect, it } from 'vitest'
import { resolveActiveNavigation, shouldUseNativeNavigation } from './index'

describe('active navigation state', () => {
  it.each([
    ['/', 'home'],
    ['/posts', 'posts'],
    ['/posts/an-article', 'posts'],
    ['/projects', 'projects'],
    ['/projects/a-project', 'projects'],
    ['/about', 'about'],
    ['/contact', undefined],
    ['/search', undefined],
  ] as const)('maps %s to %s', (pathname, expected) => {
    expect(resolveActiveNavigation(pathname)).toBe(expected)
  })

  it('uses native loading for same-origin page changes', () => {
    expect(shouldUseNativeNavigation({
      currentHref: 'https://amaral.codes/posts',
      download: false,
      href: '/projects',
      target: '',
    })).toBe(true)
    expect(shouldUseNativeNavigation({
      currentHref: 'https://amaral.codes/posts',
      download: false,
      href: '/about',
      target: '_self',
    })).toBe(true)
  })

  it('leaves same-page, external, and download links alone', () => {
    const currentHref = 'https://amaral.codes/posts'
    expect(shouldUseNativeNavigation({ currentHref, download: false, href: '#search', target: '' })).toBe(false)
    expect(shouldUseNativeNavigation({ currentHref, download: false, href: 'https://example.com', target: '' })).toBe(false)
    expect(shouldUseNativeNavigation({ currentHref, download: true, href: '/resume.pdf', target: '' })).toBe(false)
    expect(shouldUseNativeNavigation({ currentHref, download: false, href: '/about', target: '_blank' })).toBe(false)
  })
})
