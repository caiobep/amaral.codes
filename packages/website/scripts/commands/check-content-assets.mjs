#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  auditCanonicalAssetReferences,
  auditTalkMaterialReferences,
  collectCanonicalAssetReferences,
  collectSyncedCanonicalAssets,
  collectTalkMaterialReferences,
  findSyncedCanonicalAssetViolations,
} from '../content-asset-integrity/index.mjs'

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../../', import.meta.url))
const SYNCED_ROOT = fileURLToPath(new URL('../../src/content/entries/synced/', import.meta.url))
const PUBLIC_ROOT = fileURLToPath(new URL('../../public/', import.meta.url))
const STAGING_ROOT = path.join(REPOSITORY_ROOT, '.local/presentation-canonical-assets')
const CANONICAL_STAGING_ROOT = path.join(REPOSITORY_ROOT, '.local/canonical-assets')
const TALK_ROOT = fileURLToPath(new URL('../../src/content/entries/talks/', import.meta.url))
const verifyRemoteMaterials = process.argv.includes('--remote')
const formatPath = filePath => path.relative(REPOSITORY_ROOT, filePath).split(path.sep).join('/')
const fileExists = async (filePath) => {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

const syncedAssets = await collectSyncedCanonicalAssets(SYNCED_ROOT, formatPath)
const talkReferences = verifyRemoteMaterials
  ? await collectTalkMaterialReferences(TALK_ROOT, formatPath)
  : []
const canonicalReferences = verifyRemoteMaterials
  ? await collectCanonicalAssetReferences(SYNCED_ROOT, formatPath)
  : []
const syncedViolations = findSyncedCanonicalAssetViolations(syncedAssets)
const talkViolations = await auditTalkMaterialReferences(talkReferences, {
  fetcher: fetch,
  fileExists,
  formatPath,
  publicRoot: PUBLIC_ROOT,
  stagingRoot: STAGING_ROOT,
})
const canonicalViolations = await auditCanonicalAssetReferences(canonicalReferences, {
  fetcher: fetch,
  fileExists,
  formatPath,
  stagingRoot: CANONICAL_STAGING_ROOT,
})

if (syncedViolations.length > 0 || talkViolations.length > 0 || canonicalViolations.length > 0) {
  console.error('Content asset release check failed:')
  syncedViolations.forEach(({ filePath, message }) => (
    console.error(`  ${filePath}: ${message}`)
  ))
  talkViolations.forEach(({ filePath, label, message, url }) => (
    console.error(`  ${filePath}: ${label} (${url}): ${message}`)
  ))
  canonicalViolations.forEach(({ filePath, label, message, url }) => (
    console.error(`  ${filePath}: ${label} (${url}): ${message}`)
  ))
  process.exitCode = 1
} else {
  const remoteSummary = verifyRemoteMaterials
    ? `; ${String(talkReferences.length)} talk materials and ${String(canonicalReferences.length)} article assets are reachable`
    : ''
  console.log(`Content asset integrity check passed${remoteSummary}.`)
}
