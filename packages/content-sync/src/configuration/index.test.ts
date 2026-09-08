import assert from 'node:assert/strict'
import path from 'node:path'
import { afterEach, test, vi } from 'vitest'
import { readConfiguration } from './index.ts'

const SOURCE_ENVIRONMENT_KEYS = [
  'NOTION_ENTRIES_DATA_SOURCE_ID',
  'NOTION_POSTS_DATA_SOURCE_ID',
  'NOTION_PODCASTS_DATABASE_ID',
  'NOTION_PROJECTS_DATA_SOURCE_ID',
] as const

const WEBSITE_ROOT = path.resolve(import.meta.dirname, '../../../website')

afterEach(() => vi.unstubAllEnvs())

test.each([
  [
    'entries',
    'NOTION_ENTRIES_DATA_SOURCE_ID',
    'entries-source',
    'src/content/entries/synced/editorial',
  ],
  [
    'podcasts',
    'NOTION_PODCASTS_DATABASE_ID',
    'podcasts-source',
    'src/content/entries/synced/podcasts',
  ],
  [
    'projects',
    'NOTION_PROJECTS_DATA_SOURCE_ID',
    'projects-source',
    'src/content/projects/synced',
  ],
] as const)(
  'reads only the %s source credentials for a targeted sync',
  (collection, sourceKey, sourceId, expectedDestination) => {
    stubEmptySourceEnvironment()
    vi.stubEnv('NOTION_TOKEN', 'token')
    vi.stubEnv(sourceKey, sourceId)

    const configuration = readConfiguration([collection])
    const collectionConfiguration = configuration.collections[collection]

    assert.equal(configuration.token, 'token')
    assert.deepEqual(Object.keys(configuration.collections), [collection])
    assert.ok(collectionConfiguration)
    assert.equal(collectionConfiguration.sourceId, sourceId)
    assert.deepEqual(collectionConfiguration.publicationSafety, {
      allowLargeReduction: false,
      baselineDocuments: collection === 'entries' ? 55 : collection === 'podcasts' ? 13 : 6,
      maximumDropRatio: 0.1,
    })
    assert.equal(
      path.relative(
        WEBSITE_ROOT,
        collectionConfiguration.destination,
      ),
      expectedDestination,
    )
  },
)

test('requires every source credential selected for an all sync', () => {
  stubEmptySourceEnvironment()
  vi.stubEnv('NOTION_TOKEN', 'token')
  vi.stubEnv('NOTION_ENTRIES_DATA_SOURCE_ID', 'entries-source')
  vi.stubEnv('NOTION_PODCASTS_DATABASE_ID', 'podcasts-source')

  assert.throws(
    () => readConfiguration(['entries', 'podcasts', 'projects']),
    /Missing environment variable: NOTION_PROJECTS_DATA_SOURCE_ID/,
  )
})

test('supports the legacy entries source credential', () => {
  stubEmptySourceEnvironment()
  vi.stubEnv('NOTION_TOKEN', 'token')
  vi.stubEnv('NOTION_POSTS_DATA_SOURCE_ID', 'legacy-source')

  const configuration = readConfiguration(['entries'])

  assert.equal(configuration.collections.entries?.sourceId, 'legacy-source')
})

test('passes the explicit large-reduction override to the pre-swap policy', () => {
  stubEmptySourceEnvironment()
  vi.stubEnv('NOTION_TOKEN', 'token')
  vi.stubEnv('NOTION_ENTRIES_DATA_SOURCE_ID', 'entries-source')
  vi.stubEnv('PUBLICATION_ALLOW_LARGE_DROP', '1')

  const configuration = readConfiguration(['entries'])

  assert.equal(
    configuration.collections.entries?.publicationSafety.allowLargeReduction,
    true,
  )
})

function stubEmptySourceEnvironment(): void {
  for (const key of SOURCE_ENVIRONMENT_KEYS) vi.stubEnv(key, '')
}
