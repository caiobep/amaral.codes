#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { findPresentationAssetViolations } from '../presentation-asset-hygiene/index.mjs'

const PUBLIC_ROOT = 'packages/website/public'
const files = await getFilesToCheck()
const violations = findPresentationAssetViolations(files)

if (violations.length > 0) {
  console.error('Presentation asset hygiene check failed:')
  violations.forEach(({ filePath, reason }) => console.error(`  ${filePath}: ${reason}`))
  process.exitCode = 1
} else {
  console.log('Presentation asset hygiene check passed.')
}

async function getFilesToCheck() {
  const trackedPaths = getTrackedPaths()
  const deployablePaths = await listFiles(PUBLIC_ROOT)
  const paths = new Set([...trackedPaths, ...deployablePaths])

  return Promise.all([...paths].map(async (filePath) => ({
    filePath,
    size: (await fs.stat(filePath)).size,
    tracked: trackedPaths.has(filePath),
  })))
}

function getTrackedPaths() {
  const output = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  return new Set(output.split('\0').filter(filePath => filePath && existsSync(filePath)))
}

async function listFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map((entry) => {
    const target = path.join(directory, entry.name)
    return entry.isDirectory() ? listFiles(target) : [target]
  }))
  return nested.flat()
}
