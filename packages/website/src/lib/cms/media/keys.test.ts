import { expect, it } from 'vitest'
import {
  isMediaRequest,
  isNativeMediaUrl,
  mediaKeyFromUrl,
  normalizeMediaKey,
  previewMediaUrl,
  referencesMedia,
  requestMediaKey,
} from './keys'

it('recognizes relative and canonical native URLs without accepting other origins', () => {
  for (const url of [
    '/_emdash/api/media/file/pixel.png',
    'https://amaral.codes/_emdash/api/media/file/pixel.png',
  ]) {
    expect(isNativeMediaUrl(url)).toBe(true)
    expect(referencesMedia(url, 'pixel.png')).toBe(true)
    expect(
      referencesMedia(
        { _type: 'htmlBlock', html: `<img src="${url}">` },
        'pixel.png',
      ),
    ).toBe(true)
    expect(
      referencesMedia(
        {
          _type: 'embed',
          url: 'https://example.com/embed',
          html: `<img src="${url}">`,
        },
        'pixel.png',
      ),
    ).toBe(true)
  }
  for (const url of [
    'https://example.com/_emdash/api/media/file/pixel.png',
    '//example.com/_emdash/api/media/file/pixel.png',
    'http://amaral.codes/_emdash/api/media/file/pixel.png',
    'https://amaral.codes:444/_emdash/api/media/file/pixel.png',
    'http://[',
  ]) {
    expect(isNativeMediaUrl(url)).toBe(false)
    expect(referencesMedia(url, 'pixel.png')).toBe(false)
  }
})

it('recognizes a native featured image without requiring an inline copy', () => {
  expect(
    referencesMedia(
      { featured_image: { id: 'media-id' } },
      'pixel.png',
      'media-id',
    ),
  ).toBe(true)
  expect(
    referencesMedia(
      { featured_image: { id: 'media-id', provider: 'local' } },
      'pixel.png',
      'media-id',
    ),
  ).toBe(true)
  expect(
    referencesMedia(
      { featured_image: { id: 'other-id' } },
      'pixel.png',
      'media-id',
    ),
  ).toBe(false)
  expect(
    referencesMedia(
      { featured_image: { id: 'media-id', provider: 'external' } },
      'pixel.png',
      'media-id',
    ),
  ).toBe(false)
  expect(
    referencesMedia({ featured_image: null }, 'pixel.png', 'media-id'),
  ).toBe(false)
  expect(
    referencesMedia({ featured_image: ['media-id'] }, 'pixel.png', 'media-id'),
  ).toBe(false)
})
it('matches only native image assets to a resolved media identity', () => {
  expect(
    referencesMedia(
      { _type: 'image', asset: { _ref: 'media-id' } },
      'pixel.png',
      'media-id',
    ),
  ).toBe(true)
  expect(
    referencesMedia(
      { _type: 'image', asset: { id: 'media-id' } },
      'pixel.png',
      'media-id',
    ),
  ).toBe(true)
  expect(
    referencesMedia(
      { _type: 'image', asset: { _ref: 'other-id' } },
      'pixel.png',
      'media-id',
    ),
  ).toBe(false)
  expect(
    referencesMedia(
      { _type: 'image', asset: 'media-id' },
      'pixel.png',
      'media-id',
    ),
  ).toBe(false)
  expect(
    referencesMedia({ _type: 'image', asset: null }, 'pixel.png', 'media-id'),
  ).toBe(false)
  expect(
    referencesMedia({ _type: 'image', asset: [] }, 'pixel.png', 'media-id'),
  ).toBe(false)
  expect(
    referencesMedia(
      { _type: 'other', asset: { _ref: 'media-id' } },
      'pixel.png',
      'media-id',
    ),
  ).toBe(false)
  expect(
    referencesMedia(
      { id: 'media-id', text: 'media-id' },
      'pixel.png',
      'media-id',
    ),
  ).toBe(false)
})
it('matches internal originals and transformations by their normalized key', () => {
  const original = '/_emdash/api/media/file/pixel.png'
  const transform = new URL(
    `http://localhost/_image?href=${encodeURIComponent(original)}`,
  )
  expect(mediaKeyFromUrl(original)).toBe('pixel.png')
  expect(isMediaRequest(transform)).toBe(true)
  expect(requestMediaKey(transform)).toBe('pixel.png')
  const alias = new URL(
    `http://localhost/_image/?href=${encodeURIComponent(original)}`,
  )
  expect(isMediaRequest(alias)).toBe(true)
  expect(requestMediaKey(alias)).toBe('pixel.png')
  expect(
    isMediaRequest(new URL('http://localhost/_image?href=/public.png')),
  ).toBe(false)
})

it('recognizes native upload attempt keys in originals and transformations', () => {
  const key = '01ARZ3NDEKTSV4RRFFQ69G5FAV.01ARZ3NDEKTSV4RRFFQ69G5FAW.jpg'
  const original = `/_emdash/api/media/file/${key}`
  const transform = new URL(
    `http://localhost/_image?href=${encodeURIComponent(original)}`,
  )
  expect(normalizeMediaKey(key)).toBe(key)
  expect(normalizeMediaKey(key.replaceAll('.', '%2E'))).toBe(key)
  expect(mediaKeyFromUrl(original)).toBe(key)
  expect(requestMediaKey(transform)).toBe(key)
  expect(referencesMedia(original, key)).toBe(true)
})

it('rejects dotted names outside the native upload attempt format', () => {
  const id = '01ARZ3NDEKTSV4RRFFQ69G5FAV'
  for (const key of [
    'pixel.copy.png',
    `pixel.${id}.png`,
    `${id}.attempt.png`,
    `${id}.${id.replace('V', 'I')}.png`,
    `${id}.${id}.png.backup`,
    `${id}.${id}.png%252fsecret`,
    `${id}.${id}.png/../secret`,
  ]) {
    expect(normalizeMediaKey(key)).toBeNull()
  }
})

it('rejects traversal, private prefixes and ambiguous decoding', () => {
  for (const key of [
    '../secret',
    'backups/file',
    '%252fsecret',
    '%00',
    '%ZZ',
    'pixel.png/more',
    '.',
    '..',
    '%2525252570ixel.png',
  ]) {
    expect(normalizeMediaKey(key)).toBeNull()
  }
  expect(normalizeMediaKey('%70ixel.png')).toBe('pixel.png')
})

it('treats a malformed transform source as a request to deny', () => {
  const request = new URL('http://localhost/_image?href=http%3A%2F%2F%5B')
  expect(isMediaRequest(request)).toBe(true)
  expect(requestMediaKey(request)).toBeNull()
  expect(mediaKeyFromUrl('http://[')).toBeNull()
})

it('accepts normalized media values and Portable Text asset URLs', () => {
  const value = {
    featured_image: { provider: 'local', meta: { storageKey: 'pixel.png' } },
  }
  expect(referencesMedia(value, 'pixel.png')).toBe(true)
  expect(
    referencesMedia(
      [{ asset: { url: '/_emdash/api/media/file/pixel.png' } }],
      'pixel.png',
    ),
  ).toBe(true)
  expect(referencesMedia(value, 'orphan.png')).toBe(false)
  expect(referencesMedia(null, 'pixel.png')).toBe(false)
})

it('attaches preview capabilities only to internal media', () => {
  expect(previewMediaUrl('/_emdash/api/media/file/pixel.png', 'signed')).toBe(
    '/_emdash/api/media/file/pixel.png?_preview=signed',
  )
  expect(previewMediaUrl('https://example.com/public.png', 'signed')).toBe(
    'https://example.com/public.png',
  )
})

it('recognizes sanitized internal HTML sources only in native rendering blocks', () => {
  const html = '<h1>Heading</h1><img src="/_emdash/api/media/file/pixel.png">'
  expect(referencesMedia({ _type: 'htmlBlock', html }, 'pixel.png')).toBe(true)
  expect(
    referencesMedia({ _type: 'htmlBlock', html, isolated: false }, 'pixel.png'),
  ).toBe(true)
  expect(
    referencesMedia(
      { _type: 'embed', url: 'https://example.com/embed', html },
      'pixel.png',
    ),
  ).toBe(true)
  expect(
    referencesMedia({ _type: 'htmlBlock', html, isolated: true }, 'pixel.png'),
  ).toBe(false)
  expect(referencesMedia({ _type: 'other', html }, 'pixel.png')).toBe(false)
  expect(referencesMedia(html, 'pixel.png')).toBe(false)
  expect(referencesMedia({ _type: 'htmlBlock', html: null }, 'pixel.png')).toBe(
    false,
  )
})

it('does not grant media access through ignored player HTML, private URLs, or stripped elements', () => {
  const html = '<img src="/_emdash/api/media/file/pixel.png">'
  for (const [url, provider] of [
    ['https://youtu.be/abcdefghijk', undefined],
    ['https://vimeo.com/1234', undefined],
    ['https://example.com/video.mp4', 'video'],
    ['https://example.com/audio.mp3', 'audio'],
    ['javascript:alert(1)', undefined],
  ])
    expect(
      referencesMedia({ _type: 'embed', url, provider, html }, 'pixel.png'),
    ).toBe(false)
  expect(
    referencesMedia({ _type: 'embed', url: undefined, html }, 'pixel.png'),
  ).toBe(false)
  expect(
    referencesMedia(
      {
        _type: 'htmlBlock',
        html: '<img src="/_emdash/api/media/file/pixel.png?_preview=private">',
      },
      'pixel.png',
    ),
  ).toBe(false)
  expect(
    referencesMedia(
      {
        _type: 'htmlBlock',
        html: '<iframe src="https://example.com/_emdash/api/media/file/pixel.png"></iframe>',
      },
      'pixel.png',
    ),
  ).toBe(false)
  expect(
    referencesMedia(
      {
        _type: 'htmlBlock',
        html: '<script src="/_emdash/api/media/file/pixel.png"></script>',
      },
      'pixel.png',
    ),
  ).toBe(false)
})

it('includes responsive HTML sources and refuses external lookalike storage paths', () => {
  expect(
    referencesMedia(
      {
        _type: 'htmlBlock',
        html: '<img srcset="/_emdash/api/media/file/one.png 1x, /_emdash/api/media/file/two.png 2x">',
      },
      'two.png',
    ),
  ).toBe(true)
  expect(
    referencesMedia(
      {
        _type: 'htmlBlock',
        html: '<img src="https://example.com/_emdash/api/media/file/pixel.png">',
      },
      'pixel.png',
    ),
  ).toBe(false)
  expect(
    referencesMedia(
      'https://example.com/_emdash/api/media/file/pixel.png',
      'pixel.png',
    ),
  ).toBe(false)
})

it('classifies original media requests separately from unrelated paths and source-less transforms', () => {
  const original = new URL('http://localhost/_emdash/api/media/file/pixel.png')
  expect(isMediaRequest(original)).toBe(true)
  expect(requestMediaKey(original)).toBe('pixel.png')
  expect(isMediaRequest(new URL('http://localhost/about'))).toBe(false)
  expect(isMediaRequest(new URL('http://localhost/_image'))).toBe(false)
  expect(requestMediaKey(new URL('http://localhost/_image'))).toBeNull()
})
