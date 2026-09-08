import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { onTestFinished, test } from 'vitest'
import type { DocumentExporter } from '../../../application/ports.ts'
import { syncCollection } from '../../../application/sync-collection/index.ts'
import { SyncFailure } from '../../../application/sync-failure/index.ts'
import type { ContentIdentity } from '../../../domain/content/index.ts'
import { createFilesystemSnapshotStore } from '../snapshot-store/index.ts'
import { writeContentSource } from '../write-document/index.ts'
import { createFilesystemSlugReservations } from './index.ts'

test('reserves hand-maintained slugs and ignores synced content', async ({ onTestFinished }) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'slug-reservations-'))
  onTestFinished(() => fs.rm(root, { recursive: true, force: true }))
  const syncedRoot = path.join(root, 'synced')
  await fs.mkdir(path.join(root, 'essays'))
  await fs.mkdir(syncedRoot)
  await fs.writeFile(path.join(root, 'essays', 'Hand_Made.md'), '')
  await fs.writeFile(path.join(root, 'essays', 'preview.webp'), '')
  await fs.writeFile(path.join(syncedRoot, 'synced-post.md'), '')

  const reservations = createFilesystemSlugReservations({
    contentRoot: root,
    syncedRoot,
  })

  assert.deepEqual([...await reservations.list()], ['hand_made'])
})

test.each(['synced', 'podcasts/synced'])(
  'excludes only snapshot-owned paths for %s',
  async (destination) => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'slug-ownership-'))
    onTestFinished(() => fs.rm(root, { recursive: true, force: true }))
    const syncedRoot = path.join(root, destination)
    const parent = path.dirname(syncedRoot)
    for (const directory of [
      syncedRoot,
      path.join(parent, '.publication-snapshots', 'synced.staging'),
      path.join(parent, '.publication-snapshots', 'synced.backup'),
      path.join(parent, '.synced.staging'),
      path.join(parent, '.synced.backup'),
    ]) {
      await writeContentSource(directory, 'generated', '')
    }
    for (const [directory, slug] of [
      [path.join(root, 'notes'), 'authored-note'],
      [path.join(root, 'podcasts'), 'authored-podcast'],
      [path.join(root, 'other-collection', 'synced'), 'other-snapshot'],
      [path.join(root, 'other-collection', '.publication-snapshots'), 'unowned-work-name'],
      [path.join(root, 'other-collection', '.synced.backup'), 'unowned-legacy-name'],
      [path.join(parent, '.publication-snapshots-authored'), 'similar-prefix'],
    ] as const) {
      await writeContentSource(directory, slug, '')
    }

    const reservations = createFilesystemSlugReservations({
      contentRoot: root,
      syncedRoot: path.join(parent, 'unused', '..', 'synced'),
    })

    assert.deepEqual(await reservations.list(), new Set([
      'authored-note', 'authored-podcast', 'other-snapshot', 'unowned-work-name',
      'unowned-legacy-name', 'similar-prefix',
    ]))
  },
)

test.each([
  { layout: 'work', committed: false },
  { layout: 'work', committed: true },
  { layout: 'legacy', committed: false },
  { layout: 'legacy', committed: true },
])(
  'sync recovers $layout artifacts (committed: $committed) and preserves content across failure and retry',
  async ({ layout, committed }) => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sync-recovery-'))
    onTestFinished(() => fs.rm(root, { recursive: true, force: true }))
    const syncedRoot = path.join(root, 'synced')
    const prefix = layout === 'work'
      ? path.join(root, '.publication-snapshots', 'synced')
      : path.join(root, '.synced')
    await writeContentSource(`${prefix}.backup`, 'published', 'previous snapshot')
    await writeContentSource(`${prefix}.staging`, 'published', 'interrupted export')
    await writeContentSource(path.join(root, 'podcasts'), 'authored', 'hand-maintained podcast')
    if (committed) await writeContentSource(syncedRoot, 'published', 'committed snapshot')
    const preservedContent = committed ? 'committed snapshot' : 'previous snapshot'
    const failure = new Error('next export failed')

    await assert.rejects(syncFilesystemSnapshot(root, syncedRoot, {
      export: async ({ identity, scope }) => {
        assert.equal(await fs.readFile(path.join(syncedRoot, 'published.md'), 'utf8'), preservedContent)
        assert.deepEqual(await fs.readdir(scope), [])
        await writeContentSource(scope, identity.slug, 'failed export')
        throw failure
      },
    }), { code: 'SNAPSHOT_WRITE_FAILED', cause: failure })

    assert.equal(await fs.readFile(path.join(syncedRoot, 'published.md'), 'utf8'), preservedContent)
    await assert.rejects(fs.access(`${prefix}.backup`))
    await assert.rejects(fs.access(`${prefix}.staging`))
    assert.equal(await fs.readFile(path.join(root, 'podcasts', 'authored.md'), 'utf8'), 'hand-maintained podcast')

    const count = await syncFilesystemSnapshot(root, syncedRoot, {
      export: async ({ identity, scope }) => {
        await writeContentSource(scope, identity.slug, 'updated snapshot')
      },
    })

    assert.equal(count, 1)
    assert.deepEqual(await fs.readdir(syncedRoot), ['published.md'])
    assert.equal(await fs.readFile(path.join(syncedRoot, 'published.md'), 'utf8'), 'updated snapshot')
    assert.deepEqual(await fs.readdir(path.join(root, '.publication-snapshots')), [])
    assert.equal(await fs.readFile(path.join(root, 'podcasts', 'authored.md'), 'utf8'), 'hand-maintained podcast')
  },
)

test('sync still rejects an authored sibling collection collision before changing interrupted state', async ({ onTestFinished }) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sync-authored-collision-'))
  onTestFinished(() => fs.rm(root, { recursive: true, force: true }))
  const syncedRoot = path.join(root, 'podcasts', 'synced')
  const backup = path.join(root, 'podcasts', '.publication-snapshots', 'synced.backup')
  await writeContentSource(backup, 'previous', 'previous snapshot')
  await writeContentSource(path.join(root, 'notes'), 'published', 'authored note')

  await assert.rejects(syncFilesystemSnapshot(root, syncedRoot, {
    export: () => assert.fail('Authored collision must prevent export'),
  }), new SyncFailure('RESERVED_SLUG'))

  assert.equal(await fs.readFile(path.join(backup, 'previous.md'), 'utf8'), 'previous snapshot')
  assert.equal(await fs.readFile(path.join(root, 'notes', 'published.md'), 'utf8'), 'authored note')
  await assert.rejects(fs.access(syncedRoot))
})

function syncFilesystemSnapshot(
  contentRoot: string,
  syncedRoot: string,
  exporter: DocumentExporter<ContentIdentity, string>,
): Promise<number> {
  const identity: ContentIdentity = {
    slug: 'published',
    metadata: {
      category: 'note',
      date: '2026-09-07',
      summary: 'Public content',
      title: 'Published',
      topics: [],
    },
  }
  return syncCollection({
    sourceId: 'source',
    publicationSafety: {
      allowLargeReduction: false,
      baselineDocuments: 1,
      maximumDropRatio: 0,
    },
  }, {
    exporter,
    mapper: { isPublished: () => true, map: source => source },
    reservations: createFilesystemSlugReservations({ contentRoot, syncedRoot }),
    snapshots: createFilesystemSnapshotStore(syncedRoot),
    source: { list: () => Promise.resolve([identity]) },
  })
}
