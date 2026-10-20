import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fromMarkdown } from 'mdast-util-from-markdown'
import sharp from 'sharp'
import yaml from 'js-yaml'
import { linkCardSchema } from '../../packages/content-contract/src/metadata/sharing.ts'
import { isPublicHttpsUrl } from '../../packages/content-contract/src/public-url/index.ts'
import { readPublicResource } from './public-fetch.mjs'
import { parseLinkMetadata } from './link-metadata.mjs'

export function standaloneLinks(markdown) {
  const links = new Map()
  function visit(node) {
    if (node.type === 'paragraph' && node.children.length === 1 && node.children[0].type === 'link') {
      const link = node.children[0]
      if (isPublicHttpsUrl(link.url)) links.set(link.url, link.children.map(child => child.value ?? '').join(''))
    }
    for (const child of node.children ?? []) visit(child)
  }
  visit(fromMarkdown(markdown))
  return links
}

async function localImage(url, publicRoot, read) {
  const result = await read(url, { accept: 'image/jpeg,image/png,image/webp,image/avif', maxBytes: 5 * 1024 * 1024 })
  if (!/^image\/(?:jpeg|png|webp|avif)(?:;|$)/iu.test(result.type)) throw new Error('Unsupported preview image type')
  const image = await sharp(result.body, { limitInputPixels: 16_000_000, animated: false })
    .rotate().resize(640, 360, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer()
  const name = createHash('sha256').update(image).digest('hex').slice(0, 24) + '.webp'
  await fs.writeFile(path.join(publicRoot, 'link-previews', name), image)
  return `/link-previews/${name}`
}

export async function fetchLinkCard(url, label, publicRoot, read = readPublicResource) {
  const fallback = { url, title: label.slice(0, 180) || new URL(url).hostname }
  try {
    const result = await read(url, { accept: 'text/html,application/xhtml+xml', maxBytes: 512 * 1024 })
    if (!/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/iu.test(result.type)) return fallback
    const parsed = parseLinkMetadata(result.body.toString('utf8'), result.url)
    const card = { ...fallback, title: parsed.title || fallback.title }
    if (parsed.description) card.description = parsed.description
    if (parsed.imageUrl) {
      try {
        card.image = await localImage(parsed.imageUrl, publicRoot, read)
        card.imageAlt = card.title
      } catch { console.warn(`Link image unavailable: ${new URL(url).hostname}`) }
    }
    return linkCardSchema.parse(card)
  } catch {
    console.warn(`Link metadata unavailable: ${new URL(url).hostname}`)
    return fallback
  }
}

async function savedCards(filename) {
  try {
    const cards = JSON.parse(await fs.readFile(filename, 'utf8'))
    return Object.fromEntries(Object.entries(cards).map(([url, card]) => [url, linkCardSchema.parse(card)]))
  } catch (error) {
    if (error.code === 'ENOENT') return {}
    throw error
  }
}

export async function enrichLinkCards(entries, repository, publicRoot) {
  await fs.mkdir(path.join(publicRoot, 'link-previews'), { recursive: true })
  const cacheFile = path.join(repository, 'publishing/link-cards.json')
  const cache = await savedCards(cacheFile)
  const links = new Map()
  const documents = []
  for (const [filename, raw] of entries) {
    const header = raw.match(/^---\n([\s\S]*?)\n---\n/u)
    const metadata = yaml.load(header[1], { schema: yaml.JSON_SCHEMA })
    const body = raw.slice(header[0].length)
    const selected = standaloneLinks(body)
    const pinned = new Set((metadata.linkCards ?? []).map(card => card.url))
    for (const [url, label] of selected) if (!pinned.has(url)) links.set(url, label)
    documents.push({ filename, metadata, body, selected })
  }
  const pending = [...links].filter(([url]) => !Object.hasOwn(cache, url))
  for (let index = 0; index < pending.length; index += 3) {
    await Promise.all(pending.slice(index, index + 3).map(async ([url, label], offset) => {
      cache[url] = index + offset < 12
        ? await fetchLinkCard(url, label, publicRoot)
        : { url, title: label.slice(0, 180) || new URL(url).hostname }
    }))
  }
  for (const { filename, metadata, body, selected } of documents) {
    const overrides = new Map((metadata.linkCards ?? []).map(card => [card.url, card]))
    const cards = [...selected.keys()].map(url => overrides.get(url) ?? cache[url])
    if (cards.length) metadata.linkCards = cards
    entries.set(filename, `---\n${yaml.dump(metadata, { lineWidth: -1, noRefs: true })}---\n${body}`)
  }
  await fs.mkdir(path.dirname(cacheFile), { recursive: true })
  await fs.writeFile(cacheFile, JSON.stringify(cache, null, 2) + '\n')
  await fs.writeFile(path.join(publicRoot, 'link-previews/index.json'), JSON.stringify(cache) + '\n')
}
