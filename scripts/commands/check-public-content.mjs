#!/usr/bin/env node

import { checkPublicContentRoots } from '../public-content-privacy/index.mjs'

const violations = checkPublicContentRoots([
  'packages/website/src/content/entries',
  'packages/website/src/content/projects',
  'packages/website/tests/fixtures/content/entries',
])

if (violations.length > 0) {
  console.error('Public content privacy check failed:')
  violations.forEach(({ file, reason }) => console.error(`  ${file}: ${reason}`))
  process.exitCode = 1
} else {
  console.log('Public content privacy check passed.')
}
