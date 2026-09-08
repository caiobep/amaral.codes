import assert from 'node:assert/strict'
import { test } from 'vitest'
import { renderMarkdownDocument } from './index.ts'

test('renders valid frontmatter before the Markdown body', () => {
  const result = renderMarkdownDocument({
    content: 'Body copy',
    metadata: {
      title: 'A title',
      date: '2026-07-27',
      summary: 'A useful summary.',
      category: 'note',
      topics: ['software'],
    },
  })

  assert.equal(
    result,
    '---\ntitle: "A title"\ndate: "2026-07-27"\nsummary: "A useful summary."\ncategory: "note"\ntopics: ["software"]\n---\n\nBody copy\n',
  )
})
