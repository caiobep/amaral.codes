import { describe, expect, it } from 'vitest'
import { formatPostDate } from './index'

describe('formatPostDate', () => {
  it('keeps date-only publication dates stable across local timezones', () => {
    expect(formatPostDate('2021-01-26', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })).toBe('January 26, 2021')
  })
})
