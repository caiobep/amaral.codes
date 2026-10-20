import assert from 'node:assert/strict'
import path from 'node:path'
import { test } from 'node:test'
import {
  collectModuleSpecifiers,
  findPipelineDependencyViolations,
  findWorkspaceDependencyViolations,
  findTestLocationViolations,
} from './index.mjs'

const pipelineRoot = path.resolve('/repo/packages/content-sync/src')
const roots = {
  adapterRoot: path.join(pipelineRoot, 'adapters'),
  applicationRoot: path.join(pipelineRoot, 'application'),
  domainRoot: path.join(pipelineRoot, 'domain'),
}

test('accepts descriptive colocated tests and separate test suites', () => {
  assert.deepEqual(findTestLocationViolations([
    'src/search.ts', 'src/search.test.ts',
    'src/module/index.mjs', 'src/module/index.test.mjs',
    'src/Card.astro', 'src/Card.test.ts',
    'tests/browser/search.spec.ts', 'tests/runtime/search.test.ts',
  ]), [])
})

test('rejects orphaned unit tests rather than prescribing index filenames', () => {
  assert.deepEqual(findTestLocationViolations(['src/search.test.ts']), [
    'src/search.test.ts must be colocated with its matching source module.',
  ])
})

test('collects every supported module dependency syntax', () => {
  const source = `
    import value from 'ordinary'
    import type { Type } from 'type-only'
    import 'side-effect'
    export { value } from 're-export'
    export * from 'export-all'
    const lazy = import('dynamic')
    const commonJs = require('common-js')
  `

  assert.deepEqual(collectModuleSpecifiers(source), [
    'ordinary',
    'type-only',
    'side-effect',
    're-export',
    'export-all',
    'dynamic',
    'common-js',
  ])
})

test('rejects outer dependencies from domain and application', () => {
  const domainFile = path.join(roots.domainRoot, 'content/index.ts')
  const applicationFile = path.join(roots.applicationRoot, 'sync/index.ts')

  assert.deepEqual(
    findPipelineDependencyViolations(domainFile, "import('@notionhq/client')", roots),
    ['cannot depend on outer layer @notionhq/client.'],
  )
  assert.deepEqual(
    findPipelineDependencyViolations(applicationFile, "export * from '../../adapters/notion/index.ts'", roots),
    ['cannot depend on adapter ../../adapters/notion/index.ts.'],
  )
})

test('rejects imports between sibling adapters', () => {
  const file = path.join(roots.adapterRoot, 'markdown/document/index.ts')

  assert.deepEqual(
    findPipelineDependencyViolations(file, "import '../../notion/client/index.ts'", roots),
    ['cannot import sibling adapter ../../notion/client/index.ts. Wire it in composition-root/index.ts.'],
  )
  assert.deepEqual(
    findPipelineDependencyViolations(file, "import '../sanitizer/index.ts'", roots),
    [],
  )
})

test('enforces the workspace dependency policy across dependency groups', () => {
  const policy = {
    '@amaral.codes/content-contract': [],
    '@amaral.codes/content-sync': ['@amaral.codes/content-contract'],
    '@amaral.codes/website': ['@amaral.codes/content-contract'],
  }

  assert.deepEqual(findWorkspaceDependencyViolations(
    '@amaral.codes/content-sync',
    { dependencies: { '@amaral.codes/content-contract': '0.0.0' } },
    policy,
  ), [])
  assert.deepEqual(findWorkspaceDependencyViolations(
    '@amaral.codes/website',
    { devDependencies: { '@amaral.codes/content-sync': '0.0.0' } },
    policy,
  ), [
    '@amaral.codes/website cannot depend on @amaral.codes/content-sync.',
  ])
})

test('requires every workspace to have an explicit dependency policy', () => {
  assert.deepEqual(findWorkspaceDependencyViolations(
    '@amaral.codes/unclassified',
    {},
    { '@amaral.codes/content-contract': [] },
  ), [
    '@amaral.codes/unclassified has no workspace dependency policy.',
  ])
})
