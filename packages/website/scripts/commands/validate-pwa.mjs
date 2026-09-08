#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getOutputPath } from '../service-worker-build/index.mjs'

const PACKAGE_DIRECTORY = fileURLToPath(new URL('../..', import.meta.url))
const DIST_DIRECTORY = path.join(PACKAGE_DIRECTORY, 'dist')
const MANIFEST_PATH = path.join(DIST_DIRECTORY, 'manifest.webmanifest')
const SERVICE_WORKER_PATH = path.join(DIST_DIRECTORY, 'service-worker.js')

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

const assertTargetsExist = async (targets, label) => {
  const results = await Promise.all(targets.map(async (target) => {
    try {
      await fs.access(getOutputPath(DIST_DIRECTORY, target))
      return true
    } catch {
      return false
    }
  }))
  assert(results.every(Boolean), `${label} must point to generated files.`)
}

const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf8'))
const serviceWorker = await fs.readFile(SERVICE_WORKER_PATH, 'utf8')
const iconTargets = manifest.icons.map((icon) => icon.src)
const shortcutTargets = manifest.shortcuts.map((shortcut) => shortcut.url)
const shortcutPaths = shortcutTargets.map(target => new URL(target, 'https://amaral.codes').pathname)

assert(manifest.id === '/', 'The manifest must have a stable root id.')
assert(manifest.display === 'standalone', 'The manifest must use standalone display mode.')
assert(manifest.icons.some((icon) => icon.purpose === 'maskable'), 'The manifest must include a maskable icon.')
assert(manifest.shortcuts.length >= 3, 'The manifest must expose at least three shortcuts.')
assert(!serviceWorker.includes('PLACEHOLDER'), 'The generated service worker contains unresolved placeholders.')
assert(serviceWorker.includes("url.pathname === '/search-index.json'"), 'Search data must be served by the offline cache.')
assert(
  shortcutPaths.every(target => serviceWorker.includes(JSON.stringify(target))),
  'Manifest shortcuts must resolve through a precached route when offline.',
)
await assertTargetsExist(iconTargets, 'Manifest icons')
await assertTargetsExist(shortcutTargets, 'Manifest shortcuts')
await fs.access(path.join(DIST_DIRECTORY, 'offline', 'index.html'))

console.log('PWA validation passed: manifest, shortcuts, icons, offline page, and service worker are ready.')
