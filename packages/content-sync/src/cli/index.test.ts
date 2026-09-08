import assert from 'node:assert/strict'
import { test } from 'vitest'
import type { ContentSyncConfiguration } from '../configuration/index.ts'
import type { CollectionName } from '../domain/content/index.ts'
import { SyncFailure } from '../application/sync-failure/index.ts'
import { runCli } from './index.ts'

test.each([
  ['entries', 'entries'],
  ['podcasts', 'podcasts'],
  ['projects', 'projects'],
  ['posts', 'entries'],
] as const)(
  'configures only the selected collection for sync %s',
  async (target, collection) => {
    const harness = createHarness()

    await runCli(['sync', target], harness.dependencies)

    assert.deepEqual(harness.configuredCollections, [[collection]])
    assert.deepEqual(harness.syncedCollections, [collection])
    assert.deepEqual(harness.messages, [`Synced 1 public ${collection}.`])
  },
)

test('configures every collection before an all sync begins', async () => {
  const harness = createHarness()

  await runCli(['sync', 'all'], harness.dependencies)

  assert.deepEqual(harness.configuredCollections, [[
    'entries',
    'podcasts',
    'projects',
  ]])
  assert.deepEqual(harness.syncedCollections, [
    'entries',
    'podcasts',
    'projects',
  ])
})

test('rejects an unknown collection before reading configuration', async () => {
  const harness = createHarness()

  await assert.rejects(
    runCli(['sync', 'talks'], harness.dependencies),
    /Unknown content collection: talks/,
  )
  assert.deepEqual(harness.configuredCollections, [])
})

test('identifies a missing collection before reading configuration', async () => {
  const harness = createHarness()

  await assert.rejects(
    runCli(['sync'], harness.dependencies),
    /Unknown content collection: \(missing\)/,
  )
  assert.deepEqual(harness.configuredCollections, [])
})

test('does not expose private source values from collection failures', async () => {
  const harness = createHarness()
  harness.dependencies.createSync = () => ({
    sync: () => Promise.reject(new Error(
      'Invalid draft "Unpublished workplace note" at https://notion.so/private',
    )),
  })

  const failure = await runCli(['sync', 'entries'], harness.dependencies).catch(
    (error: unknown) => error,
  )

  assert.ok(failure instanceof Error)
  assert.equal(
    failure.message,
    'Failed to sync public entries: Unexpected content synchronization failure.',
  )
  assert.doesNotMatch(failure.message, /Unpublished|notion\.so/u)
})

test('reports a stable reason code for classified sync failures', async () => {
  const harness = createHarness()
  harness.dependencies.createSync = () => ({
    sync: () => Promise.reject(new SyncFailure('UNSAFE_REDUCTION')),
  })

  await assert.rejects(
    runCli(['sync', 'entries'], harness.dependencies),
    /\[UNSAFE_REDUCTION\] Public content is below the configured publication threshold\./,
  )
})

function createHarness(): {
  configuredCollections: CollectionName[][]
  dependencies: NonNullable<Parameters<typeof runCli>[1]>
  messages: string[]
  syncedCollections: CollectionName[]
} {
  const configuredCollections: CollectionName[][] = []
  const syncedCollections: CollectionName[] = []
  const messages: string[] = []
  const configuration: ContentSyncConfiguration = {
    collections: {},
    token: 'token',
  }

  return {
    configuredCollections,
    messages,
    syncedCollections,
    dependencies: {
      readConfig: collections => {
        configuredCollections.push([...collections])
        return configuration
      },
      createSync: () => ({
        sync: (collection) => {
          syncedCollections.push(collection)
          return Promise.resolve(1)
        },
      }),
      log: message => messages.push(message),
    },
  }
}
