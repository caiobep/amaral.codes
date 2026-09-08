import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { inspectContentAssets } from './index.mjs'

test('accepts bundled images and deployed public assets', async (context) => {
  const workspace = await createWorkspace(context)
  await write(workspace, 'content/notes/images/photo.webp', 'image')
  await write(workspace, 'public/talks/slides.pdf', 'slides')
  await write(workspace, 'content/notes/post.md', [
    '![Photo](./images/photo.webp)',
    '[Slides](/talks/slides.pdf)',
  ].join('\n'))

  assert.deepEqual(await inspect(workspace), [])
})

test('reports missing images and public assets', async (context) => {
  const workspace = await createWorkspace(context)
  await write(workspace, 'content/post.md', [
    '![Missing](./images/missing.webp)',
    '[Missing](/talks/missing.pdf)',
  ].join('\n'))

  const issues = await inspect(workspace)
  assert.deepEqual(issues.map(issue => issue.issue), ['missing', 'missing'])
})

test('rejects content-relative non-image assets even when they exist', async (context) => {
  const workspace = await createWorkspace(context)
  await write(workspace, 'content/assets/episode.mp3', 'audio')
  await write(
    workspace,
    'content/post.md',
    '<audio src="./assets/episode.mp3">Episode</audio>',
  )

  const issues = await inspect(workspace)
  assert.equal(issues.some(issue => issue.issue === 'unsupported'), true)
})

test('reports unreferenced images in nested content image folders', async (context) => {
  const workspace = await createWorkspace(context)
  await write(workspace, 'content/notes/images/orphan.webp', 'image')
  await write(workspace, 'content/notes/post.md', 'No image here.')

  const issues = await inspect(workspace)
  assert.deepEqual(issues, [{
    file: path.join(workspace, 'content/notes/images/orphan.webp'),
    issue: 'unused',
  }])
})

async function createWorkspace(context) {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'content-assets-'))
  await fs.mkdir(path.join(workspace, 'content'), { recursive: true })
  await fs.mkdir(path.join(workspace, 'public'), { recursive: true })
  context.after(() => fs.rm(workspace, { force: true, recursive: true }))
  return workspace
}

async function write(workspace, relativePath, value) {
  const target = path.join(workspace, relativePath)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, value)
}

function inspect(workspace) {
  return inspectContentAssets({
    contentRoots: [path.join(workspace, 'content')],
    publicRoot: path.join(workspace, 'public'),
  })
}
