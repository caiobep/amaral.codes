import assert from 'node:assert/strict'
import test from 'node:test'
import { readPublicEntry, relocateImages } from './archive.mjs'

test('moving image storage preserves fenced code, HTML, and surrounding Markdown', () => {
  const body =
    '```js\nconst src = "../images/example.webp";\n```\n\n<details><summary>More</summary>\n\n**Example**\n\n</details>\n\n![Alt](../images/example.webp "Image")\n'
  assert.equal(
    relocateImages(body).body,
    body.replace('![Alt](../images/example.webp', '![Alt](/media/example.webp'),
  )
  assert.deepEqual(relocateImages(body).images, ['../images/example.webp'])
})

test('public archive validation rejects private workflow metadata and unknown fields', () => {
  const raw =
    '---\ntitle: Example\ndate: "2026-10-13"\ncategory: note\nsummary: Secondary text\n---\nBody\n'
  assert.equal(
    readPublicEntry('example.md', raw).metadata.summary,
    'Secondary text',
  )
  assert.equal(readPublicEntry('example.md', raw).body, 'Body\n')
  assert.throws(() =>
    readPublicEntry(
      'example.md',
      raw.replace('category: note', 'category: note\ndraft: true'),
    ),
  )
  assert.throws(() =>
    readPublicEntry(
      'example.md',
      raw.replace('category: note', 'category: note\nnotionId: private-id'),
    ),
  )
})
