import { expect, it } from 'vitest'
import { serializeCmsBody } from './body'
import { usesEmbedHtml } from './body-embed'

it.each([
  {
    _type: 'embed',
    url: 'https://www.youtube.com/watch?v=abcdefghijk',
    caption: 'A useful video',
  },
  {
    _type: 'iframe',
    src: 'https://example.com/diagram',
    title: 'A useful diagram',
  },
])('exports useful public links for native embeds: %s', block => {
  expect(serializeCmsBody([block])).toMatch(/\[A useful .+\]\(https:\/\//u)
})

it('exports native embed HTML alongside a useful source link', () => {
  expect(
    serializeCmsBody([
      {
        _type: 'embed',
        url: 'https://example.com/embed',
        html: '<p>Rich <strong>embed</strong></p>',
      },
    ]),
  ).toBe(
    '[Embedded content](https://example.com/embed)\n\n<p>Rich <strong>embed</strong></p>',
  )
})

it.each([
  ['https://example.com/video.mp4', 'video'],
  ['https://example.com/audio.mp3', 'audio'],
  ['https://youtu.be/abcdefghijk', undefined],
  ['https://vimeo.com/1234', undefined],
])('matches native renderer provider selection for %s', (url, provider) => {
  expect(usesEmbedHtml(url, provider)).toBe(false)
  expect(
    serializeCmsBody([
      { _type: 'embed', url, provider, html: '<p>Unused fallback</p>' },
    ]),
  ).not.toContain('Unused fallback')
})

it('supports default labels and durable native file links', () => {
  expect(
    serializeCmsBody([{ _type: 'iframe', src: 'https://example.com/diagram' }]),
  ).toBe('[Embedded content](https://example.com/diagram)')
  expect(
    serializeCmsBody([
      { _type: 'file', url: '/files/handout.pdf', filename: 'Handout' },
    ]),
  ).toBe('[Handout](/files/handout.pdf)')
  expect(serializeCmsBody([{ _type: 'file', url: '/files/handout.pdf' }])).toBe(
    '[Download file](/files/handout.pdf)',
  )
})

it('rejects private media in embed HTML even when a provider would use its own player', () => {
  expect(() =>
    serializeCmsBody([
      {
        _type: 'embed',
        url: 'https://youtu.be/abcdefghijk',
        html: '<img src="https://example.com/photo?X-Amz-Signature=private">',
      },
    ]),
  ).toThrow('unsafe or private URL')
})
