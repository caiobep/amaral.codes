import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { planCollectionMigration, applyCollectionMigration } from './migrate-collections.mjs'

test('migration is dry-run first, preserves backups and refuses stale edits or existing destinations', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'publishing-migration-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  const file = path.join(directory, 'entries/notes/example.md')
  const raw = "---\ntitle: Example\ndate: '2026-10-19'\ncategory: note\n---\nUntouched body\n"
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, raw)
  const changes = await planCollectionMigration(directory)
  assert.equal(await fs.readFile(file, 'utf8'), raw)
  await fs.writeFile(file, raw + 'Edited after review\n')
  await assert.rejects(applyCollectionMigration(directory, changes, path.join(directory, 'backup')), /Entry changed since review/u)
  await fs.writeFile(file, raw)
  await applyCollectionMigration(directory, changes, path.join(directory, 'backup'))
  assert.equal(await fs.readFile(path.join(directory, 'backup/entries/notes/example.md'), 'utf8'), raw)
  assert((await fs.readFile(path.join(directory, 'entries/posts/example.md'), 'utf8')).endsWith('Untouched body\n'))
  await assert.rejects(planCollectionMigration(directory), /already been migrated/u)
})
