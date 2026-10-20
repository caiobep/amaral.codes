import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import yaml from 'js-yaml'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { entrySchema } from '../../packages/content-contract/src/metadata/index.ts'
import { checkPublicDocument } from '../../scripts/public-content-privacy/index.mjs'
import { categoryFolders } from './config.mjs'

export const hashBytes = bytes =>
  createHash('sha256').update(bytes).digest('hex')

export function readPublicEntry(filename, raw) {
  assert.equal(
    checkPublicDocument(filename, raw).length,
    0,
    'Private data in public archive',
  )
  const header = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u)
  assert(header, 'Missing Markdown frontmatter')
  const metadata = entrySchema.parse(yaml.load(header[1]))
  return { metadata, body: raw.slice(header[0].length), header: header[0] }
}

function imageNodes(node) {
  return [
    ...(node.type === 'image' ? [node] : []),
    ...(node.children ?? []).flatMap(imageNodes),
  ]
}

export function relocateImages(body) {
  let relocated = body
  const images = imageNodes(fromMarkdown(body)).filter(image =>
    image.url.startsWith('../images/'),
  )
  for (const image of images.toReversed()) {
    assert.match(image.url, /^\.\.\/images\/[a-z0-9_-]+\.(webp|png|jpg|jpeg)$/u)
    const start = image.position.start.offset
    const end = image.position.end.offset
    const source = body.slice(start, end)
    const offset = source.indexOf(`](${image.url}`)
    assert(offset >= 0, 'Unsupported archive image syntax')
    const urlStart = start + offset + 2
    relocated =
      relocated.slice(0, urlStart) +
      `/media/${path.basename(image.url)}` +
      relocated.slice(urlStart + image.url.length)
  }
  return { body: relocated, images: images.map(image => image.url) }
}

export async function collectArchive(sourceDirectory) {
  const documents = []
  const media = new Map()
  const slugs = new Set()
  for await (const filename of fs.glob(`${sourceDirectory}/**/*.md`)) {
    const raw = await fs.readFile(filename, 'utf8')
    const entry = readPublicEntry(filename, raw)
    const slug = path.basename(filename, '.md')
    assert(!slugs.has(slug), 'Duplicate public URL')
    slugs.add(slug)
    const relocated = relocateImages(entry.body)
    for (const image of relocated.images) {
      const bytes = await fs.readFile(
        path.resolve(path.dirname(filename), image),
      )
      const destination = `media/${path.basename(image)}`
      const hash = hashBytes(bytes)
      assert(
        !media.has(destination) || media.get(destination).hash === hash,
        'Conflicting media filename',
      )
      media.set(destination, { bytes, hash })
    }
    documents.push({
      path: `entries/${categoryFolders[entry.metadata.category]}/${slug}.md`,
      slug,
      metadata: entry.metadata,
      raw: entry.header + relocated.body,
      sourceHash: hashBytes(raw),
      bodyHash: hashBytes(relocated.body),
    })
  }
  return {
    documents: documents.sort((a, b) => a.path.localeCompare(b.path)),
    media,
  }
}

export async function writeArchive(directory, archive) {
  const files = [
    ...archive.documents.map(document => [document.path, document.raw]),
    ...[...archive.media].map(([filename, media]) => [filename, media.bytes]),
  ]
  for (const [filename, bytes] of files) {
    const destination = path.join(directory, filename)
    await fs.mkdir(path.dirname(destination), { recursive: true })
    await fs.writeFile(destination, bytes, { flag: 'wx', mode: 0o600 })
  }
  return files.map(([filename]) => filename)
}
