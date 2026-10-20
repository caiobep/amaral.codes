import { expect, it } from 'vitest'
import { getCmsSocialImage } from './social-image'

const image = {
  id: 'private-native-id',
  meta: { storageKey: 'cover.png', mimeType: 'image/png' },
  alt: 'A cover photo',
  width: 1200,
  height: 800,
}

it('shares the published cover with its actual dimensions and durable token-free URL', () => {
  expect(getCmsSocialImage(image, false)).toEqual({
    image: '/_emdash/api/media/file/cover.png',
    imageAlt: 'A cover photo',
    imageWidth: 1200,
    imageHeight: 800,
    imageType: 'image/png',
  })
  expect(JSON.stringify(getCmsSocialImage(image, false))).not.toContain(image.id)
})

it('uses the existing article card for previews and posts without a cover', () => {
  expect(getCmsSocialImage(image, true)).toBeUndefined()
  expect(getCmsSocialImage(undefined, false)).toBeUndefined()
})

it('does not invent unknown dimensions or alternative text', () => {
  expect(getCmsSocialImage({ id: 'image', meta: { storageKey: 'cover.png' } }, false)).toEqual({
    image: '/_emdash/api/media/file/cover.png',
    imageAlt: '',
    imageWidth: undefined,
    imageHeight: undefined,
    imageType: undefined,
  })
})

it.each([undefined, '../private', 'cover.png?_preview=private'])('refuses invalid public image keys: %s', storageKey => {
  expect(() => getCmsSocialImage({ id: 'image', meta: { storageKey } }, false)).toThrow('durable CMS media key')
})
