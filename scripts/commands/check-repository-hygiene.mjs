#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { isGeneratedPublicationPath } from '../publication-snapshot/index.mjs'

const ALLOWED_ROOT_DIRECTORIES = new Set(['.github', 'experiments', 'packages', 'scripts'])
const ALLOWED_ROOT_FILES = new Set([
  '.gitignore',
  '.prettierrc',
  'AGENTS.md',
  'ARCHITECTURE.md',
  'LICENSE',
  'README.md',
  'eslint.config.mjs',
  'package-lock.json',
  'package.json',
  'publication-policy.json',
  'tsconfig.json',
  'vercel.json',
])
const GENERATED_SEGMENTS = new Set([
  '.next',
  '.local',
  '.astro',
  '.idea',
  '.performance',
  '.performance-desktop',
  '.publication-snapshots',
  '.synced.backup',
  '.synced.staging',
  '.vercel',
  '.wrangler',
  'coverage',
  'dist',
  'node_modules',
  'playwright-report',
  'test-results',
])
const FORBIDDEN_FILES = new Set(['.DS_Store', 'design-qa.md'])

function getRepositoryFiles() {
  const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  const untracked = execFileSync(
    'git',
    ['ls-files', '--others', '--exclude-standard', '-z'],
    { encoding: 'utf8' },
  )
  return `${tracked}${untracked}`
    .split('\0')
    .filter(filePath => filePath && existsSync(filePath))
}

function hasGeneratedSegment(filePath) {
  return filePath.split('/').some(segment => GENERATED_SEGMENTS.has(segment))
}

function isAllowedAtRoot(filePath) {
  const [rootEntry, ...rest] = filePath.split('/')
  if (rest.length === 0) return ALLOWED_ROOT_FILES.has(rootEntry)
  return ALLOWED_ROOT_DIRECTORIES.has(rootEntry)
}

const violations = getRepositoryFiles().filter(filePath => {
  const basename = path.posix.basename(filePath)
  return FORBIDDEN_FILES.has(basename)
    || hasGeneratedSegment(filePath)
    || isGeneratedPublicationPath(filePath)
    || !isAllowedAtRoot(filePath)
})

if (violations.length > 0) {
  console.error('Repository hygiene check failed. Move or untrack these paths:')
  violations.forEach(filePath => console.error(`  ${filePath}`))
  process.exitCode = 1
} else {
  console.log('Repository hygiene check passed.')
}
