#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getBuildId, injectManifest } from '../service-worker-build/index.mjs'

const PACKAGE_DIRECTORY = fileURLToPath(new URL('../..', import.meta.url))
const DIST_DIRECTORY = path.join(PACKAGE_DIRECTORY, 'dist')
const TEMPLATE_PATH = path.join(PACKAGE_DIRECTORY, 'src/pwa/service-worker.js')
const OUTPUT_PATH = path.join(DIST_DIRECTORY, 'service-worker.js')
const CORE_ROUTES = ['/', '/offline/', '/posts', '/projects', '/search', '/search-index.json']
const PRECACHE_EXTENSIONS = new Set(['.css', '.js', '.woff2'])
const MAX_PRECACHE_ASSET_BYTES = 256 * 1024
const PRECACHE_FILES = new Set([
  'favicon-dark.svg',
  'favicon.svg',
  'manifest.webmanifest',
  'textures/material-noise.webp',
])

const collectFiles = async (directory) => {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const nestedFiles = entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name)
    return entry.isDirectory() ? collectFiles(entryPath) : [entryPath]
  })
  return (await Promise.all(nestedFiles)).flat()
}

const toPublicPath = (filePath) => `/${path.relative(DIST_DIRECTORY, filePath).split(path.sep).join('/')}`

const shouldPrecache = (publicPath) => {
  const relativePath = publicPath.slice(1)
  return PRECACHE_EXTENSIONS.has(path.extname(publicPath)) ||
    PRECACHE_FILES.has(relativePath) ||
    relativePath.startsWith('icons/')
}

const files = await collectFiles(DIST_DIRECTORY)
const precacheAssetFiles = []
for (const file of files) {
  if (!shouldPrecache(toPublicPath(file))) continue
  const { size } = await fs.stat(file)
  if (size <= MAX_PRECACHE_ASSET_BYTES) precacheAssetFiles.push(file)
}
const generatedAssets = precacheAssetFiles.map(toPublicPath)
const precacheUrls = [...new Set([...CORE_ROUTES, ...generatedAssets])].sort()
const template = await fs.readFile(TEMPLATE_PATH, 'utf8')
const generatedHtmlFiles = files.filter(file => path.extname(file) === '.html')
const buildId = await getBuildId(precacheUrls, DIST_DIRECTORY, generatedHtmlFiles)
const serviceWorker = injectManifest(template, precacheUrls, buildId)

await fs.writeFile(OUTPUT_PATH, serviceWorker)
console.log(`Generated service worker with ${String(precacheUrls.length)} precached resources.`)
