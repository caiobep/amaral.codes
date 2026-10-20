import { expect, it, vi } from 'vitest'
import { cmsHtmlMediaUrls, sanitizeCmsHtml } from './body-html'
import { renderCmsHtml } from './body-render'
import { cmsSrcsetUrls, rewriteCmsSrcset } from './body-srcset'

it.each([
  '/_emdash/api/media/file/one.png 1x, /_emdash/api/media/file/two.png 2x',
  '/_emdash/api/media/file/one.png 640w, /_emdash/api/media/file/two.png 1280w',
])('preserves every valid native responsive image candidate: %s', srcset => {
  const html = `<img alt="Responsive image" srcset="${srcset}">`
  expect(sanitizeCmsHtml(html)).toContain(srcset)
  expect(cmsHtmlMediaUrls(html)).toEqual([
    '/_emdash/api/media/file/one.png',
    '/_emdash/api/media/file/two.png',
  ])
  expect(
    renderCmsHtml(
      html,
      key => `/_emdash/api/media/file/${key}?_preview=synthetic`,
    ),
  ).toContain('one.png?_preview=synthetic')
  expect(
    renderCmsHtml(
      html,
      key => `/_emdash/api/media/file/${key}?_preview=synthetic`,
    ),
  ).toContain('two.png?_preview=synthetic')
})

it('accepts an empty responsive source list without inventing media', () => {
  expect(cmsSrcsetUrls('')).toEqual([])
  expect(rewriteCmsSrcset('')).toBe('')
})

it.each([
  '/_emdash/api/media/file/one.png 1x, https://example.com/two.png?X-Amz-Signature=private 2x',
  '/_emdash/api/media/file/one.png?_preview=private 1x',
])('rejects private URLs in every responsive image candidate: %s', srcset => {
  expect(() => sanitizeCmsHtml(`<img srcset="${srcset}">`)).toThrow(
    'unsafe or private URL',
  )
  expect(cmsHtmlMediaUrls(`<img srcset="${srcset}">`)).toEqual([])
})

it.each(['x', '/image.png invalid', '/image.png 1x 2x'])(
  'rejects malformed responsive sources without printing author input: %s',
  srcset => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    try {
      expect(() => rewriteCmsSrcset(srcset)).toThrow('malformed image sources')
      expect(log).not.toHaveBeenCalled()
    } finally {
      log.mockRestore()
    }
  },
)
