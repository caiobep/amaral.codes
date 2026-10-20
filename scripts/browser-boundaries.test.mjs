import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { findBrowserBoundaryViolations } from './browser-boundaries.mjs'

test('reports a transitive browser import chain through a barrel', async (context) => {
  const root = await createWebsite(context, {
    'src/scripts/browser.ts': "import '../shared/index.ts'",
    'src/shared/index.ts': "export * from '../lib/content/index.ts'",
    'src/lib/content/index.ts': 'export const entries = []',
  })

  assert.deepEqual(await findBrowserBoundaryViolations(root), [
    'browser import chain src/scripts/browser.ts -> src/shared/index.ts -> src/lib/content/index.ts: lib/content is build-time only',
  ])
})

test('allows type-only imports and exports from build modules', async (context) => {
  const root = await createWebsite(context, {
    'src/scripts/browser.ts': [
      "import type { Entry } from '../content/schemas/index.ts'",
      "import { type Project } from '../lib/content/index.ts'",
      "export type { SearchDocument } from '../lib/search/documents.ts'",
    ].join('\n'),
    'src/content/schemas/index.ts': 'export type Entry = string',
    'src/lib/content/index.ts': 'export type Project = string',
    'src/lib/search/documents.ts': 'export type SearchDocument = string',
  })

  assert.deepEqual(await findBrowserBoundaryViolations(root), [])
})

test('treats empty named imports and exports as runtime dependencies', async (context) => {
  const root = await createWebsite(context, {
    'src/scripts/browser.ts': [
      "import {} from '../content/schemas/index.ts'",
      "export {} from '../lib/content/index.ts'",
    ].join('\n'),
    'src/content/schemas/index.ts': 'export const schema = true',
    'src/lib/content/index.ts': 'export const entries = []',
  })

  assert.equal((await findBrowserBoundaryViolations(root)).length, 2)
})

test('follows literal dynamic imports from Astro browser scripts', async (context) => {
  const root = await createWebsite(context, {
    'src/pages/search.astro': "---\nconst serverOnly = true\n---\n<script>void import('../features/search/search.client.ts')</script>",
    'src/features/search/search.client.ts': "import 'node:fs'",
  })

  assert.deepEqual(await findBrowserBoundaryViolations(root), [
    'browser import chain src/features/search/search.client.ts -> node:fs: Node built-in modules are server-only',
    'browser import chain src/pages/search.astro -> src/features/search/search.client.ts -> node:fs: Node built-in modules are server-only',
  ])
})

test('follows static Astro script sources and literal require calls', async (context) => {
  const root = await createWebsite(context, {
    'src/pages/search.astro': '<script src="../features/search/search.client.ts"></script>',
    'src/features/search/search.client.ts': "require('astro:content')",
  })

  assert.deepEqual(await findBrowserBoundaryViolations(root), [
    'browser import chain src/features/search/search.client.ts -> astro:content: astro:content is build-time only',
    'browser import chain src/pages/search.astro -> src/features/search/search.client.ts -> astro:content: astro:content is build-time only',
  ])
})

test('rejects direct and aliased imports into server workspace source', async (context) => {
  const root = await createWebsite(context, {
    'src/scripts/direct.ts': "import '../../../content-sync/src/cli.ts'",
    'src/scripts/aliased.ts': "import '@sync/cli'",
    'src/scripts/metadata.ts': "import '../../../content-contract/src/metadata/index.ts'",
    '../content-sync/src/cli.ts': 'export const run = true',
    '../content-contract/src/metadata/index.ts': 'export const schema = true',
  }, {
    baseUrl: '.',
    paths: { '@sync/*': ['../content-sync/src/*'] },
  })

  assert.deepEqual(await findBrowserBoundaryViolations(root), [
    'browser import chain src/scripts/aliased.ts -> ../content-sync/src/cli.ts: content-sync is server-only',
    'browser import chain src/scripts/direct.ts -> ../content-sync/src/cli.ts: content-sync is server-only',
    'browser import chain src/scripts/metadata.ts -> ../content-contract/src/metadata/index.ts: content-contract metadata and schema validation are build-time only',
  ])
})

test('handles cycles while retaining the offending chain', async (context) => {
  const root = await createWebsite(context, {
    'src/scripts/browser.ts': "import './cycle-a.ts'",
    'src/scripts/cycle-a.ts': "import './cycle-b.ts'",
    'src/scripts/cycle-b.ts': "import './cycle-a.ts'\nimport 'astro:content'",
  })

  const failures = await findBrowserBoundaryViolations(root)
  assert.equal(failures.length, 3)
  assert.ok(failures.every(failure => failure.endsWith('astro:content is build-time only')))
})

test('accepts a legitimate browser graph and the public URL helper', async (context) => {
  const root = await createWebsite(context, {
    'src/scripts/browser.ts': "import '../features/search/controller.client.ts'",
    'src/features/search/controller.client.ts': "export { normalize } from './normalize.ts'\nexport { requirePublicUrl } from '@amaral.codes/content-contract/public-url'",
    'src/features/search/normalize.ts': "export const normalize = (value: string) => value.trim()",
  })

  assert.deepEqual(await findBrowserBoundaryViolations(root), [])
})

async function createWebsite(context, files, compilerOptions = {}) {
  const repositoryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'browser-boundaries-'))
  const root = path.join(repositoryRoot, 'packages', 'website')
  context.after(() => fs.rm(repositoryRoot, { recursive: true, force: true }))
  await fs.mkdir(root, { recursive: true })
  await fs.writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({
    compilerOptions: {
      moduleResolution: 'bundler',
      module: 'esnext',
      allowJs: true,
      ...compilerOptions,
    },
  }))
  await Promise.all(Object.entries(files).map(async ([relative, source]) => {
    const file = path.join(root, relative)
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.writeFile(file, source)
  }))
  return root
}
