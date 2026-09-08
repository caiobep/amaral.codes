import assert from 'node:assert/strict'
import { test } from 'vitest'
import { createNotionClient } from './index.ts'

test('creates the configured Notion adapter', () => {
  const client = createNotionClient('secret-test-token')

  assert.equal(typeof client.pages.retrieve, 'function')
  assert.equal(typeof client.dataSources.query, 'function')
})
