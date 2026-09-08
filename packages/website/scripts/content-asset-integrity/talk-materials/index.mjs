import yaml from 'js-yaml'
import { readMarkdownDocuments } from '../filesystem/index.mjs'
import {
  checkRemoteMaterial,
  resolveContainedPath,
  violation,
} from '../remote-assets/index.mjs'

export async function collectTalkMaterialReferences(directory, formatPath = value => value) {
  const documents = await readMarkdownDocuments(directory, formatPath)
  return documents.flatMap(({ filePath, source }) => (
    extractTalkMaterialReferences(source, filePath)
  ))
}

export function extractTalkMaterialReferences(source, filePath) {
  const frontmatter = readFrontmatter(source, filePath)
  const materials = frontmatter?.talk?.materials
  if (!Array.isArray(materials)) return []

  return materials.flatMap((material) => {
    if (!material || typeof material !== 'object' || typeof material.url !== 'string') return []
    return [{
      filePath,
      label: typeof material.label === 'string' ? material.label : 'Talk material',
      url: material.url,
    }]
  })
}

export async function auditTalkMaterialReferences(references, options) {
  const checks = await Promise.all(references.map(reference => (
    checkTalkMaterialReference(reference, options)
  )))
  return checks.filter(Boolean)
}

async function checkTalkMaterialReference(reference, options) {
  return reference.url.startsWith('/')
    ? checkLocalTalkMaterial(reference, options)
    : checkRemoteMaterial(reference, options)
}

async function checkLocalTalkMaterial(reference, options) {
  const localPath = resolveContainedPath(options.publicRoot, reference.url.slice(1))
  if (localPath && await options.fileExists(localPath)) return undefined
  return violation(reference, 'local material does not exist under the website public directory')
}

function readFrontmatter(source, filePath) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(source)
  if (!match?.[1]) throw new Error(`${filePath}: talk entry is missing YAML frontmatter`)
  const value = yaml.load(match[1])
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${filePath}: talk frontmatter must be an object`)
  }
  return value
}
