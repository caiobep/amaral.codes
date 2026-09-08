import { parsePublicContentMetadata } from '@amaral.codes/content-contract'
import { createContentId } from '@amaral.codes/content-contract/content-id'
import type {
  CollectionSource,
  ContentMapper,
  DocumentExporter,
  SlugReservationSource,
  SnapshotStore,
} from '../ports.ts'
import { runWithConcurrency } from '../run-with-concurrency/index.ts'
import {
  classifySyncFailure,
  SyncFailure,
  withSyncFailure,
} from '../sync-failure/index.ts'
import type { ContentIdentity } from '../../domain/content/index.ts'

const DEFAULT_CONCURRENCY = 3
export interface PublicationSafetyPolicy {
  allowLargeReduction: boolean
  baselineDocuments: number
  maximumDropRatio: number
}

interface SyncCollectionCommand {
  publicationSafety: PublicationSafetyPolicy
  sourceId: string
}

interface SyncCollectionDependencies<TSource, TScope> {
  concurrency?: number
  exporter: DocumentExporter<TSource, TScope>
  mapper: ContentMapper<TSource>
  reservations: SlugReservationSource
  snapshots: SnapshotStore<TScope>
  source: CollectionSource<TSource>
}

interface MappedSource<TSource> {
  identity: ContentIdentity
  source: TSource
}

export async function syncCollection<TSource, TScope>(
  command: SyncCollectionCommand,
  dependencies: SyncCollectionDependencies<TSource, TScope>,
): Promise<number> {
  const sources = await withSyncFailure(
    'SOURCE_READ_FAILED',
    () => dependencies.source.list(command.sourceId),
  )
  const publicSources = mapPublicSources(sources, dependencies.mapper)

  assertSafeSnapshot(
    sources.length,
    publicSources,
    command.publicationSafety,
  )
  assertAvailableSlugs(
    publicSources,
    await withSyncFailure(
      'SOURCE_READ_FAILED',
      () => dependencies.reservations.list(),
    ),
  )

  await withSyncFailure(
    'SNAPSHOT_WRITE_FAILED',
    () => dependencies.snapshots.replace(
      scope => runWithConcurrency(
        publicSources,
        dependencies.concurrency ?? DEFAULT_CONCURRENCY,
        ({ identity, source }) => dependencies.exporter.export({
          identity,
          scope,
          source,
        }),
      ),
    ),
  )

  return publicSources.length
}

function mapPublicSources<TSource>(
  sources: readonly TSource[],
  mapper: ContentMapper<TSource>,
): MappedSource<TSource>[] {
  try {
    return sources.flatMap(source => {
      if (!mapper.isPublished(source)) return []

      return [{
        source,
        identity: validateMappedContent(mapper.map(source)),
      }]
    })
  } catch (cause) {
    throw classifySyncFailure('INVALID_PUBLIC_CONTENT', cause)
  }
}

function validateMappedContent(identity: ContentIdentity): ContentIdentity {
  return {
    ...identity,
    slug: createContentId(identity.slug),
    metadata: parsePublicContentMetadata(identity.metadata),
  }
}

function assertAvailableSlugs<TSource>(
  sources: MappedSource<TSource>[],
  reservedSlugs: ReadonlySet<string>,
): void {
  const collision = sources.find(({ identity }) => reservedSlugs.has(identity.slug))
  if (collision) {
    throw new SyncFailure('RESERVED_SLUG')
  }
}

function assertSafeSnapshot<TSource>(
  sourceCount: number,
  sources: MappedSource<TSource>[],
  policy: PublicationSafetyPolicy,
): void {
  assertSourceRows(sourceCount)
  assertPublicRows(sources.length)
  assertPublicationCount(sources.length, policy)
  assertUniqueSlugs(sources)
}

function assertSourceRows(sourceCount: number): void {
  if (sourceCount === 0) {
    throw new SyncFailure('NO_SOURCE_ROWS')
  }
}

function assertPublicRows(documentCount: number): void {
  if (documentCount === 0) {
    throw new SyncFailure('NO_PUBLIC_ROWS')
  }
}

function assertUniqueSlugs<TSource>(sources: MappedSource<TSource>[]): void {
  const slugs = new Set<string>()
  for (const { identity } of sources) {
    if (slugs.has(identity.slug)) {
      throw new SyncFailure('DUPLICATE_SLUG')
    }
    slugs.add(identity.slug)
  }
}

function assertPublicationCount(
  documentCount: number,
  policy: PublicationSafetyPolicy,
): void {
  if (policy.allowLargeReduction) return

  const requiredDocuments = getRequiredDocumentCount(policy)
  if (documentCount >= requiredDocuments) return

  throw new SyncFailure('UNSAFE_REDUCTION')
}

function getRequiredDocumentCount(policy: PublicationSafetyPolicy): number {
  return Math.ceil(policy.baselineDocuments * (1 - policy.maximumDropRatio))
}
