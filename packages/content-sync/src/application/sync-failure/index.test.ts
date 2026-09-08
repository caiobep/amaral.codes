import assert from 'node:assert/strict'
import { test } from 'vitest'
import {
  classifySyncFailure,
  SyncFailure,
  withSyncFailure,
} from './index.ts'

test('classifies an unknown failure without exposing its message', async () => {
  const privateFailure = new Error(
    'Invalid private page https://notion.so/unpublished-workplace-note',
  )

  const failure = await withSyncFailure(
    'INVALID_PUBLIC_CONTENT',
    () => Promise.reject(privateFailure),
  ).catch((error: unknown) => error)

  assert.ok(failure instanceof SyncFailure)
  assert.equal(failure.code, 'INVALID_PUBLIC_CONTENT')
  assert.equal(
    failure.message,
    'Public content does not satisfy the publishing contract.',
  )
  assert.equal(failure.cause, privateFailure)
})

test('preserves the first classified failure across boundaries', () => {
  const failure = new SyncFailure('NO_SOURCE_ROWS')

  assert.equal(classifySyncFailure('SNAPSHOT_WRITE_FAILED', failure), failure)
})
