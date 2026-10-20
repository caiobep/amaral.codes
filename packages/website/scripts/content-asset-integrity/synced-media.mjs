import fs from 'node:fs/promises'
import path from 'node:path'
import { listFiles } from './filesystem.mjs'

export const MAX_SYNCED_CANONICAL_MEDIA_BYTES = 1024 * 1024

const CANONICAL_MEDIA_EXTENSIONS = new Set(['.mov', '.mp4', '.pdf', '.webm'])

export async function collectSyncedCanonicalAssets(directory, formatPath = value => value) {
  const filePaths = await listFiles(directory)
  const canonicalPaths = filePaths.filter(filePath => (
    CANONICAL_MEDIA_EXTENSIONS.has(path.extname(filePath).toLowerCase())
  ))

  return Promise.all(canonicalPaths.map(async filePath => ({
    filePath: formatPath(filePath),
    size: (await fs.stat(filePath)).size,
  })))
}

export function findSyncedCanonicalAssetViolations(files) {
  return files
    .filter(file => CANONICAL_MEDIA_EXTENSIONS.has(path.extname(file.filePath).toLowerCase()))
    .filter(file => file.size > MAX_SYNCED_CANONICAL_MEDIA_BYTES)
    .sort((left, right) => left.filePath.localeCompare(right.filePath))
    .map(file => ({
      ...file,
      message: `canonical media is ${formatMiB(file.size)}; files over 1 MiB belong in object storage`,
    }))
}

function formatMiB(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`
}
