import { createContentSync, type ContentSync } from '../composition-root/index.ts'
import {
  readConfiguration,
  type ContentSyncConfiguration,
} from '../configuration/index.ts'
import {
  COLLECTIONS,
  type CollectionName,
} from '../domain/content/index.ts'
import { SyncFailure } from '../application/sync-failure/index.ts'

interface CliDependencies {
  createSync: (configuration: ContentSyncConfiguration) => ContentSync
  log: (message: string) => void
  readConfig: (
    collections: readonly CollectionName[],
  ) => ContentSyncConfiguration
}

const DEFAULT_DEPENDENCIES: CliDependencies = {
  createSync: createContentSync,
  log: console.log,
  readConfig: readConfiguration,
}

export async function runCli(
  args: string[],
  dependencies: CliDependencies = DEFAULT_DEPENDENCIES,
): Promise<void> {
  const collections = readRequestedCollections(args)
  const contentSync = dependencies.createSync(
    dependencies.readConfig(collections),
  )

  for (const collection of collections) {
    const count = await syncPublicCollection(contentSync, collection)
    dependencies.log(`Synced ${String(count)} public ${collection}.`)
  }
}

async function syncPublicCollection(
  contentSync: ContentSync,
  collection: CollectionName,
): Promise<number> {
  try {
    return await contentSync.sync(collection)
  } catch (cause) {
    const reason = cause instanceof SyncFailure
      ? `[${cause.code}] ${cause.message}`
      : 'Unexpected content synchronization failure.'
    throw new Error(`Failed to sync public ${collection}: ${reason}`, { cause })
  }
}

function readRequestedCollections(args: string[]): CollectionName[] {
  const [command, target] = args
  if (command !== 'sync' || args.length > 2) throw usageError()

  return target === 'all'
    ? [...COLLECTIONS]
    : [readCollection(target)]
}

function readCollection(value: string | undefined): CollectionName {
  if (value === 'posts') return 'entries'
  if (value === 'entries' || value === 'podcasts' || value === 'projects') {
    return value
  }
  throw usageError(`Unknown content collection: ${value ?? '(missing)'}`)
}

function usageError(message?: string): Error {
  return new Error([
    message,
    'Usage: content-sync sync <entries|podcasts|projects|all>',
  ].filter(Boolean).join('\n'))
}
