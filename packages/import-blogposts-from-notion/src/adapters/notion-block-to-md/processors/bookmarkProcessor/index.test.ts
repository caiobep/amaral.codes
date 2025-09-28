import test from 'node:test'
import assert from 'node:assert/strict'
import { bookmarkToInlineLinkMentionProcessor } from './index.ts'

test('bookmarkProcessor renders markdown link with caption', async () => {
  const block = {
    bookmark: {
      url: 'https://example.com',
      caption: [],
    },
  }

  const result = await bookmarkToInlineLinkMentionProcessor(block as any, {
    blockToMarkdown: async () => 'Example Site',
  } as any)

  assert.equal(result, '[Example Site](https://example.com)')
})

test('bookmarkProcessor falls back to url when caption is empty', async () => {
  const block = {
    bookmark: {
      url: 'https://example.com',
      caption: [],
    },
  }

  const result = await bookmarkToInlineLinkMentionProcessor(block as any, {
    blockToMarkdown: async () => '',
  } as any)

  assert.equal(result, '[https://example.com](https://example.com)')
})
