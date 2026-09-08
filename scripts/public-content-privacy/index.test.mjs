import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { checkPublicContentRoots, checkPublicDocument } from './index.mjs'

test('accepts ordinary public URLs and safe nested embeds', () => {
  const document = [
    '---',
    'sourceUrl: "https://example.com/article?ref=homepage"',
    '---',
    '<iframe src="https://www.figma.com/embed?url=https%3A%2F%2Ffigma.com%2Ffile%2Fexample"></iframe>',
  ].join('\n')

  assert.deepEqual(checkPublicDocument('safe.md', document), [])
})

test('detects plain, encoded, and nested signing credentials', () => {
  const documents = [
    '![Private](https://files.example.com/file?X-Amz-Signature=secret)',
    '[Private](https://example.com/file?api_key=secret)',
    '<iframe src="https://embed.example.com/?url=https%253A%252F%252Ffiles.example.com%252Ffile%253Ftoken%253Dsecret"></iframe>',
  ]

  documents.forEach(document => {
    assert.deepEqual(checkPublicDocument('private.md', document), [{
      file: 'private.md',
      reason: 'signed or credential-bearing URL',
    }])
  })
})

test('detects URL userinfo without returning the sensitive URL', () => {
  const violations = checkPublicDocument(
    'private.md',
    '[Private](https://user:secret@example.com/file)',
  )

  assert.deepEqual(violations, [{
    file: 'private.md',
    reason: 'credential-bearing URL',
  }])
  assert.equal(JSON.stringify(violations).includes('secret'), false)
})

test('retains existing Notion and frontmatter privacy checks', () => {
  const document = [
    '---',
    'status: preview',
    '---',
    '[Workspace](https://workspace.notion.site/private)',
  ].join('\n')

  assert.deepEqual(checkPublicDocument('private.md', document), [
    { file: 'private.md', reason: 'private workflow metadata' },
    { file: 'private.md', reason: 'Notion URL' },
  ])
})

for (const status of [
  'status: published',
  'status: draft',
  'status: "draft"',
  "status: 'preview'",
]) {
  test(`detects private YAML status syntax: ${status}`, () => {
    const document = ['---', status, '---', 'Private body'].join('\n')

    assert.deepEqual(checkPublicDocument('private.md', document), [{
      file: 'private.md',
      reason: 'private workflow metadata',
    }])
  })
}

test('scans nested deterministic fixture inputs', (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'public-fixtures-'))
  const fixture = path.join(root, 'entries/notes/private.md')
  fs.mkdirSync(path.dirname(fixture), { recursive: true })
  fs.writeFileSync(fixture, '[Private](https://example.com/file?token=secret)')
  context.after(() => fs.rmSync(root, { force: true, recursive: true }))

  assert.deepEqual(checkPublicContentRoots([root]), [{
    file: fixture,
    reason: 'signed or credential-bearing URL',
  }])
})
