#!/usr/bin/env node

import { fileURLToPath } from 'node:url'
import {
  STATIC_ASSET_BUDGETS,
  auditStaticAssets,
  collectStaticAssets,
  formatBytes,
} from '../static-asset-hygiene/index.mjs'

const PUBLIC_ROOT = fileURLToPath(new URL('../../public/', import.meta.url))
const files = await collectStaticAssets(PUBLIC_ROOT)
const audit = auditStaticAssets(files)

if (audit.violations.length > 0) {
  console.error('Static asset hygiene check failed:')
  audit.violations.forEach(({ message }) => console.error(`  ${message}`))
  reportDuplicateGroups(audit.duplicateGroups)
  process.exitCode = 1
} else {
  console.log([
    'Static asset hygiene check passed:',
    `${audit.fileCount} files`,
    `${formatBytes(audit.totalBytes)} total / ${formatBytes(STATIC_ASSET_BUDGETS.maxAggregateBytes)}`,
    `${formatBytes(audit.largestFileBytes)} largest / ${formatBytes(STATIC_ASSET_BUDGETS.maxFileBytes)}`,
    `${formatBytes(audit.duplicateBytes)} duplicated / ${formatBytes(STATIC_ASSET_BUDGETS.maxDuplicateBytes)}`,
  ].join(' '))
}

function reportDuplicateGroups(groups) {
  groups.forEach((group) => {
    console.error(`  duplicate group (${formatBytes(group.bytes)}): ${group.filePaths.join(', ')}`)
  })
}
