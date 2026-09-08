#!/usr/bin/env node

import fs from 'node:fs/promises'

const GENERATED_PATHS = [
  '.astro',
  'test-results',
  'tmp',
  'packages/content-sync/coverage',
  'packages/content-sync/dist',
  'packages/content-contract/coverage',
  'packages/website/.astro',
  'packages/website/.performance',
  'packages/website/.performance-desktop',
  'packages/website/coverage',
  'packages/website/dist',
  'packages/website/node_modules/.astro',
  'packages/website/playwright-report',
  'packages/website/src/content/entries/synced',
  'packages/website/src/content/projects/.publication-snapshots',
  'packages/website/src/content/projects/.synced.backup',
  'packages/website/src/content/projects/.synced.staging',
  'packages/website/src/content/projects/synced',
  'packages/website/test-results',
]

await Promise.all(GENERATED_PATHS.map(filePath => fs.rm(filePath, {
  force: true,
  recursive: true,
})))

console.log('Removed generated build, test, coverage, and performance output.')
