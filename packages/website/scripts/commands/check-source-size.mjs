#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const MAX_LINES = 500
const SOURCE_ROOTS = ['src', 'scripts', 'public']
const SOURCE_EXTENSIONS = new Set(['.astro', '.css', '.js', '.mjs', '.ts', '.tsx'])

function collectFiles(directory) {
  if (!fs.existsSync(directory)) return []

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return collectFiles(entryPath)
    return SOURCE_EXTENSIONS.has(path.extname(entry.name)) ? [entryPath] : []
  })
}

function countLines(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  return content === '' ? 0 : content.split(/\r?\n/).length
}

const oversizedFiles = SOURCE_ROOTS
  .flatMap(collectFiles)
  .map((filePath) => ({ filePath, lines: countLines(filePath) }))
  .filter(({ lines }) => lines > MAX_LINES)
  .sort((left, right) => right.lines - left.lines)

if (oversizedFiles.length > 0) {
  console.error(`Source files must not exceed ${MAX_LINES} lines:`)
  oversizedFiles.forEach(({ filePath, lines }) => console.error(`  ${lines}  ${filePath}`))
  process.exitCode = 1
} else {
  console.log(`Source-size gate passed: every authored file is at most ${MAX_LINES} lines.`)
}
