#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { inspectContentAssets } from '../../content-asset-hygiene/index.mjs'
import { findPresentationAssetViolations } from '../../presentation-asset-hygiene/index.mjs'
import { checkPublicDocument } from '../../public-content-privacy/index.mjs'
import { checkPublicMarkdownHtml } from '../../public-markdown-html/index.mjs'

const PUBLIC_ROOT = 'packages/website/public'
const CONTENT_ROOTS = [
  'packages/website/src/content/entries',
  'packages/website/src/content/projects',
]
const FIXTURE_ROOT = 'packages/website/tests/fixtures/content/entries'
const ALL_CONTENT_ROOTS = [...CONTENT_ROOTS, FIXTURE_ROOT]

for (const root of ALL_CONTENT_ROOTS) {
  for (const file of listFiles(root).filter(file => file.endsWith('.md'))) {
    const source = readFileSync(file, 'utf8')
    report(checkPublicDocument(file, source))
    if (root !== FIXTURE_ROOT) report(checkPublicMarkdownHtml(file, source))
  }
}

const assetIssues = await inspectContentAssets({
  contentRoots: ALL_CONTENT_ROOTS,
  publicRoot: PUBLIC_ROOT,
})
report(assetIssues.map(issue => ({ file: issue.file, reason: formatAssetIssue(issue) })))
report(findPresentationAssetViolations(getPresentationFiles()).map(violation => ({
  file: violation.filePath,
  reason: violation.reason,
})))

if (!process.exitCode) {
  console.log('Content checks passed: privacy, Markdown HTML, local assets, and presentation storage.')
}

function report(violations) {
  for (const { file, reason } of violations) {
    console.error(`  ${file}: ${reason}`)
    process.exitCode = 1
  }
}

function formatAssetIssue(issue) {
  if (issue.issue === 'unused') return 'unused image'
  if (issue.issue === 'unsupported') return `unsupported local media: ${issue.url}`
  return `missing asset: ${issue.url}`
}

function getPresentationFiles() {
  const output = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  const tracked = new Set(output.split('\0').filter(file => file && existsSync(file)))
  return [...new Set([...tracked, ...listFiles(PUBLIC_ROOT)])].map(filePath => ({
    filePath,
    size: statSync(filePath).size,
    tracked: tracked.has(filePath),
  }))
}

function listFiles(root) {
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter(entry => !entry.isDirectory())
    .map(entry => path.join(entry.parentPath, entry.name))
}
