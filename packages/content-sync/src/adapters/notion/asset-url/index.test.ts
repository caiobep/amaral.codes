import assert from 'node:assert/strict'
import { test } from 'vitest'
import { isTrustedNotionAssetUrl } from './index.ts'

test('trusts secure Notion and AWS storage hosts without accepting lookalikes', () => {
  assert.equal(isTrustedNotionAssetUrl('https://files.notion.so/image.png'), true)
  assert.equal(isTrustedNotionAssetUrl('https://bucket.s3.amazonaws.com/image.png'), true)
  assert.equal(isTrustedNotionAssetUrl('https://secure.notion-static.com/image.png'), true)
  assert.equal(isTrustedNotionAssetUrl('https://notion.so.attacker.example/image.png'), false)
  assert.equal(isTrustedNotionAssetUrl('http://files.notion.so/image.png'), false)
  assert.equal(isTrustedNotionAssetUrl('https://user:secret@files.notion.so/image.png'), false)
})
