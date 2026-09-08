import { describe, expect, it } from 'vitest'
import { createContentId } from './index.ts'

describe('createContentId', () => {
  it('matches the stable Astro content identifier format', () => {
    expect(createContentId('My_journey with cafés & APIs')).toBe(
      'my_journey_with_cafes_apis',
    )
  })

  it('preserves intentional hyphens and legacy underscores', () => {
    expect(createContentId('native-script_vs-ionic')).toBe('native-script_vs-ionic')
  })

  it('rejects values without an identifier', () => {
    expect(() => createContentId('???')).toThrow('Could not create a content ID')
  })
})
