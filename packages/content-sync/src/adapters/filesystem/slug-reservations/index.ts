import fs from 'node:fs/promises'
import path from 'node:path'
import { createContentId } from '@amaral.codes/content-contract/content-id'
import type { SlugReservationSource } from '../../../application/ports.ts'
import { getSnapshotDirectories } from '../snapshot-store/index.ts'

interface FilesystemSlugReservationOptions {
  contentRoot: string
  syncedRoot: string
}

export function createFilesystemSlugReservations({
  contentRoot,
  syncedRoot,
}: FilesystemSlugReservationOptions): SlugReservationSource {
  const {
    resolvedDestination,
    workDirectory,
    legacyBackupDirectory,
    legacyStagingDirectory,
  } = getSnapshotDirectories(syncedRoot)
  const generatedRoots = new Set([
    resolvedDestination,
    workDirectory,
    legacyBackupDirectory,
    legacyStagingDirectory,
  ])

  return {
    list: async () => new Set(await listMarkdownSlugs(contentRoot, generatedRoots)),
  }
}

async function listMarkdownSlugs(
  directory: string,
  generatedRoots: ReadonlySet<string>,
): Promise<string[]> {
  if (generatedRoots.has(path.resolve(directory))) return []

  const entries = await fs.readdir(directory, { withFileTypes: true })
  const slugs = await Promise.all(entries.map(async entry => {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return await listMarkdownSlugs(entryPath, generatedRoots)
    if (entry.isFile() && path.extname(entry.name) === '.md') {
      return [createContentId(path.basename(entry.name, '.md'))]
    }
    return []
  }))
  return slugs.flat()
}
