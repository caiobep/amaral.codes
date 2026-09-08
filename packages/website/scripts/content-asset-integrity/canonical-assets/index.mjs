import path from 'node:path'
import { readMarkdownDocuments } from '../filesystem/index.mjs'
import { checkRemoteMaterial } from '../remote-assets/index.mjs'

export async function collectCanonicalAssetReferences(directory, formatPath = value => value) {
  const documents = await readMarkdownDocuments(directory, formatPath)
  return documents.flatMap(({ filePath, source }) => (
    extractCanonicalAssetReferences(source, filePath)
  ))
}

export function extractCanonicalAssetReferences(source, filePath) {
  const pattern = /https:\/\/assets\.amaral\.codes\/[^\s)"'<>]+/gu
  return [...source.matchAll(pattern)].map(([url]) => ({
    filePath,
    label: path.basename(new URL(url).pathname) || 'Canonical asset',
    url,
  }))
}

export async function auditCanonicalAssetReferences(references, options) {
  const checks = await Promise.all(references.map(reference => (
    checkRemoteMaterial(reference, options)
  )))
  return checks.filter(Boolean)
}
