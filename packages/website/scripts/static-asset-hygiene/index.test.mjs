import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, it } from 'vitest'
import {
  STATIC_ASSET_BUDGETS,
  auditStaticAssets,
  collectStaticAssets,
} from './index.mjs'

const temporaryDirectories = []

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => (
    fs.rm(directory, { recursive: true, force: true })
  )))
})

describe('collectStaticAssets', () => {
  it('collects nested files with normalized paths, sizes, and content digests', async () => {
    const directory = await createTemporaryDirectory()
    await fs.mkdir(path.join(directory, 'nested'))
    await fs.writeFile(path.join(directory, 'first.txt'), 'same')
    await fs.writeFile(path.join(directory, 'nested', 'second.txt'), 'same')

    const files = (await collectStaticAssets(directory))
      .sort((left, right) => left.filePath.localeCompare(right.filePath))

    assert.deepEqual(files.map(({ filePath, size }) => ({ filePath, size })), [
      { filePath: 'first.txt', size: 4 },
      { filePath: 'nested/second.txt', size: 4 },
    ])
    assert.equal(files[0].digest, files[1].digest)
  })
})

describe('auditStaticAssets', () => {
  it('accepts assets at each budget boundary', () => {
    const files = Array.from({ length: 6 }, (_, index) => (
      file(`${index}.bin`, STATIC_ASSET_BUDGETS.maxFileBytes, `${index}`)
    ))
    const audit = auditStaticAssets(files)

    assert.deepEqual(audit.violations, [])
    assert.equal(audit.totalBytes, STATIC_ASSET_BUDGETS.maxAggregateBytes)
  })

  it('reports an aggregate overage independently', () => {
    const files = Array.from({ length: 7 }, (_, index) => (
      file(`${index}.bin`, STATIC_ASSET_BUDGETS.maxFileBytes, `${index}`)
    ))
    const audit = auditStaticAssets(files)

    assert.deepEqual(audit.violations.map(({ kind }) => kind), ['aggregate'])
  })

  it('reports a per-file overage independently', () => {
    const audit = auditStaticAssets([
      file('large.bin', STATIC_ASSET_BUDGETS.maxFileBytes + 1, 'large'),
    ])

    assert.deepEqual(audit.violations.map(({ kind }) => kind), ['file'])
    assert.equal(audit.oversizedFiles[0].filePath, 'large.bin')
  })

  it('counts only redundant copies against the duplicate budget', () => {
    const duplicateSize = STATIC_ASSET_BUDGETS.maxDuplicateBytes
    const audit = auditStaticAssets([
      file('one.svg', duplicateSize, 'same'),
      file('two.svg', duplicateSize, 'same'),
      file('different.svg', duplicateSize, 'different'),
    ])

    assert.deepEqual(audit.violations, [])
    assert.equal(audit.duplicateBytes, duplicateSize)
    assert.deepEqual(audit.duplicateGroups[0].filePaths, ['one.svg', 'two.svg'])
  })

  it('reports duplicate copies over budget', () => {
    const duplicateSize = STATIC_ASSET_BUDGETS.maxDuplicateBytes + 1
    const audit = auditStaticAssets([
      file('one.svg', duplicateSize, 'same'),
      file('two.svg', duplicateSize, 'same'),
    ])

    assert.deepEqual(audit.violations.map(({ kind }) => kind), ['duplicate'])
  })
})

async function createTemporaryDirectory() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'static-asset-hygiene-'))
  temporaryDirectories.push(directory)
  return directory
}

function file(filePath, size, digest) {
  return { filePath, size, digest }
}
