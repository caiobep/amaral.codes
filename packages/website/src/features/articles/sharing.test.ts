import { expect, it } from 'vitest'
import { articleSharingImage } from './sharing'

it('uses correct fallback image metadata and does not invent custom image dimensions', () => {
  expect(articleSharingImage(undefined)).toMatchObject({ imageWidth: 1200, imageHeight: 630, imageType: 'image/jpeg' })
  expect(articleSharingImage({ image: '/media/custom.webp', imageAlt: 'Custom cover' })).toEqual({ image: '/media/custom.webp', imageAlt: 'Custom cover' })
  expect(articleSharingImage({ image: '/social/posts/custom.jpg', imageAlt: 'Custom JPEG' })).toEqual({ image: '/social/posts/custom.jpg', imageAlt: 'Custom JPEG' })
  expect(articleSharingImage({ image: '/social/posts/example-123.png', imageAlt: 'Article title' })).toEqual({
    image: '/social/posts/example-123.png', imageAlt: 'Article title', imageWidth: 1200, imageHeight: 630, imageType: 'image/png',
  })
})
