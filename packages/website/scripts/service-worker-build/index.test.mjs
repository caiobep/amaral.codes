import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'vitest'
import { getBuildId, getOutputPath, injectManifest } from './index.mjs'

test('maps public URLs to generated files', () => {
  assert.equal(getOutputPath('/dist', '/'), path.join('/dist', 'index.html'))
  assert.equal(getOutputPath('/dist', '/posts'), path.join('/dist', 'posts/index.html'))
  assert.equal(getOutputPath('/dist', '/search-index.json'), path.join('/dist', 'search-index.json'))
})

test('changes the build id when route or data contents change', async ({ onTestFinished }) => {
  const dist = await fs.mkdtemp(path.join(os.tmpdir(), 'service-worker-build-'))
  onTestFinished(() => fs.rm(dist, { recursive: true, force: true }))
  await fs.mkdir(path.join(dist, 'posts'))
  await fs.writeFile(path.join(dist, 'index.html'), 'home-one')
  await fs.writeFile(path.join(dist, 'posts/index.html'), 'posts-one')

  const urls = ['/', '/posts']
  const first = await getBuildId(urls, dist)
  await fs.writeFile(path.join(dist, 'posts/index.html'), 'posts-two')
  const second = await getBuildId(urls, dist)

  assert.notEqual(first, second)
})

test('changes the build id when a generated article body changes', async ({ onTestFinished }) => {
  const dist = await fs.mkdtemp(path.join(os.tmpdir(), 'service-worker-build-'))
  onTestFinished(() => fs.rm(dist, { recursive: true, force: true }))
  const article = path.join(dist, 'posts/redacted-article/index.html')
  await fs.mkdir(path.dirname(article), { recursive: true })
  await fs.writeFile(path.join(dist, 'index.html'), 'home')
  await fs.writeFile(article, '<article>Private body</article>')

  const first = await getBuildId(['/'], dist, [article])
  await fs.writeFile(article, '<article>Redacted body</article>')
  const second = await getBuildId(['/'], dist, [article])

  assert.notEqual(first, second)
})

test('injects a complete deterministic manifest', () => {
  const template = 'id=BUILD_ID_PLACEHOLDER; urls=[/* PRECACHE_URLS_PLACEHOLDER */]'
  assert.equal(injectManifest(template, ['/', '/posts'], 'build-1'), 'id=build-1; urls=["/", "/posts"]')
})
