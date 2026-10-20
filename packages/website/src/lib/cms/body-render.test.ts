import { expect, it, vi } from 'vitest'
import { serializeCmsBody } from './body'
import { renderCmsHtml, renderCmsMediaUrl } from './body-render'

it('resolves canonical internal HTML media only for server rendering while public export stays durable', () => {
  const html =
    '<h1>Photo</h1><img src="/_emdash/api/media/file/pixel.png" alt="A photo">'
  const resolve = vi.fn(
    (key: string) =>
      `/_emdash/api/media/file/${key}?_preview=synthetic-capability`,
  )
  expect(renderCmsHtml(html, resolve)).toBe(
    '<h2>Photo</h2><img src="/_emdash/api/media/file/pixel.png?_preview=synthetic-capability" alt="A photo" />',
  )
  expect(resolve).toHaveBeenCalledWith('pixel.png')
  expect(serializeCmsBody([{ _type: 'htmlBlock', html }])).not.toContain(
    '_preview',
  )
})

it('resolves a native self-hosted embed player source with the same preview capability', () => {
  expect(
    renderCmsMediaUrl(
      '/_emdash/api/media/file/video.mp4',
      key => `/_emdash/api/media/file/${key}?_preview=synthetic`,
    ),
  ).toBe('/_emdash/api/media/file/video.mp4?_preview=synthetic')
  expect(() =>
    renderCmsMediaUrl(
      '/_emdash/api/media/file/video.mp4?_preview=private',
      key => `/unused/${key}`,
    ),
  ).toThrow('public and durable')
})

it('preserves external sources and does not rewrite noncanonical internal aliases', () => {
  const resolve = vi.fn((key: string) => `/resolved/${key}`)
  const html =
    '<img src="https://example.com/_emdash/api/media/file/pixel.png"><img src="/_emdash/api/media/file/%70ixel.png"><a href="/about">About</a>'
  expect(renderCmsHtml(html, resolve)).toContain(
    'https://example.com/_emdash/api/media/file/pixel.png',
  )
  expect(resolve).not.toHaveBeenCalled()
})

it('refuses author-provided preview capabilities before calling the resolver', () => {
  const resolve = vi.fn((key: string) => `/resolved/${key}`)
  expect(() =>
    renderCmsHtml(
      '<img src="/_emdash/api/media/file/pixel.png?_preview=private">',
      resolve,
    ),
  ).toThrow('unsafe or private URL')
  expect(resolve).not.toHaveBeenCalled()
})
