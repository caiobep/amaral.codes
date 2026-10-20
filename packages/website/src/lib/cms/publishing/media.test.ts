import { expect, it, vi } from 'vitest'
import { assertNativeContent } from '../native-content'
import { assertCmsMediaReady } from './media'

it('validates canonical native media URLs and ignores unrelated-origin lookalikes', async () => {
  const ready = vi.fn().mockResolvedValue(undefined)
  const blocks = [
    {
      _key: 'canonical',
      _type: 'htmlBlock',
      html: '<img src="https://amaral.codes/_emdash/api/media/file/canonical.png">',
    },
    {
      _key: 'other',
      _type: 'htmlBlock',
      html: '<img src="https://example.com/_emdash/api/media/file/other.png">',
    },
  ]
  assertNativeContent(blocks)
  await assertCmsMediaReady(blocks, ready)
  expect(ready.mock.calls).toEqual([['canonical.png']])
  const missing = [
    {
      _key: 'missing',
      _type: 'file',
      url: 'https://amaral.codes/_emdash/api/media/file/missing.pdf',
    },
  ]
  assertNativeContent(missing)
  ready.mockRejectedValue(new Error('Media is not ready'))
  await expect(assertCmsMediaReady(missing, ready)).rejects.toThrow(
    'Media is not ready',
  )
})

it('checks internal URLs in rendered HTML, embeds and file blocks', async () => {
  const ready = vi.fn().mockResolvedValue(undefined)
  const blocks = [
    {
      _key: 'html',
      _type: 'htmlBlock',
      html: '<img src="/_emdash/api/media/file/html.png">',
    },
    {
      _key: 'embed',
      _type: 'embed',
      url: 'https://example.com',
      html: '<img src="/_emdash/api/media/file/embed.png">',
    },
    {
      _key: 'file',
      _type: 'file',
      url: '/_emdash/api/media/file/document.pdf',
    },
  ]
  assertNativeContent(blocks)
  await assertCmsMediaReady(blocks, ready)
  expect(ready.mock.calls).toEqual([
    ['html.png'],
    ['embed.png'],
    ['document.pdf'],
  ])
})

it('ignores media in unused embed HTML and unrelated blocks', async () => {
  const ready = vi.fn()
  const blocks = [
    {
      _key: 'video',
      _type: 'embed',
      provider: 'video',
      url: 'https://example.com/video',
      html: '<img src="/_emdash/api/media/file/unused.png">',
    },
    {
      _key: 'text',
      _type: 'block',
      html: '<img src="/_emdash/api/media/file/ignored.png">',
    },
    { _key: 'empty', _type: 'file' },
    { _key: 'iframe', _type: 'iframe', src: 'https://example.com/embed' },
    { _key: 'empty-embed', _type: 'embed' },
    { _key: 'empty-html', _type: 'htmlBlock' },
  ]
  assertNativeContent(blocks)
  await assertCmsMediaReady(blocks, ready)
  expect(ready).not.toHaveBeenCalled()
})

it('refuses missing or malformed internal media before promotion', async () => {
  const ready = vi.fn().mockRejectedValue(new Error('Media is not ready'))
  const blocks = [
    { _key: 'file', _type: 'file', url: '/_emdash/api/media/file/missing.pdf' },
  ]
  assertNativeContent(blocks)
  await expect(assertCmsMediaReady(blocks, ready)).rejects.toThrow(
    'Media is not ready',
  )
  const malformed = [
    {
      _key: 'file',
      _type: 'file',
      url: '/_emdash/api/media/file/path/invalid.pdf',
    },
  ]
  assertNativeContent(malformed)
  await expect(assertCmsMediaReady(malformed, ready)).rejects.toThrow(
    'valid media URL',
  )
})
