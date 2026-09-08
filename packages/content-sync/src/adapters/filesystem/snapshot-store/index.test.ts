import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'vitest'
import {
  createFilesystemSnapshotStore,
  isMissingPathError,
  replaceDirectoryAtomically,
} from './index.ts'

test('recognizes only missing-path filesystem errors', () => {
  assert.equal(isMissingPathError(Object.assign(new Error('missing'), { code: 'ENOENT' })), true)
  assert.equal(isMissingPathError(Object.assign(new Error('denied'), { code: 'EACCES' })), false)
  assert.equal(isMissingPathError('ENOENT'), false)
})

test('creates a snapshot when no previous directory exists', async ({ onTestFinished }) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'snapshot-new-'))
  onTestFinished(() => fs.rm(root, { recursive: true, force: true }))
  const destination = path.join(root, 'generated')

  await replaceDirectoryAtomically(destination, async staging => {
    await fs.writeFile(path.join(staging, 'new.md'), 'new')
  })

  assert.equal(await fs.readFile(path.join(destination, 'new.md'), 'utf8'), 'new')
})

test('keeps swap artifacts inside the generated work directory', async ({ onTestFinished }) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'snapshot-work-root-'))
  onTestFinished(() => fs.rm(root, { recursive: true, force: true }))
  const destination = path.join(root, 'synced')
  let stagingDirectory = ''

  await replaceDirectoryAtomically(destination, async staging => {
    stagingDirectory = staging
    await fs.writeFile(path.join(staging, 'new.md'), 'new')
  })

  assert.equal(
    stagingDirectory,
    path.join(root, '.publication-snapshots', 'synced.staging'),
  )
  await assert.rejects(fs.access(path.join(root, '.synced.staging')))
  await assert.rejects(fs.access(path.join(root, '.synced.backup')))
})

test('binds the destination behind the snapshot scope', async ({ onTestFinished }) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'snapshot-bound-'))
  onTestFinished(() => fs.rm(root, { recursive: true, force: true }))
  const destination = path.join(root, 'generated')

  await createFilesystemSnapshotStore(destination).replace(async scope => {
    await fs.writeFile(path.join(scope, 'new.md'), 'new')
  })

  assert.equal(await fs.readFile(path.join(destination, 'new.md'), 'utf8'), 'new')
})

test('atomically replaces a completed directory', async ({ onTestFinished }) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'notion-atomic-'))
  onTestFinished(() => fs.rm(root, { recursive: true, force: true }))
  const destination = path.join(root, 'posts')
  await fs.mkdir(destination)
  await fs.writeFile(path.join(destination, 'old.md'), 'old')

  await replaceDirectoryAtomically(destination, async stagingDirectory => {
    await fs.writeFile(path.join(stagingDirectory, 'new.md'), 'new')
  })

  assert.deepEqual(await fs.readdir(destination), ['new.md'])
})

test('keeps the original directory when staging fails', async ({ onTestFinished }) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'notion-rollback-'))
  onTestFinished(() => fs.rm(root, { recursive: true, force: true }))
  const destination = path.join(root, 'posts')
  await fs.mkdir(destination)
  await fs.writeFile(path.join(destination, 'existing.md'), 'existing')

  await assert.rejects(
    replaceDirectoryAtomically(destination, async stagingDirectory => {
      await fs.writeFile(path.join(stagingDirectory, 'partial.md'), 'partial')
      throw new Error('sync failed')
    }),
    /sync failed/,
  )

  assert.deepEqual(await fs.readdir(destination), ['existing.md'])
})

test('restores the original directory when the final swap fails', async ({ onTestFinished }) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'snapshot-rollback-'))
  onTestFinished(() => fs.rm(root, { recursive: true, force: true }))
  const destination = path.join(root, 'generated')
  await fs.mkdir(destination)
  await fs.writeFile(path.join(destination, 'old.md'), 'old')

  await assert.rejects(replaceDirectoryAtomically(destination, async staging => {
    await fs.writeFile(path.join(staging, 'new.md'), 'new')
    await fs.rm(staging, { recursive: true })
  }))

  assert.equal(await fs.readFile(path.join(destination, 'old.md'), 'utf8'), 'old')
  await assert.rejects(fs.access(path.join(destination, 'new.md')))
})

test('recovers a backup left before the final snapshot rename', async ({ onTestFinished }) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'snapshot-recover-backup-'))
  onTestFinished(() => fs.rm(root, { recursive: true, force: true }))
  const destination = path.join(root, 'generated')
  const workDirectory = path.join(root, '.publication-snapshots')
  const backup = path.join(workDirectory, 'generated.backup')
  const staging = path.join(workDirectory, 'generated.staging')
  await fs.mkdir(workDirectory)
  await fs.mkdir(backup)
  await fs.writeFile(path.join(backup, 'old.md'), 'old')
  await fs.mkdir(staging)
  await fs.writeFile(path.join(staging, 'partial.md'), 'partial')

  await assert.rejects(
    replaceDirectoryAtomically(
      destination,
      () => Promise.reject(new Error('next sync failed')),
    ),
    /next sync failed/,
  )

  assert.equal(await fs.readFile(path.join(destination, 'old.md'), 'utf8'), 'old')
  await assert.rejects(fs.access(backup))
  await assert.rejects(fs.access(staging))
})

test('recovers a legacy sibling backup during migration', async ({ onTestFinished }) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'snapshot-recover-legacy-'))
  onTestFinished(() => fs.rm(root, { recursive: true, force: true }))
  const destination = path.join(root, 'synced')
  const legacyBackup = path.join(root, '.synced.backup')
  const legacyStaging = path.join(root, '.synced.staging')
  await fs.mkdir(legacyBackup)
  await fs.writeFile(path.join(legacyBackup, 'old.md'), 'old')
  await fs.mkdir(legacyStaging)
  await fs.writeFile(path.join(legacyStaging, 'partial.md'), 'partial')

  await assert.rejects(
    replaceDirectoryAtomically(
      destination,
      () => Promise.reject(new Error('next sync failed')),
    ),
    /next sync failed/,
  )

  assert.equal(await fs.readFile(path.join(destination, 'old.md'), 'utf8'), 'old')
  await assert.rejects(fs.access(legacyBackup))
  await assert.rejects(fs.access(legacyStaging))
})

test('keeps a committed snapshot when backup cleanup was interrupted', async ({ onTestFinished }) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'snapshot-recover-commit-'))
  onTestFinished(() => fs.rm(root, { recursive: true, force: true }))
  const destination = path.join(root, 'generated')
  const workDirectory = path.join(root, '.publication-snapshots')
  const backup = path.join(workDirectory, 'generated.backup')
  await fs.mkdir(destination)
  await fs.writeFile(path.join(destination, 'new.md'), 'new')
  await fs.mkdir(workDirectory)
  await fs.mkdir(backup)
  await fs.writeFile(path.join(backup, 'old.md'), 'old')

  await assert.rejects(
    replaceDirectoryAtomically(
      destination,
      () => Promise.reject(new Error('next sync failed')),
    ),
    /next sync failed/,
  )

  assert.equal(await fs.readFile(path.join(destination, 'new.md'), 'utf8'), 'new')
  await assert.rejects(fs.access(backup))
})
