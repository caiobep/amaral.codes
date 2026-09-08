#!/usr/bin/env node

import { inspectContentAssets } from '../content-asset-hygiene/index.mjs'

const issues = await inspectContentAssets({
  contentRoots: [
    'packages/website/src/content/entries',
    'packages/website/src/content/projects',
    'packages/website/tests/fixtures/content/entries',
  ],
  publicRoot: 'packages/website/public',
})

if (issues.length > 0) {
  console.error('Content asset check failed:')
  issues.forEach(issue => console.error(formatIssue(issue)))
  process.exitCode = 1
} else {
  console.log('Content asset check passed.')
}

function formatIssue(issue) {
  if (issue.issue === 'unused') return `  unused: ${issue.file}`
  if (issue.issue === 'unsupported') {
    return `  unsupported local media: ${issue.url} (${issue.file})`
  }
  return `  missing: ${issue.url} (${issue.file})`
}
