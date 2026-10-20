import assert from 'node:assert/strict'
import { beforeEach, expect, test, vi } from 'vitest'
import type { ContentSyncConfiguration } from '../configuration/index.ts'

const mocks = vi.hoisted(() => {
  const databaseSource = { name: 'database source' }
  const dataSource = { name: 'data source' }
  const exporter = { name: 'exporter' }
  const fileSourceResolver = vi.fn((source: string) => Promise.resolve(source))
  const materializeMarkdown = vi.fn((markdown: string) => Promise.resolve(markdown))
  const materializationSession = { name: 'materialization session' }
  const notionClient = { name: 'notion client' }
  const reservations = { name: 'reservations' }
  const snapshots = { name: 'snapshots' }
  const wiring: { exporterDependencies?: unknown } = {}

  return {
    createDocumentExporter: vi.fn((dependencies: unknown) => {
      wiring.exporterDependencies = dependencies
      return exporter
    }),
    createFilesystemSlugReservations: vi.fn(() => reservations),
    createFilesystemSnapshotStore: vi.fn(() => snapshots),
    createMarkdownAssetMaterializationSession: vi.fn(() => materializationSession),
    createMarkdownAssetMaterializer: vi.fn(() => materializeMarkdown),
    createNotionClient: vi.fn(() => notionClient),
    createNotionCollectionSource: vi.fn(() => dataSource),
    createNotionDatabaseSource: vi.fn(() => databaseSource),
    createNotionFileSourceResolver: vi.fn(() => fileSourceResolver),
    databaseSource,
    dataSource,
    exporter,
    fileSourceResolver,
    materializeMarkdown,
    materializationSession,
    notionClient,
    reservations,
    snapshots,
    syncCollection: vi.fn(() => Promise.resolve(2)),
    wiring,
  }
})

vi.mock('../application/document-exporter.ts', () => ({
  createDocumentExporter: mocks.createDocumentExporter,
}))
vi.mock('../application/sync-collection/index.ts', () => ({
  syncCollection: mocks.syncCollection,
}))
vi.mock('../adapters/filesystem/slug-reservations/index.ts', () => ({
  createFilesystemSlugReservations: mocks.createFilesystemSlugReservations,
}))
vi.mock('../adapters/filesystem/snapshot-store/index.ts', () => ({
  createFilesystemSnapshotStore: mocks.createFilesystemSnapshotStore,
}))
vi.mock('../adapters/markdown/assets/index.ts', () => ({
  createMarkdownAssetMaterializationSession: mocks.createMarkdownAssetMaterializationSession,
  createMarkdownAssetMaterializer: mocks.createMarkdownAssetMaterializer,
}))
vi.mock('../adapters/notion/client/index.ts', () => ({
  createNotionClient: mocks.createNotionClient,
}))
vi.mock('../adapters/notion/databases/index.ts', () => ({
  createNotionDatabaseSource: mocks.createNotionDatabaseSource,
}))
vi.mock('../adapters/notion/pages/index.ts', () => ({
  createNotionCollectionSource: mocks.createNotionCollectionSource,
}))
vi.mock('../adapters/notion/file-source/index.ts', () => ({
  createNotionFileSourceResolver: mocks.createNotionFileSourceResolver,
}))

const { createContentSync } = await import('./index.ts')

beforeEach(() => {
  vi.clearAllMocks()
  mocks.wiring.exporterDependencies = undefined
})

test.each([
  ['entries', 'dataSource', mocks.dataSource],
  ['podcasts', 'database', mocks.databaseSource],
  ['projects', 'dataSource', mocks.dataSource],
] as const)(
  'wires the configured %s collection to its source and snapshot',
  async (collection, sourceKind, source) => {
    const collectionConfiguration = {
      contentRoot: `/content/${collection}`,
      destination: `/synced/${collection}`,
      publicationSafety: {
        allowLargeReduction: false,
        baselineDocuments: 10,
        maximumDropRatio: 0.5,
      },
      sourceId: `${collection}-source`,
      sourceKind,
    }
    const configuration: ContentSyncConfiguration = {
      collections: { [collection]: collectionConfiguration },
      token: 'notion-token',
    }

    const count = await createContentSync(configuration).sync(collection)

    assert.equal(count, 2)
    expect(mocks.createNotionClient).toHaveBeenCalledWith('notion-token')
    expect(mocks.createFilesystemSnapshotStore).toHaveBeenCalledWith(
      collectionConfiguration.destination,
    )
    expect(mocks.createFilesystemSlugReservations).toHaveBeenCalledWith({
      contentRoot: collectionConfiguration.contentRoot,
      syncedRoot: collectionConfiguration.destination,
    })
    expect(mocks.syncCollection).toHaveBeenCalledWith(
      {
        publicationSafety: collectionConfiguration.publicationSafety,
        sourceId: collectionConfiguration.sourceId,
      },
      expect.objectContaining({
        exporter: mocks.exporter,
        reservations: mocks.reservations,
        snapshots: mocks.snapshots,
        source,
      }),
    )
  },
)

test('refuses a collection omitted from configuration', async () => {
  const configuration: ContentSyncConfiguration = {
    collections: {},
    token: 'notion-token',
  }

  await assert.rejects(
    createContentSync(configuration).sync('entries'),
    /Content collection is not configured: entries/,
  )
  expect(mocks.syncCollection).not.toHaveBeenCalled()
})

test('binds file asset resolution to the source page being materialized', async () => {
  const configuration: ContentSyncConfiguration = {
    collections: {},
    token: 'notion-token',
  }
  createContentSync(configuration)
  expect(mocks.createMarkdownAssetMaterializationSession).toHaveBeenCalledTimes(1)
  const exporterDependencies = mocks.wiring.exporterDependencies as {
    materializer: {
      materialize: (
        markdown: string,
        destination: string,
        source: { id: string },
      ) => Promise<string>
    }
  }

  const result = await exporterDependencies.materializer.materialize(
    'markdown',
    '/synced/page',
    { id: 'source-page' },
  )

  assert.equal(result, 'markdown')
  expect(mocks.createNotionFileSourceResolver).toHaveBeenCalledWith(
    mocks.notionClient,
    'source-page',
  )
  expect(mocks.createMarkdownAssetMaterializer).toHaveBeenCalledWith(
    '/synced/page',
    expect.objectContaining({
      resolveSource: mocks.fileSourceResolver,
      session: mocks.materializationSession,
    }),
  )
})
