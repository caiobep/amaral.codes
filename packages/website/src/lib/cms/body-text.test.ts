import { expect, it } from 'vitest'
import { fromMarkdown } from 'mdast-util-from-markdown'
import type { Root } from 'mdast'
import { serializeCmsBody } from './body'

const textBlock = (text: string, fields: Record<string, unknown> = {}) => ({
  _type: 'block',
  children: [{ _type: 'span', text }],
  ...fields,
})

function firstParagraph(tree: Root) {
  const first = tree.children[0]
  if (first?.type === 'blockquote') return first.children[0]
  if (first?.type === 'list')
    return first.children.flatMap(item => item.children)[0]
  return first
}

it.each([
  '# This is literal text',
  '- item',
  '+ item',
  '1. item',
  '1) item',
  '---',
  '===',
  'A &copy; literal',
  '    four spaces',
  '\tindented',
])('round-trips pasted paragraph text as literal prose: %s', source => {
  const tree = fromMarkdown(serializeCmsBody([textBlock(source)]))
  expect(tree.children).toHaveLength(1)
  const paragraph = tree.children[0]
  expect(paragraph?.type).toBe('paragraph')
  if (paragraph?.type !== 'paragraph') throw new Error('Expected literal prose')
  expect(paragraph.children).toHaveLength(1)
  expect(paragraph.children[0]).toMatchObject({ type: 'text', value: source })
})

it('preserves native inline marks and exact inline backticks', () => {
  const body = serializeCmsBody([
    {
      _type: 'block',
      children: [
        { _type: 'span', text: 'strong', marks: ['strong'] },
        { _type: 'span', text: 'em', marks: ['em'] },
        { _type: 'span', text: 'strike', marks: ['strike-through'] },
        { _type: 'span', text: 'under', marks: ['underline'] },
        { _type: 'span', text: 'up', marks: ['superscript'] },
        { _type: 'span', text: 'down', marks: ['subscript'] },
        { _type: 'span', text: '`raw`', marks: ['code'] },
        { _type: 'span', text: 'plain code', marks: ['code'] },
      ],
    },
  ])
  expect(body).toBe(
    '<strong>strong</strong><em>em</em><s>strike</s><u>under</u><sup>up</sup><sub>down</sub><code>`raw`</code><code>plain code</code>',
  )
})

it.each([
  ['h1', 'h2'],
  ['h3', 'h3'],
  ['blockquote', 'blockquote'],
  [undefined, 'p'],
])(
  'preserves native alignment and public heading policy for %s',
  (style, tag) => {
    expect(
      serializeCmsBody([
        textBlock('<literal>\nsecond', { style, textAlign: 'center' }),
      ]),
    ).toBe(
      `<${tag} style="text-align: center;">&lt;literal&gt;<br>second</${tag}>`,
    )
  },
)

it('keeps list structure when native text is aligned', () => {
  expect(
    serializeCmsBody([
      textBlock('Aligned item', {
        textAlign: 'right',
        listItem: 'bullet',
        level: 1,
      }),
    ]),
  ).toBe('- <p style="text-align: right;">Aligned item</p>')
  expect(
    serializeCmsBody([
      textBlock('First', { textAlign: 'left', style: 'normal' }),
    ]),
  ).toBe('First')
})

it('refuses unknown inline formatting instead of silently dropping it', () => {
  expect(() =>
    serializeCmsBody([
      {
        _type: 'block',
        children: [{ _type: 'span', text: 'Text', marks: ['unknown-style'] }],
      },
    ]),
  ).toThrow('unsupported inline formatting')
})

it('exports native hard breaks as hard breaks in prose and blockquotes', () => {
  for (const fields of [
    { style: 'normal' },
    { style: 'blockquote' },
    { listItem: 'number', level: 1 },
  ]) {
    const tree = fromMarkdown(serializeCmsBody([textBlock('one\ntwo', fields)]))
    expect(firstParagraph(tree)).toMatchObject({
      type: 'paragraph',
      children: [
        { type: 'text', value: 'one' },
        { type: 'break' },
        { type: 'text', value: 'two' },
      ],
    })
  }
})

it('keeps native multiline headings in one heading with a hard break', () => {
  expect(serializeCmsBody([textBlock('one\ntwo', { style: 'h2' })])).toBe(
    '<h2>one<br>two</h2>',
  )
})

it('keeps native inline code spaces and applies code before other decorators', () => {
  const code = serializeCmsBody([
    textBlock('', {
      children: [{ _type: 'span', text: ' code ', marks: ['code'] }],
    }),
  ])
  const paragraph = fromMarkdown(code).children[0]
  expect(paragraph).toMatchObject({
    type: 'paragraph',
    children: [{ type: 'inlineCode', value: ' code ' }],
  })
  for (const marks of [
    ['strong', 'code'],
    ['code', 'strong'],
  ]) {
    const body = serializeCmsBody([
      textBlock('', { children: [{ _type: 'span', text: 'raw', marks }] }),
    ])
    expect(fromMarkdown(body).children[0]).toMatchObject({
      type: 'paragraph',
      children: [
        { type: 'strong', children: [{ type: 'inlineCode', value: 'raw' }] },
      ],
    })
  }
})

it.each([
  { spans: [{ text: ' bold ', marks: ['strong'] }] },
  {
    spans: [
      { text: 'A', marks: ['strong'] },
      { text: 'B', marks: ['strong'] },
    ],
  },
  {
    spans: [{ text: 'word' }, { text: 'mid', marks: ['em'] }, { text: 'word' }],
  },
])(
  'preserves ambiguous native marked spans without literal Markdown syntax: %s',
  ({ spans }) => {
    const body = serializeCmsBody([
      textBlock('', {
        children: spans.map(span => ({ _type: 'span', ...span })),
      }),
    ])
    expect(body).toContain('<')
    expect(body.replace(/<[^>]+>/gu, '')).toBe(
      spans.map(span => span.text).join(''),
    )
  },
)

it('retains ordinary readable Markdown when its marks round-trip', () => {
  const body = serializeCmsBody([
    textBlock('', {
      children: [
        { _type: 'span', text: 'A ', marks: [] },
        { _type: 'span', text: 'bold', marks: ['strong'] },
        { _type: 'span', text: ' and ', marks: [] },
        { _type: 'span', text: 'italic', marks: ['em'] },
      ],
    }),
  ])
  expect(body).toBe('A **bold** and _italic_')
})

it('preserves numbered list nesting, starting numbers and continued numbering', () => {
  const number = (text: string, level = 1, listId = 'sequence') =>
    textBlock(text, { listItem: 'number', level, listId, listStart: 4 })
  const body = serializeCmsBody([
    number('parent'),
    number('child', 2, 'nested'),
    number('next'),
    textBlock('Interlude'),
    number('continued'),
  ])
  const tree = fromMarkdown(body)
  expect(tree.children[0]).toMatchObject({
    type: 'list',
    ordered: true,
    start: 4,
    children: [
      {
        type: 'listItem',
        children: [
          { type: 'paragraph' },
          { type: 'list', ordered: true, start: 4 },
        ],
      },
      { type: 'listItem', children: [{ type: 'paragraph' }] },
    ],
  })
  expect(tree.children[2]).toMatchObject({ type: 'list', start: 6 })
  expect(body).not.toContain('sequence')
})

it('keeps adjacent native numbered lists with distinct identities separate', () => {
  const body = serializeCmsBody([
    textBlock('First', {
      listItem: 'number',
      level: 1,
      listId: 'first',
      listStart: 4,
    }),
    textBlock('Second', {
      listItem: 'number',
      level: 1,
      listId: 'second',
      listStart: 7,
    }),
  ])
  const lists = fromMarkdown(body).children.filter(node => node.type === 'list')
  expect(lists.map(list => list.start)).toEqual([4, 7])
})

it('keeps nested native list items after aligned HTML content', () => {
  const body = serializeCmsBody([
    textBlock('Aligned', { listItem: 'bullet', level: 1, textAlign: 'center' }),
    textBlock('Nested', { listItem: 'bullet', level: 2 }),
  ])
  expect(fromMarkdown(body).children[0]).toMatchObject({
    type: 'list',
    children: [
      { type: 'listItem', children: [{ type: 'html' }, { type: 'list' }] },
    ],
  })
})

it('keeps distinct restarted numbered lists inside their native parent item', () => {
  const body = serializeCmsBody([
    textBlock('Parent', { listItem: 'bullet', level: 1 }),
    textBlock('First', {
      listItem: 'number',
      level: 2,
      listId: 'first',
      listStart: 4,
    }),
    textBlock('Second', {
      listItem: 'number',
      level: 2,
      listId: 'second',
      listStart: 7,
    }),
  ])
  const tree = fromMarkdown(body)
  expect(tree).toMatchObject({
    type: 'root',
    children: [
      {
        type: 'list',
        ordered: false,
        children: [
          {
            type: 'listItem',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', value: 'Parent' }],
              },
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
              { type: 'html', value: '<!-- -->' },
              {
                type: 'list',
                ordered: true,
                start: 7,
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
                ],
              },
            ],
          },
        ],
      },
    ],
  })
})

it('retains the native numbered list base when later segments omit optional listStart', () => {
  const body = serializeCmsBody([
    textBlock('First', {
      listItem: 'number',
      level: 1,
      listId: 'series',
      listStart: 4,
    }),
    textBlock('Interlude'),
    textBlock('Second', { listItem: 'number', level: 1, listId: 'series' }),
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
      { type: 'paragraph', children: [{ type: 'text', value: 'Interlude' }] },
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
        ],
      },
    ],
  })
})

it('keeps consecutive native quote paragraphs in one blockquote', () => {
  const body = serializeCmsBody([
    textBlock('First', { style: 'blockquote' }),
    textBlock('Second', { style: 'blockquote', textAlign: 'left' }),
  ])
  expect(fromMarkdown(body)).toMatchObject({
    type: 'root',
    children: [
      {
        type: 'blockquote',
        children: [
          { type: 'paragraph', children: [{ type: 'text', value: 'First' }] },
          { type: 'paragraph', children: [{ type: 'text', value: 'Second' }] },
        ],
      },
    ],
  })
})
