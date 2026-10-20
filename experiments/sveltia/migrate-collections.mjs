import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { migrateEntry, projectLocalizedEntries, legacyUrlRegistry } from './localization.mjs'

const hash = value => createHash('sha256').update(value).digest('hex')

export async function planCollectionMigration(repository, languageOverrides = {}) {
  await assert.rejects(fs.access(path.join(repository, 'publishing/legacy-urls.json')), { code: 'ENOENT' }, 'Repository has already been migrated')
  const changes = []
  const destinations = new Set()
  for await (const source of fs.glob('entries/**/*.md', { cwd: repository })) {
    const raw = await fs.readFile(path.join(repository, source), 'utf8')
    const change = migrateEntry(source, raw, languageOverrides[source])
    assert(!destinations.has(change.destination), `Duplicate migration destination: ${change.destination}`)
    destinations.add(change.destination)
    changes.push({ ...change, beforeHash: hash(raw), afterHash: hash(change.raw), bodyHash: hash(change.body) })
  }
  const projected = projectLocalizedEntries(new Map(changes.map(change => [change.destination, change.raw])), legacyUrlRegistry(changes))
  assert.equal(projected.routes.length, changes.length)
  assert(projected.routes.every(route => route.primary), 'Migration must preserve every original public URL')
  return changes
}

export async function applyCollectionMigration(repository, changes, backup) {
  const registry = path.join(repository, 'publishing/legacy-urls.json')
  await assert.rejects(fs.access(registry), { code: 'ENOENT' }, 'Repository has already been migrated')
  await fs.mkdir(backup, { recursive: true })
  for (const change of changes) {
    const original = await fs.readFile(path.join(repository, change.source), 'utf8')
    assert.equal(hash(original), change.beforeHash, `Entry changed since review: ${change.source}`)
    if (change.destination !== change.source) {
      await assert.rejects(fs.access(path.join(repository, change.destination)), { code: 'ENOENT' })
    }
  }
  await fs.writeFile(path.join(backup, 'manifest.json'), JSON.stringify(changes, null, 2), { flag: 'wx', mode: 0o600 })
  await fs.mkdir(path.dirname(registry), { recursive: true })
  await fs.writeFile(registry, JSON.stringify(legacyUrlRegistry(changes), null, 2) + '\n', { flag: 'wx' })
  for (const change of changes) {
    const original = path.join(repository, change.source)
    const preserved = path.join(backup, change.source)
    await fs.mkdir(path.dirname(preserved), { recursive: true })
    await fs.copyFile(original, preserved, fs.constants.COPYFILE_EXCL)
    const destination = path.join(repository, change.destination)
    await fs.mkdir(path.dirname(destination), { recursive: true })
    await fs.writeFile(destination, change.raw, { flag: change.destination === change.source ? 'w' : 'wx' })
    if (change.destination !== change.source) await fs.unlink(original)
  }
}
