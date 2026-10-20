import { expect, it, vi } from 'vitest'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { hydrateCmsImages, serializeCmsBody } from './body'

it('hydrates native galleries and exports every image and caption without IDs', async () => {
  const blocks = [
    {
      _type: 'gallery',
      _key: 'gallery',
      columns: 2,
      images: [
        {
          _type: 'image',
          _key: 'one',
          alt: 'First',
          caption: 'First caption',
          asset: { _ref: 'private-media-one' },
        },
        {
          _type: 'image',
          _key: 'two',
          alt: 'Second',
          asset: { _ref: 'private-media-two' },
        },
      ],
    },
  ]
  await hydrateCmsImages(blocks, id =>
    Promise.resolve(id === 'private-media-one' ? 'one.png' : 'two.png'),
  )
  const body = serializeCmsBody(blocks)
  expect(body).toContain('![First](/_emdash/api/media/file/one.png)')
  expect(body).toContain('First caption')
  expect(body).toContain('![Second](/_emdash/api/media/file/two.png)')
  expect(body).not.toContain('private-media')
})

it('preserves native image links and title captions while omitting private fields', () => {
  const body = serializeCmsBody([
    {
      _type: 'image',
      title: 'A title',
      asset: { url: 'https://example.com/picture.png', _ref: 'private-id' },
      link: { href: 'https://example.com/detail(a)', blank: true },
    },
  ])
  expect(body).toBe(
    '[![](https://example.com/picture.png)](https://example.com/detail%28a%29)\n\nA title',
  )
})

it('validates every native image key, including already-provided URLs and galleries', async () => {
  const check = vi
    .fn<(key: string) => Promise<void>>()
    .mockResolvedValue(undefined)
  const resolve = vi
    .fn<(id: string) => Promise<string>>()
    .mockResolvedValue('resolved.png')
  const blocks = [
    { _type: 'image', asset: { meta: { storageKey: 'stored.png' } } },
    { _type: 'image', asset: { url: '/_emdash/api/media/file/url.png' } },
    {
      _type: 'gallery',
      images: [
        {
          _type: 'image',
          asset: { url: '', src: '/_emdash/api/media/file/source.png' },
        },
        { _type: 'image', asset: { _ref: 'private-ref' } },
        { _type: 'image', asset: { url: 'https://example.com/external.png' } },
      ],
    },
  ]
  await hydrateCmsImages(blocks, resolve, check)
  expect(check.mock.calls.map(([key]) => key).sort()).toEqual([
    'resolved.png',
    'source.png',
    'stored.png',
    'url.png',
  ])
  expect(resolve).toHaveBeenCalledExactlyOnceWith('private-ref')
  expect(serializeCmsBody(blocks)).toContain('source.png')
})

it('refuses publishing media that was supplied directly but is not ready', async () => {
  const resolve = vi
    .fn<(id: string) => Promise<string>>()
    .mockResolvedValue('unused.png')
  const reject = () => Promise.reject(new Error('CMS media is not ready'))
  await expect(
    hydrateCmsImages(
      [
        {
          _type: 'image',
          asset: { url: '/_emdash/api/media/file/missing.png' },
        },
      ],
      resolve,
      reject,
    ),
  ).rejects.toThrow('not ready')
  expect(resolve).not.toHaveBeenCalled()
})

it.each(['# Literal caption', '1. Literal caption', 'A &copy; literal'])(
  'keeps standalone and gallery captions as literal paragraphs: %s',
  caption => {
    const image = {
      _type: 'image',
      alt: 'Photo',
      caption,
      asset: { url: 'https://example.com/photo.png' },
    }
    for (const block of [image, { _type: 'gallery', images: [image] }]) {
      const tree = fromMarkdown(serializeCmsBody([block]))
      expect(tree.children).toHaveLength(2)
      const paragraph = tree.children[1]
      expect(paragraph?.type).toBe('paragraph')
      if (paragraph?.type !== 'paragraph')
        throw new Error('Expected literal caption')
      expect(paragraph.children[0]).toMatchObject({
        type: 'text',
        value: caption,
      })
    }
  },
)
