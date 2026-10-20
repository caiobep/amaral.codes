import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { prepareSourceConnection, connectionPlan } from './connect-source.mjs'

test('the content repository keeps a small bootstrap and a pin instead of a maintained website copy', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'publishing-connection-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  await prepareSourceConnection(directory, 'a'.repeat(40))
  const manifest = JSON.parse(await fs.readFile(path.join(directory, 'package.json')))
  assert.equal(manifest.workspaces, undefined)
  assert.equal(manifest.scripts.build, 'node publishing/bootstrap.mjs')
  assert((await fs.readFile(path.join(directory, '.gitignore'), 'utf8')).includes('.publishing/'))
  assert.deepEqual(connectionPlan(['.publishing/website/src/example.astro']).preserve, ['entries', 'media', 'taxonomy', 'link-previews', 'publishing'])
  assert.throws(() => connectionPlan(['entries/posts/example.md']))
})
