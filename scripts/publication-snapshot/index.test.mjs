import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, test } from 'node:test'
import {
  inspectPublicationSnapshot,
  isGeneratedPublicationPath,
  verifyPublicationSnapshot,
} from './index.mjs'

const temporaryRoots = []

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(root => rm(root, {
    force: true,
    recursive: true,
  })))
})

test('requires a nonempty snapshot for every Notion-owned collection', async () => {
  const root = await createRepository()
  const snapshots = await inspectPublicationSnapshot(root)

  assert.deepEqual(snapshots.map(snapshot => snapshot.markdownFiles), [0, 0, 0])
  await assert.rejects(
    verifyPublicationSnapshot(root),
    /editorial entries[\s\S]*podcasts[\s\S]*projects/u,
  )
})

test('rejects severe nonempty publication drops', async () => {
  const root = await createRepository()
  const minimums = await minimumDocumentCounts(root)
  await Promise.all([
    writeMarkdown(root, 'packages/website/src/content/entries/synced/editorial/note.md'),
    writeMarkdown(root, 'packages/website/src/content/entries/synced/podcasts/episode.md'),
    writeMarkdown(root, 'packages/website/src/content/projects/synced/project.md'),
  ])

  await assert.rejects(
    verifyPublicationSnapshot(root),
    error => minimums.every(minimum => error.message.includes(`minimum ${String(minimum)}`)),
  )
})

test('accepts snapshots within the configured drop tolerance', async () => {
  const root = await createRepository()
  const minimums = await minimumDocumentCounts(root)
  await Promise.all([
    writeCollection(root, 'packages/website/src/content/entries/synced/editorial', minimums[0]),
    writeCollection(root, 'packages/website/src/content/entries/synced/podcasts', minimums[1]),
    writeCollection(root, 'packages/website/src/content/projects/synced', minimums[2]),
  ])

  const snapshots = await verifyPublicationSnapshot(root)
  assert.deepEqual(snapshots.map(snapshot => snapshot.markdownFiles), minimums)
})

test('allows an intentional nonempty reduction through an explicit override', async () => {
  const root = await createRepository()
  await Promise.all([
    writeMarkdown(root, 'packages/website/src/content/entries/synced/editorial/note.md'),
    writeMarkdown(root, 'packages/website/src/content/entries/synced/podcasts/episode.md'),
    writeMarkdown(root, 'packages/website/src/content/projects/synced/project.md'),
  ])

  const snapshots = await verifyPublicationSnapshot(root, {
    allowLargeReduction: true,
  })
  assert.deepEqual(snapshots.map(snapshot => snapshot.markdownFiles), [1, 1, 1])
})

test('never allows an empty collection through the reduction override', async () => {
  const root = await createRepository()
  await Promise.all([
    writeMarkdown(root, 'packages/website/src/content/entries/synced/editorial/note.md'),
    writeMarkdown(root, 'packages/website/src/content/entries/synced/podcasts/episode.md'),
  ])

  await assert.rejects(
    verifyPublicationSnapshot(root, { allowLargeReduction: true }),
    /projects/u,
  )
})

test('recognizes only generated publication paths', () => {
  assert.equal(
    isGeneratedPublicationPath('packages/website/src/content/entries/synced/note.md'),
    true,
  )
  assert.equal(
    isGeneratedPublicationPath('packages/website/src/content/projects/synced/project.md'),
    true,
  )
  assert.equal(
    isGeneratedPublicationPath('packages/website/tests/fixtures/content/entries/note.md'),
    false,
  )
})

async function createRepository() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'publication-snapshot-'))
  temporaryRoots.push(root)
  return root
}

async function writeMarkdown(root, relativePath) {
  const filePath = path.join(root, relativePath)
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, '# Fixture\n')
}

async function writeCollection(root, relativeRoot, count) {
  await Promise.all(Array.from(
    { length: count },
    (_, index) => writeMarkdown(root, `${relativeRoot}/entry-${String(index)}.md`),
  ))
}

async function minimumDocumentCounts(root) {
  const snapshots = await inspectPublicationSnapshot(root)
  return snapshots.map(snapshot => snapshot.minimumDocuments)
}
