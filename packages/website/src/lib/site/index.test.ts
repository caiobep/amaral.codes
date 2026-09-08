import { describe, expect, it } from 'vitest'
import { createCanonicalUrl, requireSite } from '.'

describe('site policy', () => {
  it('requires the build-time site URL', () => {
    const site = new URL('https://amaral.codes')

    expect(requireSite(site)).toBe(site)
    expect(() => requireSite(undefined)).toThrow('Astro site URL is not configured.')
  })

  it('creates canonical URLs from route paths', () => {
    expect(createCanonicalUrl('/posts/example', new URL('https://amaral.codes')))
      .toBe('https://amaral.codes/posts/example')
  })
})
