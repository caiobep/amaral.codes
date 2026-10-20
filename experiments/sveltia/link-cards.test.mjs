import assert from 'node:assert/strict'
import { test } from 'node:test'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import yaml from 'js-yaml'
import { parseLinkMetadata } from './link-metadata.mjs'
import { enrichLinkCards, fetchLinkCard, standaloneLinks } from './link-cards.mjs'

test('enrichment sees only standalone public links and excludes code, prose links, and private URLs', () => {
  const markdown = '[A](https://example.com/a)\n\nText [inline](https://example.com/b).\n\n```md\n[Code](https://example.com/c)\n```\n\n[Local](/posts/local)\n\n[Private](https://example.com/?token=secret)'
  assert.deepEqual([...standaloneLinks(markdown)], [['https://example.com/a', 'A']])
})

test('metadata parsing decodes entities, ignores hostile base tags, and bounds plain text', () => {
  const html = '<base href="https://127.0.0.1/"><meta property="og:title" content="A &amp; B"><meta name="description" content=" Useful   article "><meta property="og:image" content="/cover.png"><script>throw Error()</script>'
  assert.deepEqual(parseLinkMetadata(html, 'https://example.com/article'), { url: 'https://example.com/article', title: 'A & B', description: 'Useful article', imageUrl: 'https://example.com/cover.png' })
  assert.equal(parseLinkMetadata(`<title>${'x'.repeat(400)}</title>`, 'https://example.com').title.length, 180)
  assert.equal(parseLinkMetadata('<meta property="og:image" content="https://example.com/?token=secret">', 'https://example.com').imageUrl, undefined)
})

test('unavailable, timed out, oversized, or non-HTML sources preserve a usable text card', async () => {
  const url = 'https://example.com/article'
  for (const read of [async () => { throw Error('timeout') }, async () => { throw Error('Resource exceeds byte limit') }, async () => ({ body: Buffer.from('not HTML'), type: 'application/pdf' })]) {
    assert.deepEqual(await fetchLinkCard(url, 'Source', '/unused', read), { url, title: 'Source' })
  }
})

test('an invalid preview image does not discard useful article metadata', async () => {
  const card = await fetchLinkCard('https://example.com/article', 'Source', '/unused', async url => {
    if (url.endsWith('/image')) throw Error('private image redirect')
    return { body: Buffer.from('<meta property="og:title" content="Article title"><meta property="og:image" content="/image">'), type: 'text/html', url }
  })
  assert.deepEqual(card, { url: 'https://example.com/article', title: 'Article title' })
})

test('cached and authored cards enrich generated metadata without changing Markdown or fetching pinned targets', async t => {
  const repository = await fs.mkdtemp(path.join(os.tmpdir(), 'publishing-links-'))
  t.after(() => fs.rm(repository, { recursive: true, force: true }))
  await fs.mkdir(path.join(repository, 'publishing'), { recursive: true })
  const cached = { url: 'https://example.com/cached', title: 'Cached title' }
  const pinned = { url: 'https://127.0.0.1/pinned', title: 'Author-pinned title' }
  await fs.writeFile(path.join(repository, 'publishing/link-cards.json'), JSON.stringify({ [cached.url]: cached }))
  const body = `\n[Saved](${cached.url})\n\n[Pinned](${pinned.url})\n\n\`\`\`md\n[Code](https://example.com/ignore)\n\`\`\`\n`
  const raw = `---\ntitle: Example\nlinkCards:\n  - url: ${pinned.url}\n    title: ${pinned.title}\n---\n${body}`
  const entries = new Map([['example.md', raw]])
  await enrichLinkCards(entries, repository, path.join(repository, '.publishing/output/public'))
  const output = entries.get('example.md')
  const header = output.match(/^---\n([\s\S]*?)\n---\n/u)
  assert.equal(output.slice(header[0].length), body)
  await fs.access(path.join(repository, '.publishing/output/public/link-previews/index.json'))
  await assert.rejects(fs.access(path.join(repository, '.publishing/website')), { code: 'ENOENT' })
  assert.deepEqual(yaml.load(header[1]).linkCards, [cached, pinned])
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(repository, 'publishing/link-cards.json'), 'utf8')), { [cached.url]: cached })
})
