import assert from 'node:assert/strict'
import { test } from 'vitest'
import service from './intrinsic-size-service.mjs'

test('preserves image attributes while exposing intrinsic dimensions for layout', async () => {
  const attributes = await service.getHTMLAttributes({
    src: { src: '/image.png', width: 1200, height: 1600, format: 'png' },
    width: 600,
    height: 800,
    alt: 'Portrait',
    style: 'opacity: .9',
  })
  assert.equal(attributes.width, 600)
  assert.equal(attributes.height, 800)
  assert.equal(attributes.alt, 'Portrait')
  assert.equal(attributes.loading, 'lazy')
  assert.equal(attributes['data-intrinsic-size'], '')
  assert.equal(attributes.style, 'opacity: .9; --image-width: 600; --image-ratio: 0.75')
})
