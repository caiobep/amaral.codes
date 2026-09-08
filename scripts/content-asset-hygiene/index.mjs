import fs from 'node:fs/promises'
import path from 'node:path'

const IMAGE_EXTENSIONS = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.svg', '.webp'])
const ASSET_EXTENSION = '(?:avif|gif|jpe?g|key|m4a|mov|mp3|mp4|pdf|png|pptx|svg|usdz|webm|webp)'
const PUBLIC_ASSET_PATTERN = new RegExp(
  `(?<=["'(])/(?!/)[^\\s"'()?#]+\\.${ASSET_EXTENSION}`,
  'giu',
)
const RELATIVE_ASSET_PATTERN = new RegExp(
  `(?<=["'(])\\.\\.?/[^\\s"'()?#]+\\.${ASSET_EXTENSION}`,
  'giu',
)

export async function inspectContentAssets({ contentRoots, publicRoot }) {
  const files = (await Promise.all(contentRoots.map(listFiles))).flat()
  const documents = await readMarkdownDocuments(files)
  const references = documents.flatMap(getAssetReferences)
  const unsupported = references
    .filter(reference => reference.kind === 'relative')
    .filter(reference => !isImage(reference.url))
    .map(reference => ({ ...reference, issue: 'unsupported' }))
  const missing = await findMissingAssets(
    references.filter(reference => reference.kind === 'public' || isImage(reference.url)),
    publicRoot,
  )
  const referencedFiles = new Set(
    references
      .filter(reference => reference.kind === 'relative')
      .map(reference => resolveAssetPath(reference, publicRoot)),
  )
  const unused = files
    .filter(file => path.basename(path.dirname(file)) === 'images')
    .filter(isImage)
    .filter(file => !referencedFiles.has(path.resolve(file)))
    .map(file => ({ file, issue: 'unused' }))

  return [...unused, ...missing, ...unsupported]
}

async function readMarkdownDocuments(files) {
  return await Promise.all(
    files
      .filter(file => file.endsWith('.md'))
      .map(async file => ({ file, source: await fs.readFile(file, 'utf8') })),
  )
}

function getAssetReferences({ file, source }) {
  const renderedSource = source.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/gu, '')
  return [
    ...matchReferences(file, renderedSource, PUBLIC_ASSET_PATTERN, 'public'),
    ...matchReferences(file, renderedSource, RELATIVE_ASSET_PATTERN, 'relative'),
  ]
}

function matchReferences(file, source, pattern, kind) {
  return [...source.matchAll(pattern)].map(match => ({
    file,
    kind,
    url: match[0],
  }))
}

async function findMissingAssets(references, publicRoot) {
  const checks = await Promise.all(references.map(async reference => ({
    ...reference,
    exists: await fileExists(resolveAssetPath(reference, publicRoot)),
  })))
  return checks
    .filter(({ exists }) => !exists)
    .map(({ file, kind, url }) => ({ file, kind, url, issue: 'missing' }))
}

function resolveAssetPath(reference, publicRoot) {
  return reference.kind === 'public'
    ? path.resolve(publicRoot, reference.url.slice(1))
    : path.resolve(path.dirname(reference.file), reference.url)
}

function isImage(file) {
  return IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase())
}

async function fileExists(file) {
  try {
    await fs.access(file)
    return true
  } catch {
    return false
  }
}

async function listFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(entry => {
    const target = path.join(directory, entry.name)
    return entry.isDirectory() ? listFiles(target) : [target]
  }))
  return nested.flat()
}
