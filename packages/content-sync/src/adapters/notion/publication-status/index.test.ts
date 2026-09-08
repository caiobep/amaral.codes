import assert from 'node:assert/strict'
import { test } from 'vitest'
import { isPublishedNotionStatus } from './index.ts'

test('accepts only the Published source status', () => {
  assert.equal(isPublishedNotionStatus(' Published '), true)
  assert.equal(isPublishedNotionStatus('Done'), false)
  assert.equal(isPublishedNotionStatus('Archive'), false)
  assert.equal(isPublishedNotionStatus('Draft'), false)
  assert.equal(isPublishedNotionStatus(undefined), false)
})
