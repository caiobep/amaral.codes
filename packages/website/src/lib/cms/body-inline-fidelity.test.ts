import { expect, it } from 'vitest'
import { inlineMarkdownMatches } from './body-inline-fidelity'

it('checks text, decorator and link semantics rather than Markdown spelling', () => {
  const spans = [
    { text: 'Read ', marks: [] },
    { text: 'this', marks: ['strong', 'source'] },
  ]
  const links = [{ _key: 'source', href: 'https://example.com/detail(a)' }]
  expect(
    inlineMarkdownMatches(
      'Read [**this**](https://example.com/detail%28a%29)',
      spans,
      links,
    ),
  ).toBe(true)
  expect(
    inlineMarkdownMatches(
      'Read [this](https://example.com/detail%28a%29)',
      spans,
      links,
    ),
  ).toBe(false)
  expect(
    inlineMarkdownMatches(
      'Read [**this**](https://example.com/other)',
      spans,
      links,
    ),
  ).toBe(false)
})

it('recognizes the static inline HTML marks used by public Markdown', () => {
  expect(
    inlineMarkdownMatches(
      '<u>one<br>two</u>',
      [{ text: 'one\ntwo', marks: ['underline'] }],
      [],
    ),
  ).toBe(true)
  expect(
    inlineMarkdownMatches(
      '<b>one</b>',
      [{ text: 'one', marks: ['strong'] }],
      [],
    ),
  ).toBe(false)
})

it('rejects attributes and unrelated HTML elements as representations of native inline marks', () => {
  const spans = [{ text: 'one', marks: ['underline'] }]
  expect(inlineMarkdownMatches('<u class="other">one</u>', spans, [])).toBe(
    false,
  )
  expect(inlineMarkdownMatches('<span>one</span>', spans, [])).toBe(false)
})

it.each([
  '# Source',
  'Source\n\nOther',
  '![Source](https://example.com/image.png)',
])(
  'rejects Markdown that changes inline prose into block or image structure: %s',
  markdown => {
    expect(inlineMarkdownMatches(markdown, [{ text: 'Source' }], [])).toBe(
      false,
    )
  },
)

it('accepts an empty inline run without inventing text', () => {
  expect(inlineMarkdownMatches('', [], [])).toBe(true)
  expect(inlineMarkdownMatches('', [{ text: '' }], [])).toBe(true)
})
