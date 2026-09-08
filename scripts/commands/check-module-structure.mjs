#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import {
  findModuleStructureViolations,
  MAX_TOP_LEVEL_FUNCTIONS,
} from '../module-structure/index.mjs'

const SOURCE_ROOTS = [
  'scripts',
  'packages/content-sync/src',
  'packages/content-contract/src',
  'packages/website/scripts',
  'packages/website/src',
]

const files = (await Promise.all(SOURCE_ROOTS.map(listSourceFiles))).flat()
const modules = await Promise.all(files.map(async filePath => ({
  filePath,
  source: await fs.readFile(filePath, 'utf8'),
})))
const violations = findModuleStructureViolations(modules)

if (violations.length > 0) {
  console.error('Module structure check failed:')
  violations.forEach(({ filePath, functionCount, maximumFunctions }) => {
    console.error(
      `  ${filePath}: ${String(functionCount)} top-level functions; maximum ${String(maximumFunctions)}`,
    )
  })
  process.exitCode = 1
} else {
  console.log(
    `Module structure check passed: at most ${String(MAX_TOP_LEVEL_FUNCTIONS)} top-level functions per module.`,
  )
}

async function listSourceFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(entry => {
    const target = path.join(directory, entry.name)
    return entry.isDirectory() ? listSourceFiles(target) : [target]
  }))
  return nested.flat().filter(isAuthoredModule)
}

function isAuthoredModule(filePath) {
  return /\.(?:mjs|ts)$/.test(filePath)
    && !/\.(?:test|spec)\.(?:mjs|ts)$/.test(filePath)
    && !filePath.includes(`${path.sep}.astro${path.sep}`)
}
