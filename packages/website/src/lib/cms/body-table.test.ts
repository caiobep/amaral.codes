import { expect, it } from 'vitest'
import { serializeCmsBody } from './body'

const cell = (text: string, isHeader = false) => ({
  _type: 'tableCell',
  _key: `cell-${text}`,
  content: [{ _type: 'span', _key: `span-${text}`, text }],
  isHeader,
})

it('exports a native table with header semantics and merged cells', () => {
  const body = serializeCmsBody([
    {
      _type: 'table',
      _key: 'table',
      hasHeaderRow: true,
      rows: [
        {
          _type: 'tableRow',
          _key: 'header',
          cells: [cell('Name', true), cell('Detail', true)],
        },
        {
          _type: 'tableRow',
          _key: 'body',
          cells: [{ ...cell('Merged <value>'), colspan: 2 }],
        },
      ],
    },
  ])
  expect(body).toContain('<table>')
  expect(body).toContain('<th>Name</th>')
  expect(body).toContain('<td colspan="2">Merged &lt;value&gt;</td>')
  expect(body).not.toMatch(/ec:block|_key|tableRow/)
})

it('preserves cell formatting, links, alignment and row spans through the native normalizer', () => {
  const body = serializeCmsBody([
    {
      _type: 'table',
      _key: 'rich-table',
      markDefs: [
        { _type: 'link', _key: 'link', href: 'https://example.com/?a=1&b=2' },
      ],
      rows: [
        {
          _type: 'tableRow',
          _key: 'first',
          cells: [
            {
              ...cell('Rich'),
              rowspan: 2,
              textAlign: 'center',
              content: [
                ...[
                  'strong',
                  'em',
                  'code',
                  'strike-through',
                  'underline',
                  'superscript',
                  'subscript',
                ].map(mark => ({ _type: 'span', text: mark, marks: [mark] })),
                { _type: 'span', text: 'Link', marks: ['link'] },
              ],
            },
            cell('Other'),
          ],
        },
        { _type: 'tableRow', _key: 'second', cells: [cell('Last')] },
      ],
    },
  ])
  expect(body).toContain('rowspan="2" style="text-align: center;"')
  expect(body).toContain(
    '<strong>strong</strong><em>em</em><code>code</code><s>strike-through</s><u>underline</u><sup>superscript</sup><sub>subscript</sub>',
  )
  expect(body).toContain('<a href="https://example.com/?a=1&amp;b=2">Link</a>')
})

it('fails closed for malformed or unsupported native table content', () => {
  expect(() => serializeCmsBody([{ _type: 'table', rows: 'invalid' }])).toThrow(
    'unsupported or malformed',
  )
  expect(() =>
    serializeCmsBody([
      {
        _type: 'table',
        rows: [
          {
            cells: [
              {
                ...cell('Private'),
                markDefs: [
                  {
                    _type: 'link',
                    _key: 'private',
                    href: 'https://example.com/?X-Amz-Signature=private',
                  },
                ],
                content: [
                  { _type: 'span', text: 'Private', marks: ['private'] },
                ],
              },
            ],
          },
        ],
      },
    ]),
  ).toThrow()
})
