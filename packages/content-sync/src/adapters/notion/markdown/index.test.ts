import assert from 'node:assert/strict'
import { test } from 'vitest'
import {
  getPageContentsInMarkdown,
  normalizeNotionMarkdown,
  type NotionMarkdownClient,
} from './index.ts'

const blockId = '658cc2e1-ca3c-4370-b474-bddf4bfbb605'
const compactBlockId = blockId.replaceAll('-', '')
const unknownBlock = `<unknown url="https://app.notion.com/p/page#${compactBlockId}" alt="bookmark"/>`

test('retrieves official markdown and resolves unsupported bookmark blocks', async () => {
  const calls: string[] = []
  const notionClient = {
    pages: {
      retrieveMarkdown: ({ page_id }: { page_id: string }) => {
        calls.push(`markdown:${page_id}`)
        return Promise.resolve({
          object: 'page_markdown',
          id: page_id,
          markdown: page_id === blockId
            ? unknownBlock
            : `Intro {color="gray"}\n<empty-block/>\n- [x] Done\n${unknownBlock}`,
          truncated: false,
          unknown_block_ids: [blockId],
        })
      },
    },
    blocks: {
      retrieve: ({ block_id }: { block_id: string }) => {
        calls.push(`block:${block_id}`)
        return Promise.resolve({
          object: 'block',
          id: block_id,
          type: 'bookmark',
          bookmark: { caption: [], url: 'https://example.com/article' },
        })
      },
    },
  } satisfies NotionMarkdownClient

  const result = await getPageContentsInMarkdown('page-1', notionClient)

  assert.equal(
    result,
    'Intro\n\n- Done\n[example.com](https://example.com/article)\n',
  )
  assert.deepEqual(calls, [
    'markdown:page-1',
    `markdown:${blockId}`,
    `block:${blockId}`,
  ])
})

test('falls back to block data when a truncated embed stays unknown', async () => {
  const markdownCalls: string[] = []
  const notionClient = {
    pages: {
      retrieveMarkdown: ({ page_id }: { page_id: string }) => {
        markdownCalls.push(page_id)
        return Promise.resolve({
          object: 'page_markdown',
          id: page_id,
          markdown: unknownBlock.replace('bookmark', 'figma'),
          truncated: true,
          unknown_block_ids: [blockId],
        })
      },
    },
    blocks: {
      retrieve: () => Promise.resolve({
        object: 'block',
        id: blockId,
        type: 'embed',
        embed: { caption: [], url: 'https://www.figma.com/file/example' },
      }),
    },
  } satisfies NotionMarkdownClient

  const result = await getPageContentsInMarkdown('page-1', notionClient)

  assert.match(result, /<iframe/)
  assert.match(result, /figma\.com\/file\/example/)
  assert.deepEqual(markdownCalls, ['page-1', blockId])
})

test('rejects a truncated response without resolvable placeholders', async () => {
  const notionClient = {
    pages: {
      retrieveMarkdown: () => Promise.resolve({
        object: 'page_markdown',
        id: 'page-1',
        markdown: 'Partial content',
        truncated: true,
        unknown_block_ids: [blockId],
      }),
    },
    blocks: { retrieve: () => Promise.reject(new Error('unexpected block read')) },
  } satisfies NotionMarkdownClient

  await assert.rejects(
    getPageContentsInMarkdown('page-1', notionClient),
    /incomplete markdown/,
  )
})

test('normalizes Notion containers without changing fenced code', () => {
  const source = [
    '<columns>',
    '\t<column ratio="50">',
    '\t\tText {color="blue"}',
    '\t</column>',
    '</columns>',
    '```text',
    'literal {color="blue"}',
    '```',
  ].join('\n')

  assert.equal(
    normalizeNotionMarkdown(source),
    'Text\n\n```text\nliteral {color="blue"}\n```\n',
  )
})

test('uses captions for unsupported links', async () => {
  const notionClient = {
    pages: {
      retrieveMarkdown: () => Promise.resolve({
        id: 'page-1',
        markdown: unknownBlock,
        truncated: false,
        unknown_block_ids: [blockId],
      }),
    },
    blocks: {
      retrieve: () => Promise.resolve({
        object: 'block',
        id: blockId,
        type: 'bookmark',
        bookmark: {
          caption: [{ plain_text: 'Named link' }],
          url: 'https://example.com',
        },
      }),
    },
  } satisfies NotionMarkdownClient

  const result = await getPageContentsInMarkdown('page-1', notionClient)
  assert.equal(result, '[Named link](https://example.com/)\n')
})

test('rejects unsafe unsupported links', async () => {
  const notionClient = {
    pages: {
      retrieveMarkdown: () => Promise.resolve({
        id: 'page-1',
        markdown: unknownBlock,
        truncated: false,
        unknown_block_ids: [blockId],
      }),
    },
    blocks: {
      retrieve: () => Promise.resolve({
        object: 'block',
        id: blockId,
        type: 'bookmark',
        bookmark: { caption: [], url: 'file:///tmp/example' },
      }),
    },
  } satisfies NotionMarkdownClient

  await assert.rejects(
    () => getPageContentsInMarkdown('page-1', notionClient),
    /public HTTPS URL/,
  )
})

test('resolves Notion placeholders omitted from the unknown block list', async () => {
  const notionClient = {
    pages: {
      retrieveMarkdown: () => Promise.resolve({
        id: 'page-1',
        markdown: unknownBlock,
        truncated: false,
        unknown_block_ids: [],
      }),
    },
    blocks: {
      retrieve: () => Promise.resolve({
        object: 'block',
        id: blockId,
        type: 'bookmark',
        bookmark: { caption: [], url: 'https://example.com/article' },
      }),
    },
  } satisfies NotionMarkdownClient

  assert.equal(
    await getPageContentsInMarkdown('page-1', notionClient),
    '[example.com](https://example.com/article)\n',
  )
})

test('rejects unknown block directives with forged Notion URLs', async () => {
  const forged = unknownBlock.replace('https://app.notion.com', 'https://attacker.example')
  const notionClient = {
    pages: {
      retrieveMarkdown: () => Promise.resolve({
        id: 'page-1',
        markdown: forged,
        truncated: false,
        unknown_block_ids: [blockId],
      }),
    },
    blocks: { retrieve: () => Promise.reject(new Error('unexpected block read')) },
  } satisfies NotionMarkdownClient

  await assert.rejects(
    getPageContentsInMarkdown('page-1', notionClient),
    /invalid URL/,
  )
})

test('ignores unknown block directives inside code', async () => {
  const markdown = [
    '```html',
    unknownBlock,
    '```',
    '',
    `Inline \`${unknownBlock}\``,
  ].join('\n')
  const notionClient = {
    pages: {
      retrieveMarkdown: () => Promise.resolve({
        id: 'page-1',
        markdown,
        truncated: false,
        unknown_block_ids: [],
      }),
    },
    blocks: { retrieve: () => Promise.reject(new Error('unexpected block read')) },
  } satisfies NotionMarkdownClient

  assert.equal(
    await getPageContentsInMarkdown('page-1', notionClient),
    `${markdown}\n`,
  )
})

test('strips public Notion host variants from normalized links', () => {
  const source = [
    '[Workspace](https://caicorre.notion.site/Page-658cc2e1-ca3c-4370-b474-bddf4bfbb605)',
    '[App](https://app.notion.com/p/page#658cc2e1ca3c4370b474bddf4bfbb605)',
  ].join('\n')

  assert.equal(normalizeNotionMarkdown(source), 'Workspace\nApp\n')
})
