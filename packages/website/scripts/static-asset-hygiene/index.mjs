import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

const KIBIBYTE = 1024
const MEBIBYTE = 1024 * KIBIBYTE

export const STATIC_ASSET_BUDGETS = Object.freeze({
  maxAggregateBytes: 6 * MEBIBYTE,
  maxFileBytes: MEBIBYTE,
  maxDuplicateBytes: 64 * KIBIBYTE,
})

export async function collectStaticAssets(directory) {
  const filePaths = await listFiles(directory)
  return Promise.all(filePaths.map(async (filePath) => {
    const contents = await fs.readFile(filePath)
    return {
      filePath: path.relative(directory, filePath).split(path.sep).join('/'),
      size: contents.byteLength,
      digest: createHash('sha256').update(contents).digest('hex'),
    }
  }))
}

export function auditStaticAssets(files, budgets = STATIC_ASSET_BUDGETS) {
  const totalBytes = files.reduce((total, file) => total + file.size, 0)
  const oversizedFiles = files
    .filter(file => file.size > budgets.maxFileBytes)
    .sort((left, right) => right.size - left.size)
  const duplicateGroups = findDuplicateGroups(files)
  const duplicateBytes = duplicateGroups.reduce((total, group) => total + group.bytes, 0)
  const metrics = {
    fileCount: files.length,
    totalBytes,
    largestFileBytes: Math.max(0, ...files.map(file => file.size)),
    duplicateBytes,
    duplicateGroups,
    oversizedFiles,
  }

  return {
    ...metrics,
    violations: findBudgetViolations(metrics, budgets),
  }
}

export function formatBytes(bytes) {
  if (bytes >= MEBIBYTE) return `${(bytes / MEBIBYTE).toFixed(2)} MiB`
  if (bytes >= KIBIBYTE) return `${(bytes / KIBIBYTE).toFixed(2)} KiB`
  return `${bytes} B`
}

async function listFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const nestedPaths = await Promise.all(entries.map((entry) => {
    const target = path.join(directory, entry.name)
    return entry.isDirectory() ? listFiles(target) : [target]
  }))
  return nestedPaths.flat()
}

function findDuplicateGroups(files) {
  const filesByDigest = new Map()
  files.forEach((file) => {
    const group = filesByDigest.get(file.digest) ?? []
    group.push(file)
    filesByDigest.set(file.digest, group)
  })

  return [...filesByDigest.values()]
    .filter(group => group.length > 1)
    .map(group => ({
      bytes: group[0].size * (group.length - 1),
      filePaths: group.map(file => file.filePath).sort(),
    }))
    .sort((left, right) => right.bytes - left.bytes)
}

function findBudgetViolations(metrics, budgets) {
  const violations = metrics.oversizedFiles.map(file => ({
    kind: 'file',
    message: `${file.filePath} is ${formatBytes(file.size)}; limit is ${formatBytes(budgets.maxFileBytes)}`,
  }))

  if (metrics.totalBytes > budgets.maxAggregateBytes) {
    violations.unshift({
      kind: 'aggregate',
      message: `public assets total ${formatBytes(metrics.totalBytes)}; limit is ${formatBytes(budgets.maxAggregateBytes)}`,
    })
  }

  if (metrics.duplicateBytes > budgets.maxDuplicateBytes) {
    violations.push({
      kind: 'duplicate',
      message: `duplicate copies use ${formatBytes(metrics.duplicateBytes)}; limit is ${formatBytes(budgets.maxDuplicateBytes)}`,
    })
  }

  return violations
}
