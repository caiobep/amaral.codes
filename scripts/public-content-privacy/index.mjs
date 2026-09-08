import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'

const PRIVATE_FIELDS = ['id', 'tagIds', 'tags', 'readTime', 'status']

const DOCUMENT_RULES = [
  {
    pattern: /https:\/\/(?:(?:www\.)?notion\.so|[\w-]+\.notion\.site|app\.notion\.com)\//i,
    reason: 'Notion URL',
  },
  {
    pattern: /secure\.notion-static\.com|prod-files-secure/i,
    reason: 'signed Notion asset URL',
  },
  {
    pattern: /https:\/\/[^/\s<>"'()[\]]+@/i,
    reason: 'credential-bearing URL',
  },
  {
    pattern: /[?&](?:access[-_]?token|api[-_]?key|auth(?:orization)?|client[-_]?secret|credential|googleaccessid|jwt|key[-_]?pair[-_]?id|password|policy|secret|security[-_]?token|sig|signature|token|x-amz-[\w-]+|x-goog-[\w-]+)=/i,
    reason: 'signed or credential-bearing URL',
  },
]

export function checkPublicDocument(file, document) {
  const frontmatter = document.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? ''
  const inspectionValue = decodeForInspection(document)

  return deduplicateViolations([
    ...inspectFrontmatter(file, frontmatter),
    ...findViolations(file, document, DOCUMENT_RULES),
    ...findViolations(file, inspectionValue, DOCUMENT_RULES),
  ])
}

function inspectFrontmatter(file, source) {
  const metadata = yaml.load(source)
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return []

  const violations = []
  if (PRIVATE_FIELDS.some(field => Object.hasOwn(metadata, field))) {
    violations.push({ file, reason: 'private workflow metadata' })
  }
  if (Object.values(metadata).includes('undefined')) {
    violations.push({ file, reason: 'literal undefined value' })
  }

  return violations
}

export function checkPublicContentRoots(roots) {
  return roots.flatMap(root =>
    getMarkdownFiles(root).flatMap(file =>
      checkPublicDocument(file, readFileSync(file, 'utf8')),
    ),
  )
}

function getMarkdownFiles(root) {
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
    .map(entry => path.join(entry.parentPath, entry.name))
}

function decodeForInspection(value) {
  let decoded = value.replaceAll('&amp;', '&')
  for (let pass = 0; pass < 3; pass += 1) {
    const next = decoded.replace(/%([\da-f]{2})/gi, (_match, hex) =>
      String.fromCharCode(Number.parseInt(hex, 16)),
    )
    if (next === decoded) return decoded
    decoded = next
  }
  return decoded
}

function findViolations(file, value, rules) {
  return rules.flatMap(({ pattern, reason }) =>
    pattern.test(value) ? [{ file, reason }] : [],
  )
}

function deduplicateViolations(violations) {
  return violations.filter((violation, index) =>
    violations.findIndex(candidate => candidate.reason === violation.reason) === index,
  )
}
