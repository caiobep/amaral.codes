import { readFileSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const POLICY_URL = new URL('../../publication-policy.json', import.meta.url)
const POLICY = JSON.parse(readFileSync(POLICY_URL, 'utf8'))
const COLLECTIONS = Object.entries(POLICY.collections).map(([name, collection]) => ({
  baselineDocuments: collection.expectedDocuments,
  label: collection.label,
  name,
  root: collection.snapshotPath,
}))
const OVERRIDE_ENVIRONMENT_KEY = 'PUBLICATION_ALLOW_LARGE_DROP'

const GENERATED_ROOTS = [
  'packages/website/src/content/entries/synced',
  'packages/website/src/content/projects/synced',
]

export async function inspectPublicationSnapshot(repositoryRoot) {
  return Promise.all(COLLECTIONS.map(async collection => ({
    ...collection,
    markdownFiles: await countMarkdownFiles(
      path.join(repositoryRoot, collection.root),
    ),
    minimumDocuments: requiredDocumentCount(collection),
  })))
}

export function isGeneratedPublicationPath(filePath) {
  const normalizedPath = filePath.split(path.sep).join('/')
  return GENERATED_ROOTS.some(root => (
    normalizedPath === root || normalizedPath.startsWith(`${root}/`)
  ))
}

export async function verifyPublicationSnapshot(repositoryRoot, options = {}) {
  const collections = await inspectPublicationSnapshot(repositoryRoot)
  const empty = collections.filter(collection => collection.markdownFiles === 0)
  if (empty.length > 0) {
    throw new Error([
      'Publication snapshot cannot contain empty collections:',
      ...empty.map(collection => `  ${collection.label}: ${collection.root}`),
    ].join('\n'))
  }

  const incomplete = collections.filter(collection => (
    collection.markdownFiles < collection.minimumDocuments
  ))
  if (incomplete.length > 0 && !options.allowLargeReduction) {
    throw new Error([
      'Publication snapshot is below its safety baseline:',
      ...incomplete.map(collection => [
        `  ${collection.label}: ${String(collection.markdownFiles)} documents`,
        `(minimum ${String(collection.minimumDocuments)}; ${collection.root})`,
      ].join(' ')),
      `Set ${OVERRIDE_ENVIRONMENT_KEY}=1 only for an intentional reduction.`,
    ].join('\n'))
  }
  return collections
}

function requiredDocumentCount(collection) {
  return Math.ceil(collection.baselineDocuments * (1 - POLICY.maximumDropRatio))
}

async function countMarkdownFiles(directory) {
  try {
    const entries = await readdir(directory, { recursive: true, withFileTypes: true })
    return entries.filter(entry => entry.isFile() && entry.name.endsWith('.md')).length
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return 0
    }
    throw error
  }
}

async function run() {
  try {
    const collections = await verifyPublicationSnapshot(process.cwd(), {
      allowLargeReduction: process.env[OVERRIDE_ENVIRONMENT_KEY] === '1',
    })
    const summary = collections
      .map(collection => `${collection.label}: ${String(collection.markdownFiles)}`)
      .join(', ')
    console.log(`Publication snapshot verified (${summary}).`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}

const currentFile = fileURLToPath(import.meta.url)
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) await run()
