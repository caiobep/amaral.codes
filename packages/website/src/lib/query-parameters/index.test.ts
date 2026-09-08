import { describe, expect, it } from 'vitest'
import { getQueryParameter, setQueryParameter } from './index'

describe('query parameter helpers', () => {
  it('prefers descriptive parameters over legacy aliases', () => {
    const params = new URLSearchParams('query=current&q=legacy')

    expect(getQueryParameter(params, 'query')).toBe('current')
  })

  it('reads legacy aliases for existing links', () => {
    expect(getQueryParameter(new URLSearchParams('type=review'), 'category')).toBe('review')
    expect(getQueryParameter(new URLSearchParams('featured=true'), 'featured')).toBe('true')
    expect(getQueryParameter(new URLSearchParams('label=systems'), 'label')).toBe('systems')
    expect(getQueryParameter(new URLSearchParams('l=things:///show'), 'url')).toBe('things:///show')
  })

  it('writes descriptive parameters and removes legacy aliases', () => {
    const params = new URLSearchParams('q=old&type=note')

    setQueryParameter(params, 'query', 'software')
    setQueryParameter(params, 'category', 'review')
    setQueryParameter(params, 'featured', 'true')
    setQueryParameter(params, 'label', 'systems')

    expect(params.toString()).toBe('query=software&category=review&featured=true&label=systems')
  })

  it('removes a parameter and all of its aliases', () => {
    const params = new URLSearchParams('query=software&q=old')

    setQueryParameter(params, 'query')

    expect(params.toString()).toBe('')
  })
})
