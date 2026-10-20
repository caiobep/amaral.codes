import { expect, it } from 'vitest'
import { assertNativeContent } from './native-content'

it('accepts native blocks with their renderer keys without changing content', () => {
  const blocks = [{ _type: 'block', _key: 'paragraph', children: [] }]
  expect(() => assertNativeContent(blocks)).not.toThrow()
  expect(() => assertNativeContent([])).not.toThrow()
})

it('rejects missing native renderer keys, invalid blocks and non-array content', () => {
  for (const value of [null, {}, [null], ['text'], [{ _type: 'block' }], [{ _type: 1, _key: 'key' }], [{ _key: 1, _type: 'block' }], [{ _key: 'key' }]]) {
    expect(() => assertNativeContent(value)).toThrow('native type and key')
  }
})
