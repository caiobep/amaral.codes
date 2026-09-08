#!/usr/bin/env node

import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { checkPublicMarkdownHtml } from '../public-markdown-html/index.mjs'

const CONTENT_ROOTS = [
  'packages/website/src/content/entries',
  'packages/website/src/content/projects',
]

const violations = CONTENT_ROOTS.flatMap(root =>
  getMarkdownFiles(root).flatMap(file =>
    checkPublicMarkdownHtml(file, readFileSync(file, 'utf8')),
  ),
)

if (violations.length > 0) {
  console.error('Public Markdown HTML policy check failed:')
  violations.forEach(({ file, reason }) => console.error(`  ${file}: ${reason}`))
  process.exitCode = 1
} else {
  console.log('Public Markdown HTML policy check passed.')
}

function getMarkdownFiles(root) {
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.md'))
    .map(entry => path.join(entry.parentPath, entry.name))
}
