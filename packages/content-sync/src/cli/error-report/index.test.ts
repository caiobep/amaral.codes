import assert from 'node:assert/strict'
import { test } from 'vitest'
import { formatCliError } from './index.ts'

test('redacts Notion identifiers, URLs, and credentials from CLI errors', () => {
  const message = formatCliError(new Error([
    'Failed page 12345678-1234-1234-1234-123456789abc',
    'https://notion.so/file?X-Amz-Signature=private',
    'secret_private-token',
  ].join(' ')))

  assert.equal(
    message,
    'Failed page [redacted ID] [redacted URL] [redacted credential]',
  )
})

test('does not expose arbitrary rejected values', () => {
  assert.equal(
    formatCliError({ private: true }),
    'Unknown content synchronization failure',
  )
})
