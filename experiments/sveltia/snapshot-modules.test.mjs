import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { copyPublishingModule } from './snapshot-modules.mjs'

test('every prepared publishing module resolves shared imports inside its snapshot', async t => {
  const target = await fs.mkdtemp(path.join(os.tmpdir(), 'publishing-modules-'))
  t.after(() => fs.rm(target, { recursive: true, force: true }))
  for (const name of ['build.mjs', 'link-cards.mjs', 'public-fetch.mjs', 'link-metadata.mjs']) {
    await copyPublishingModule(name, target)
    const source = await fs.readFile(path.join(target, name), 'utf8')
    assert.doesNotMatch(source, /\.\.\/\.\.\/(?:packages|scripts)\//u)
    assert.match(source, /from ['"]\.\/content-contract\//u)
  }
  await copyPublishingModule('social-cards.mjs', target)
  const cards = await fs.readFile(path.join(target, 'social-cards.mjs'), 'utf8')
  assert(cards.includes('./website/src/features/publishing/sharing-artwork.mjs'))
  assert(!cards.includes('./editor/sharing-artwork.mjs'))
})
