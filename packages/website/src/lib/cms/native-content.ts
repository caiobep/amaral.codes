import type { PortableTextBlock } from 'emdash'

export function assertNativeContent(value: unknown): asserts value is PortableTextBlock[] {
  if (!Array.isArray(value) || !value.every(isNativeBlock))
    throw new Error('Each content block needs its native type and key before publishing.')
}

function isNativeBlock(value: unknown): value is PortableTextBlock {
  if (!value || typeof value !== 'object') return false
  return (
    '_type' in value &&
    typeof value._type === 'string' &&
    '_key' in value &&
    typeof value._key === 'string'
  )
}
