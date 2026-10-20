import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import sharp from 'sharp'
import yaml from 'js-yaml'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { sharingArtwork, createSharingArtwork } from './editor/sharing-artwork.mjs'
import { generateSocialCards, renderSocialCard } from './social-cards.mjs'

const fonts = path.resolve('experiments/sveltia/fonts')
const entry = { title: 'Hash Maps vs Objects', date: '2022-05-31', category: 'note', summary: 'A JavaScript note.' }

test('the live artwork uses the article identity and escapes text instead of repeating a generic banner', () => {
  const data = { ...entry, sharing: { title: '<script>Shared & personal</script>', description: 'A different description.' } }
  const artwork = sharingArtwork(data)
  assert.equal(artwork.title, data.sharing.title)
  assert.equal(artwork.summary, data.sharing.description)
  const html = renderToStaticMarkup(React.createElement(createSharingArtwork(React), { data }))
  assert(html.includes('&lt;script&gt;Shared &amp; personal&lt;/script&gt;'))
  assert(html.includes('note / May 31, 2022'))
  assert(!html.includes('article-default.jpg'))
  assert(!html.includes('<script>'))
})

test('each article produces a distinct 1200×630 raster with bounded long titles', async () => {
  const first = await renderSocialCard(entry, fonts)
  const second = await renderSocialCard({ ...entry, title: 'W'.repeat(180), summary: 'W'.repeat(155) }, fonts)
  assert(!first.equals(second))
  for (const image of [first, second]) {
    const metadata = await sharp(image).metadata()
    assert.equal(metadata.width, 1200)
    assert.equal(metadata.height, 630)
    assert.equal(metadata.format, 'png')
    assert.equal(metadata.exif, undefined)
  }
  const gap = await sharp(second).extract({ left: 72, top: 537, width: 1056, height: 20 }).toBuffer()
  const footerGap = await sharp(gap).stats()
  assert(footerGap.channels.every(channel => channel.min === 255))
})

test('generation preserves source bodies and authored images while assigning real local sharing files', async t => {
  const website = await fs.mkdtemp(path.join(os.tmpdir(), 'sharing-artwork-'))
  t.after(() => fs.rm(website, { recursive: true, force: true }))
  await fs.cp(fonts, path.join(website, 'scripts/social-cards/fonts'), { recursive: true })
  const body = '\nOriginal Markdown.\n\n```ts\nconst untouched = true\n```\n'
  const raw = `---\n${yaml.dump(entry)}---\n${body}`
  const custom = `---\n${yaml.dump({ ...entry, sharing: { image: '/media/cover.webp', imageAlt: 'My cover' } })}---\n${body}`
  const entries = new Map([['entries/notes/example.md', raw], ['entries/notes/custom.md', custom]])
  await generateSocialCards(entries, website)
  assert.equal(entries.get('entries/notes/custom.md'), custom)
  const output = entries.get('entries/notes/example.md')
  const header = output.match(/^---\n([\s\S]*?)\n---\n/u)
  assert.equal(output.slice(header[0].length), body)
  const metadata = yaml.load(header[1])
  assert.match(metadata.sharing.image, /^\/social\/posts\/example-[a-f0-9]+\.png$/u)
  assert.equal(metadata.sharing.imageAlt, 'Hash Maps vs Objects — Caio Amaral')
  await fs.access(path.join(website, 'public', metadata.sharing.image))
})
