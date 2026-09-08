import fs from 'node:fs/promises'
import path from 'node:path'
import type { SnapshotStore } from '../../../application/ports.ts'

export function createFilesystemSnapshotStore(
  destination: string,
): SnapshotStore<string> {
  return {
    replace: writeSnapshot => replaceDirectoryAtomically(
      destination,
      writeSnapshot,
    ),
  }
}

type DirectoryWriter = (stagingDirectory: string) => Promise<void>

const SNAPSHOT_WORK_DIRECTORY = '.publication-snapshots'

interface SnapshotDirectories {
  resolvedDestination: string
  workDirectory: string
  backupDirectory: string
  stagingDirectory: string
  legacyBackupDirectory: string
  legacyStagingDirectory: string
}

export function getSnapshotDirectories(destination: string): SnapshotDirectories {
  const resolvedDestination = path.resolve(destination)
  const parentDirectory = path.dirname(resolvedDestination)
  const directoryName = path.basename(resolvedDestination)
  const workDirectory = path.join(parentDirectory, SNAPSHOT_WORK_DIRECTORY)

  return {
    resolvedDestination,
    workDirectory,
    backupDirectory: path.join(workDirectory, `${directoryName}.backup`),
    stagingDirectory: path.join(workDirectory, `${directoryName}.staging`),
    legacyBackupDirectory: path.join(parentDirectory, `.${directoryName}.backup`),
    legacyStagingDirectory: path.join(parentDirectory, `.${directoryName}.staging`),
  }
}

export async function replaceDirectoryAtomically(
  destination: string,
  writeDirectory: DirectoryWriter,
): Promise<void> {
  const {
    resolvedDestination,
    workDirectory,
    backupDirectory,
    stagingDirectory,
    legacyBackupDirectory,
    legacyStagingDirectory,
  } = getSnapshotDirectories(destination)

  await fs.mkdir(workDirectory, { recursive: true })
  await recoverInterruptedSwap(
    resolvedDestination,
    stagingDirectory,
    backupDirectory,
  )
  await recoverInterruptedSwap(
    resolvedDestination,
    legacyStagingDirectory,
    legacyBackupDirectory,
  )
  await fs.mkdir(stagingDirectory)
  let hasBackup = false

  try {
    await writeDirectory(stagingDirectory)
    hasBackup = await renameIfPresent(resolvedDestination, backupDirectory)
    await fs.rename(stagingDirectory, resolvedDestination)
  } catch (error) {
    await fs.rm(stagingDirectory, { recursive: true, force: true })
    if (hasBackup) await restoreBackup(backupDirectory, resolvedDestination)
    throw error
  }

  if (hasBackup) {
    await fs.rm(backupDirectory, { recursive: true, force: true })
  }
}

async function recoverInterruptedSwap(
  destination: string,
  staging: string,
  backup: string,
): Promise<void> {
  if (await pathExists(backup)) {
    if (await pathExists(destination)) {
      await fs.rm(backup, { recursive: true })
    } else {
      await fs.rename(backup, destination)
    }
  }
  await fs.rm(staging, { recursive: true, force: true })
}

async function pathExists(candidate: string): Promise<boolean> {
  try {
    await fs.access(candidate)
    return true
  } catch (error) {
    if (isMissingPathError(error)) return false
    throw error
  }
}

async function renameIfPresent(source: string, destination: string): Promise<boolean> {
  try {
    await fs.rename(source, destination)
    return true
  } catch (error) {
    if (isMissingPathError(error)) return false
    throw error
  }
}

async function restoreBackup(backup: string, destination: string): Promise<void> {
  await fs.rm(destination, { recursive: true, force: true })
  await fs.rename(backup, destination)
}

export function isMissingPathError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}
