import { expect, it, vi } from 'vitest'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { hydrateCmsImages, serializeCmsBody } from './body'

const paragraph = (text: string) => ({
  _type: 'block',
  children: [{ _type: 'span', text, marks: [] }],
  markDefs: [],
})

it('uses native text, list and image Markdown without native field identities', () => {
  const body = serializeCmsBody([
    { ...paragraph('A heading'), style: 'h2', _key: 'native-block' },
    { ...paragraph('First item'), listItem: 'bullet', level: 1 },
    { ...paragraph('Second item'), listItem: 'bullet', level: 1 },
    {
      _type: 'image',
      _key: 'native-image',
      alt: 'Synthetic photograph',
      asset: {
        _ref: 'native-media-id',
        url: '/_emdash/api/media/file/trial-photo.png',
      },
    },
    { _type: 'break' },
    paragraph('After the divider'),
  ])
  expect(body).toContain('## A heading')
  expect(body).toContain('- First item\n- Second item')
  expect(body).toContain(
    '![Synthetic photograph](/_emdash/api/media/file/trial-photo.png)',
  )
  expect(body).toContain('\n\n---\n\nAfter the divider')
  expect(body).not.toContain('native-')
  expect(body).not.toContain('ec:block')
})
it.each([
  'const literal = "```markdown";\nconst html = "<script>untouched</script>";',
  "`````\n<div>Olá & 'quotes'</div>\n````",
  'const finalNewline = true;\n',
  '',
])('preserves exact code fence content: %s', code => {
  const body = serializeCmsBody([
    paragraph('Before'),
    { _type: 'code', language: 'typescript', code },
    paragraph('After'),
  ])
  const node = fromMarkdown(body).children.find(child => child.type === 'code')
  expect(node).toMatchObject({
    type: 'code',
    lang: 'typescript',
    value: code,
  })
  expect(body).not.toContain('&lt;')
})
it('preserves public links and decorators', () => {
  expect(
    serializeCmsBody([
      {
        _type: 'block',
        children: [
          { _type: 'span', text: 'Read this', marks: ['strong', 'link'] },
        ],
        markDefs: [
          { _type: 'link', _key: 'link', href: 'https://example.com/post' },
        ],
      },
    ]),
  ).toBe('[**Read this**](https://example.com/post)')
})
it('preserves plain text spans when optional formatting fields are absent', () => {
  expect(
    serializeCmsBody([
      { _type: 'block', children: [{ _type: 'span', text: 'Plain source' }] },
    ]),
  ).toBe('Plain source')
})
it.each([undefined, null, []])('accepts an empty body', value => {
  expect(serializeCmsBody(value)).toBe('')
})
it('refuses unknown opaque blocks and malformed rich text', () => {
  expect(() =>
    serializeCmsBody([{ _type: 'custom', internalId: 'native-id' }]),
  ).toThrow()
  expect(() =>
    serializeCmsBody([{ _type: 'block', children: 'invalid' }]),
  ).toThrow()
  expect(() =>
    serializeCmsBody([{ _type: 'code', language: 'ts\n```', code: 'text' }]),
  ).toThrow()
})
it('refuses signed attachment URLs in public exports', () => {
  expect(() =>
    serializeCmsBody([
      {
        _type: 'image',
        asset: { url: 'https://example.com/image?X-Amz-Signature=synthetic' },
      },
    ]),
  ).toThrow()
})
it('continues native ordered numbering across non-text blocks', () => {
  const number = (text: string) => ({
    ...paragraph(text),
    listItem: 'number',
    level: 1,
    listId: 'sequence',
    listStart: 4,
  })
  const body = serializeCmsBody([
    number('Before'),
    { _type: 'code', code: 'raw' },
    number('After'),
  ])
  const lists = fromMarkdown(body).children.filter(node => node.type === 'list')
  expect(lists.map(list => list.start)).toEqual([4, 5])
})

it('uses the first present native listStart for earlier items in the same sequence', () => {
  const number = (text: string, listStart?: number) => ({
    ...paragraph(text),
    listItem: 'number',
    level: 1,
    listId: 'series',
    listStart,
  })
  const body = serializeCmsBody([number('First'), number('Second', 4)])
  expect(fromMarkdown(body)).toMatchObject({
    type: 'root',
    children: [
      {
        type: 'list',
        ordered: true,
        start: 4,
        children: [
          {
            type: 'listItem',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', value: 'First' }],
              },
            ],
          },
          {
            type: 'listItem',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', value: 'Second' }],
              },
            ],
          },
        ],
      },
    ],
  })
})

it.each([
  { interlude: paragraph('Interlude'), type: 'paragraph' },
  { interlude: { _type: 'code', code: 'raw' }, type: 'code' },
])(
  'pre-scans native numbering metadata across $type blocks before exporting text runs',
  ({ interlude, type }) => {
    const number = (text: string, listStart?: number) => ({
      ...paragraph(text),
      listItem: 'number',
      level: 1,
      listId: 'series',
      listStart,
    })
    const body = serializeCmsBody([
      number('First'),
      interlude,
      number('Second', 4),
      number('Third'),
    ])
    expect(fromMarkdown(body)).toMatchObject({
      type: 'root',
      children: [
        {
          type: 'list',
          ordered: true,
          start: 4,
          children: [
            {
              type: 'listItem',
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', value: 'First' }],
                },
              ],
            },
          ],
        },
        { type },
        {
          type: 'list',
          ordered: true,
          start: 5,
          children: [
            {
              type: 'listItem',
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', value: 'Second' }],
                },
              ],
            },
            {
              type: 'listItem',
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', value: 'Third' }],
                },
              ],
            },
          ],
        },
      ],
    })
  },
)
it('hydrates native editor references into durable public Markdown and retains native rendering fields', async () => {
  const resolveKey = vi.fn().mockResolvedValue('synthetic-photo.png')
  const block = {
    _type: 'image',
    _key: 'native-key',
    alt: 'Photo',
    asset: { _ref: 'native-media-id', provider: 'local', width: 800 },
  }
  const body = [paragraph('Before'), block]
  await hydrateCmsImages(body, resolveKey)
  expect(resolveKey).toHaveBeenCalledWith('native-media-id')
  expect(body[1]).toBe(block)
  expect(block.asset).toMatchObject({
    provider: 'local',
    width: 800,
    meta: { storageKey: 'synthetic-photo.png' },
  })
  expect(serializeCmsBody(body)).toBe(
    'Before\n\n![Photo](/_emdash/api/media/file/synthetic-photo.png)',
  )
  expect(serializeCmsBody(body)).not.toMatch(
    /native-media-id|native-key|provider|width/,
  )
})
it.each([
  { src: '/images/synthetic.png' },
  { url: 'https://example.com/synthetic.png' },
  { meta: { storageKey: 'synthetic.png' } },
])('exports measured native image URL shape: %s', async asset => {
  const body = [{ _type: 'image', alt: 'Photo', asset }]
  const resolveKey = vi.fn()
  await hydrateCmsImages(body, resolveKey)
  expect(serializeCmsBody(body)).toContain('![Photo](')
  expect(resolveKey).not.toHaveBeenCalled()
})
it('supports the native asset id shape and rejects failed media resolution', async () => {
  const body = [{ _type: 'image', asset: { id: 'native-media-id' } }]
  await hydrateCmsImages(body, () => Promise.resolve('synthetic.png'))
  expect(serializeCmsBody(body)).toBe(
    '![](/_emdash/api/media/file/synthetic.png)',
  )
  await expect(
    hydrateCmsImages([{ _type: 'image', asset: {} }], () =>
      Promise.resolve('unused.png'),
    ),
  ).rejects.toThrow('durable native media reference')
  await expect(
    hydrateCmsImages([{ _type: 'image', asset: { _ref: 'missing' } }], () =>
      Promise.reject(new Error('missing media')),
    ),
  ).rejects.toThrow('missing media')
  await hydrateCmsImages(undefined, () => Promise.resolve('unused.png'))
})
it.each([
  { _ref: 'unhydrated-media-id' },
  { meta: { storageKey: '../private.png' } },
  { url: '/_emdash/api/media/file/synthetic.png?_preview=private' },
])('refuses unusable or private native media URLs: %s', asset => {
  expect(() => serializeCmsBody([{ _type: 'image', asset }])).toThrow()
})
