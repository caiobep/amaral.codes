import fs from 'node:fs/promises'
import path from 'node:path'
import {
  findPipelineDependencyViolations,
  findWorkspaceDependencyViolations,
} from './architecture-rules/index.mjs'

const ROOT = process.cwd()
const PACKAGE_ROOT = path.join(ROOT, 'packages')
const PIPELINE_ROOT = path.join(PACKAGE_ROOT, 'content-sync', 'src')
const ADAPTER_ROOT = path.join(PIPELINE_ROOT, 'adapters')
const PIPELINE_ROOTS = {
  adapterRoot: ADAPTER_ROOT,
  applicationRoot: path.join(PIPELINE_ROOT, 'application'),
  domainRoot: path.join(PIPELINE_ROOT, 'domain'),
}
const WORKSPACE_DEPENDENCY_POLICY = {
  '@amaral.codes/content-contract': [],
  '@amaral.codes/content-sync': ['@amaral.codes/content-contract'],
  '@amaral.codes/website': ['@amaral.codes/content-contract'],
}

const files = await listFiles(PACKAGE_ROOT)
const failures = [
  ...checkTestLocations(files),
  ...await checkPipelineDependencies(),
  ...await checkWorkspaceDependencies(),
]

if (failures.length > 0) {
  console.error('Architecture checks failed:')
  failures.forEach(failure => console.error(`  - ${failure}`))
  process.exitCode = 1
} else {
  console.log('Architecture checks passed.')
}

function checkTestLocations(allFiles) {
  return allFiles
    .filter(file => /\.(?:test|spec)\.(?:[cm]?[jt]s|tsx)$/.test(file))
    .filter(file => !file.includes(`${path.sep}tests${path.sep}browser${path.sep}`))
    .flatMap(file => {
      const name = path.basename(file)
      if (/^index\.(?:test|spec)\./.test(name)) return []
      return [`${relative(file)} must be index.test.* inside the tested module's folder.`]
    })
}

async function checkPipelineDependencies() {
  const sourceFiles = (await listFiles(PIPELINE_ROOT))
    .filter(file => file.endsWith('.ts') && !file.endsWith('.test.ts'))
  const failures = []

  for (const file of sourceFiles) {
    const source = await fs.readFile(file, 'utf8')
    findPipelineDependencyViolations(file, source, PIPELINE_ROOTS)
      .forEach(violation => failures.push(`${relative(file)} ${violation}`))
  }

  return failures
}

async function checkWorkspaceDependencies() {
  const packageDirectories = await fs.readdir(PACKAGE_ROOT, { withFileTypes: true })
  const manifests = await Promise.all(packageDirectories
    .filter(entry => entry.isDirectory())
    .map(async (entry) => {
      const manifestPath = path.join(PACKAGE_ROOT, entry.name, 'package.json')
      const source = await fs.readFile(manifestPath, 'utf8')
      return JSON.parse(source)
    }))

  return manifests.flatMap(manifest => findWorkspaceDependencyViolations(
    manifest.name,
    manifest,
    WORKSPACE_DEPENDENCY_POLICY,
  ))
}

async function listFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries
    .filter(entry => !['node_modules', '.next', '.local', 'coverage'].includes(entry.name))
    .map(entry => {
      const target = path.join(directory, entry.name)
      return entry.isDirectory() ? listFiles(target) : [target]
    }))
  return nested.flat()
}

function relative(file) {
  return path.relative(ROOT, file)
}
