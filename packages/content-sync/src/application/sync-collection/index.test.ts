import assert from 'node:assert/strict'
import { test } from 'vitest'
import type {
  CollectionSource,
  ContentMapper,
  DocumentExporter,
  SlugReservationSource,
  SnapshotStore,
} from '../ports.ts'
import type { ContentIdentity } from '../../domain/content/index.ts'
import { SyncFailure } from '../sync-failure/index.ts'
import { syncCollection } from './index.ts'

interface SourceRecord {
  id: string
  identity?: ContentIdentity
  published: boolean
}

interface SnapshotScope {
  readonly name: string
}

const SNAPSHOT_SCOPE: SnapshotScope = { name: 'new snapshot' }
const STANDARD_COMMAND = {
  publicationSafety: {
    allowLargeReduction: false,
    baselineDocuments: 4,
    maximumDropRatio: 0.5,
  },
  sourceId: 'source',
} as const
const ALLOW_INTENTIONAL_REDUCTION = {
  publicationSafety: {
    allowLargeReduction: true,
    baselineDocuments: 4,
    maximumDropRatio: 0.5,
  },
  sourceId: 'source',
} as const

test('publishes only source records admitted by the mapper into an atomic snapshot', async () => {
  const exported: string[] = []
  const records = [
    record('published', true),
    record('archive', false),
    record('preview', false),
    record('draft', false),
  ]

  const count = await syncCollection(
    ALLOW_INTENTIONAL_REDUCTION,
    dependencies(records, exported),
  )

  assert.equal(count, 1)
  assert.deepEqual(exported, [
    'new snapshot:published',
  ])
})

test('does not strictly map incomplete private records', async () => {
  const records = [
    record('published', true),
    record('incomplete-draft', false),
  ]
  const syncDependencies = dependencies(records, [])
  const map = syncDependencies.mapper.map
  syncDependencies.mapper.map = (source) => {
    if (source.id === 'incomplete-draft') {
      throw new Error('private record was strictly mapped')
    }
    return map(source)
  }

  await syncCollection(
    ALLOW_INTENTIONAL_REDUCTION,
    syncDependencies,
  )
})

test('refuses to replace a snapshot with no source rows', async () => {
  await assert.rejects(
    syncCollection(
      STANDARD_COMMAND,
      dependencies([], []),
    ),
    /returned no rows/,
  )
})

test('refuses an implausibly small public snapshot', async () => {
  await assert.rejects(
    syncCollection(
      STANDARD_COMMAND,
      dependencies([record('only-record', true)], []),
    ),
    /below the configured publication threshold/,
  )
})

test('refuses a reduction beyond the configured baseline tolerance', async () => {
  const records = Array.from(
    { length: 4 },
    (_, index) => record(`record-${String(index)}`, true),
  )

  await assert.rejects(
    syncCollection(
      {
        sourceId: 'source',
        publicationSafety: {
          allowLargeReduction: false,
          baselineDocuments: 10,
          maximumDropRatio: 0.5,
        },
      },
      dependencies(records, []),
    ),
    /below the configured publication threshold/,
  )
})

test('allows an intentional nonempty snapshot reduction', async () => {
  const exported: string[] = []

  const count = await syncCollection(
    {
      sourceId: 'source',
      publicationSafety: {
        allowLargeReduction: true,
        baselineDocuments: 10,
        maximumDropRatio: 0.5,
      },
    },
    dependencies([record('remaining', true)], exported),
  )

  assert.equal(count, 1)
  assert.deepEqual(exported, ['new snapshot:remaining'])
})

test('never allows an empty snapshot through the reduction override', async () => {
  await assert.rejects(
    syncCollection(
      {
        sourceId: 'source',
        publicationSafety: {
          allowLargeReduction: true,
          baselineDocuments: 4,
          maximumDropRatio: 0.5,
        },
      },
      dependencies([], []),
    ),
    /returned no rows/,
  )
})

test('refuses duplicate public slugs', async () => {
  const records = [
    record('first', true, 'duplicate'),
    record('second', true, 'duplicate'),
  ]

  await assert.rejects(
    syncCollection(
      STANDARD_COMMAND,
      dependencies(records, []),
    ),
    /contains duplicate slugs/,
  )
})

test('refuses a slug reserved by hand-maintained content', async () => {
  await assert.rejects(
    syncCollection(
      ALLOW_INTENTIONAL_REDUCTION,
      dependencies(
        [record('generated', true, 'existing-post')],
        [],
        new Set(['existing-post']),
      ),
    ),
    /conflicts with hand-maintained content/,
  )
})

test('normalizes slugs before exporting content', async () => {
  const exported: string[] = []

  await syncCollection(
    ALLOW_INTENTIONAL_REDUCTION,
    dependencies(
      [record('entry', true, 'Configuração & APIs')],
      exported,
    ),
  )

  assert.deepEqual(exported, ['new snapshot:configuracao_apis'])
})

test('normalizes slugs before checking hand-maintained reservations', async () => {
  await assert.rejects(
    syncCollection(
      ALLOW_INTENTIONAL_REDUCTION,
      dependencies(
        [record('generated', true, 'Existing_Post')],
        [],
        new Set(['existing_post']),
      ),
    ),
    /conflicts with hand-maintained content/,
  )
})

test('preserves safe legacy underscore slugs', async () => {
  const exported: string[] = []

  await syncCollection(
    ALLOW_INTENTIONAL_REDUCTION,
    dependencies(
      [record('entry', true, 'my_journey_with_productivity_tools')],
      exported,
    ),
  )

  assert.deepEqual(exported, ['new snapshot:my_journey_with_productivity_tools'])
})

test('waits for active exports before rejecting a snapshot replacement', async () => {
  const activeExport = deferred()
  const started: string[] = []
  const failure = new Error('first export failed')
  const syncDependencies = dependencies([
    record('failure', true),
    record('active', true),
    record('unassigned', true),
  ], [])
  syncDependencies.exporter.export = async ({ identity }) => {
    started.push(identity.slug)
    if (identity.slug === 'failure') throw failure
    if (identity.slug === 'active') await activeExport.promise
  }

  const result = syncCollection(
    { ...ALLOW_INTENTIONAL_REDUCTION },
    { ...syncDependencies, concurrency: 2 },
  ).then(
    () => ({ status: 'resolved' as const }),
    (reason: unknown) => ({ reason, status: 'rejected' as const }),
  )

  await waitForTurn()
  assert.deepEqual(started, ['failure', 'active'])
  assert.equal(await isSettled(result), false)

  activeExport.resolve()
  const outcome = await result
  assert.equal(outcome.status, 'rejected')
  assert.ok(outcome.reason instanceof SyncFailure)
  assert.equal(outcome.reason.code, 'SNAPSHOT_WRITE_FAILED')
  assert.equal(outcome.reason.cause, failure)
  assert.deepEqual(started, ['failure', 'active'])
})

test('rejects incomplete public metadata before replacing the snapshot', async () => {
  await assertRejectedBeforeSnapshot({
    id: 'missing-summary',
    published: true,
    identity: {
      slug: 'missing-summary',
      metadata: {
        category: 'note',
        date: '2026-07-27',
        title: 'Entry missing a summary',
        topics: [],
      } as never,
    },
  })
})

test('rejects an invalid talk material URL before replacing the snapshot', async () => {
  await assertRejectedBeforeSnapshot({
    id: 'invalid-talk',
    published: true,
    identity: {
      partition: 'talks',
      slug: 'invalid-talk',
      metadata: {
        category: 'talk',
        date: '2026-07-27',
        summary: 'A talk with invalid material metadata.',
        talk: {
          format: 'talk',
          materials: [{
            label: 'Open slides',
            type: 'pdf',
            url: 'ftp://example.com/slides.pdf',
          }],
        },
        title: 'Invalid talk',
        topics: [],
      },
    },
  })
})

async function assertRejectedBeforeSnapshot(source: SourceRecord): Promise<void> {
  const syncDependencies = dependencies([source], [])
  let replacementCount = 0
  syncDependencies.snapshots.replace = () => {
    replacementCount += 1
    return Promise.resolve()
  }

  await assert.rejects(syncCollection(STANDARD_COMMAND, syncDependencies))
  assert.equal(replacementCount, 0)
}

function dependencies(
  records: SourceRecord[],
  exported: string[],
  reservedSlugs: ReadonlySet<string> = new Set(),
): {
  exporter: DocumentExporter<SourceRecord, SnapshotScope>
  mapper: ContentMapper<SourceRecord>
  reservations: SlugReservationSource
  snapshots: SnapshotStore<SnapshotScope>
  source: CollectionSource<SourceRecord>
} {
  return {
    source: {
      list: () => Promise.resolve(records),
    },
    mapper: {
      isPublished: source => source.published,
      map: source => {
        if (!source.identity) throw new Error('Private source was mapped')
        return source.identity
      },
    },
    reservations: { list: () => Promise.resolve(reservedSlugs) },
    snapshots: {
      replace: write => write(SNAPSHOT_SCOPE),
    },
    exporter: {
      export: ({ identity, scope }) => {
        exported.push(`${scope.name}:${identity.slug}`)
        return Promise.resolve()
      },
    },
  }
}

function record(
  id: string,
  published: boolean,
  slug = id,
): SourceRecord {
  if (!published) return { id, published }

  return {
    id,
    published,
    identity: {
      slug,
      metadata: {
        category: 'note',
        date: '2026-07-27',
        summary: 'Summary',
        title: id,
        topics: [],
      },
    },
  }
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => undefined
  const promise = new Promise<void>((complete) => {
    resolve = complete
  })
  return { promise, resolve }
}

async function isSettled(promise: Promise<unknown>): Promise<boolean> {
  const pending = Symbol('pending')
  return await Promise.race([promise, Promise.resolve(pending)]) !== pending
}

function waitForTurn(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve))
}
