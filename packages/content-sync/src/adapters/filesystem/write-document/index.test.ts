import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'vitest'
import { writeContentSource } from './index.ts'

test('writes a rendered document to its stable slug path', async ({ onTestFinished }) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'content-document-'))
  onTestFinished(() => fs.rm(root, { recursive: true, force: true }))

  const filePath = await writeContentSource(
    root,
    'example-post',
    '---\ntitle: "Example"\n---\n\nBody\n',
  )

  assert.equal(filePath, path.join(root, 'example-post.md'))
  assert.match(await fs.readFile(filePath, 'utf8'), /title: "Example"/)
})

test('preserves a safe legacy underscore slug', async ({ onTestFinished }) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'legacy-content-document-'))
  onTestFinished(() => fs.rm(root, { recursive: true, force: true }))

  const filePath = await writeContentSource(root, 'example_-', 'Body\n')

  assert.equal(filePath, path.join(root, 'example_-.md'))
})

test('rejects a slug that could escape the content directory', async () => {
  await assert.rejects(
    writeContentSource('/unused', '../private', ''),
    /Invalid content slug/,
  )
})
