import assert from 'node:assert/strict'
import { test } from 'vitest'
import { createNotionFileSourceResolver } from './index.ts'

test('resolves Notion file metadata through the current block URL', async () => {
  const source = `file://${encodeURIComponent(JSON.stringify({
    permissionRecord: { id: 'block-1' },
  }))}`
  const resolve = createNotionFileSourceResolver({
    blocks: {
      retrieve: () => Promise.resolve({
        id: 'block-1',
        parent: { type: 'page_id', page_id: 'page-1' },
        type: 'file',
        file: { file: { url: 'https://files.notion.so/slides' } },
      }),
    },
  } as never, 'page-1')

  assert.equal(await resolve(source), 'https://files.notion.so/slides')
  assert.equal(await resolve('https://example.com/file'), 'https://example.com/file')
})

test('resolves an owned external file block', async () => {
  const resolve = createNotionFileSourceResolver({
    blocks: {
      retrieve: () => Promise.resolve({
        id: 'block-1',
        parent: { type: 'page_id', page_id: 'page-1' },
        type: 'file',
        file: { external: { url: 'https://example.com/slides.pdf' } },
      }),
    },
  } as never, 'page-1')

  assert.equal(
    await resolve(notionFileSource('block-1')),
    'https://example.com/slides.pdf',
  )
})

test('rejects malformed and incomplete Notion file metadata', async () => {
  const encoded = encodeURIComponent(JSON.stringify({ permissionRecord: { id: 'block-1' } }))
  const resolveWith = (retrieve: () => Promise<unknown>) => createNotionFileSourceResolver({
    blocks: { retrieve },
  } as never, 'page-1')

  await assert.rejects(resolveWith(() => Promise.resolve({}))('file://invalid'), /Could not parse/)
  await assert.rejects(
    resolveWith(() => Promise.resolve({ object: 'block' }))(`file://${encoded}`),
    /partial block/,
  )
  await assert.rejects(
    resolveWith(() => Promise.resolve({
      id: 'block-1',
      parent: { type: 'page_id', page_id: 'page-1' },
      type: 'file',
      file: {},
    }))(`file://${encoded}`),
    /did not return a file URL/,
  )
})

test('resolves a file owned through nested block ancestry', async () => {
  const source = notionFileSource('file-block')
  const blocks = new Map<string, unknown>([
    ['file-block', {
      id: 'file-block',
      parent: { type: 'block_id', block_id: 'container-2' },
      type: 'file',
      file: { file: { url: 'https://files.notion.so/nested' } },
    }],
    ['container-2', {
      id: 'container-2',
      parent: { type: 'block_id', block_id: 'container-1' },
      type: 'column',
      column: {},
    }],
    ['container-1', {
      id: 'container-1',
      parent: { type: 'page_id', page_id: 'source-page' },
      type: 'column_list',
      column_list: {},
    }],
  ])
  const resolve = createNotionFileSourceResolver({
    blocks: {
      retrieve: ({ block_id }: { block_id: string }) => Promise.resolve(blocks.get(block_id)),
    },
  } as never, 'source-page')

  assert.equal(await resolve(source), 'https://files.notion.so/nested')
})

test('rejects a file block owned by a different page', async () => {
  const resolve = createNotionFileSourceResolver({
    blocks: {
      retrieve: () => Promise.resolve({
        id: 'file-block',
        parent: { type: 'page_id', page_id: 'other-page' },
        type: 'file',
        file: { file: { url: 'https://files.notion.so/private' } },
      }),
    },
  } as never, 'source-page')

  await assert.rejects(
    resolve(notionFileSource('file-block')),
    /does not belong to its source page/,
  )
})

function notionFileSource(blockId: string): string {
  return `file://${encodeURIComponent(JSON.stringify({
    permissionRecord: { id: blockId },
  }))}`
}
