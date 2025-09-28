import test from 'node:test'
import assert from 'node:assert/strict'
import { exportPagesToMarkdown } from './index.ts'
import type { PageExportInput } from './index.ts'
import type { BlogpostFileWriterOptions } from '../../adapters/filesystem/use-cases/writeBlogpostsInFs.ts'

const basePage: PageExportInput = {
  id: 'page-123',
  title: 'My Post',
  date: '2024-01-01',
  summary: 'Summary',
  readTime: '5 min',
  tagIds: ['tag-1'],
}

test('exportPagesToMarkdown writes pages using provided dependencies', async () => {
  const recorded: any[] = []
  let writerOptions: BlogpostFileWriterOptions | undefined

  const dependencies = {
    createFileWriter: async (_destination: string, options: any) => {
      writerOptions = options
      return async (blogpost: any) => {
        recorded.push(blogpost)
      }
    },
    createMarkdownExporter: async () => async () => '# content',
    getTagNameAndIcon: async (tagId: string) => ({
      id: tagId,
      name: `Tag ${tagId}`,
      icon: '🔥',
    }),
    createProcessors: (_ctx: any) => ({}),
  }

  const result = await exportPagesToMarkdown([basePage], {
    destinationPath: './out',
    cleanDestination: false,
  }, dependencies)

  assert.equal(result.length, 1)
  assert.equal(result[0].content, '# content')

  assert.equal(recorded.length, 1)
  assert.equal(recorded[0].content, '# content')
  assert.deepEqual(recorded[0].tags, [
    { id: 'tag-1', name: 'Tag tag-1', icon: '🔥' },
  ])
  assert.equal(writerOptions?.clean, false)
})

test('exportPagesToMarkdown skips work when no pages are provided', async () => {
  let called = false
  const dependencies = {
    createFileWriter: async () => {
      called = true
      return async () => {}
    },
    createMarkdownExporter: async () => async () => '',
    getTagNameAndIcon: async () => ({ id: 'tag', name: 'Tag', icon: '' }),
    createProcessors: (_ctx: any) => ({}),
  }

  const result = await exportPagesToMarkdown([], {
    destinationPath: './out',
  }, dependencies)

  assert.equal(result.length, 0)
  assert.equal(called, false)
})

test('exportPagesToMarkdown returns data without touching filesystem when writeToFs is false', async () => {
  let fileWriterCalled = false
  let processorsConfig: any
  const dependencies = {
    createFileWriter: async () => {
      fileWriterCalled = true
      return async () => {}
    },
    createMarkdownExporter: async () => async () => '# content',
    getTagNameAndIcon: async () => ({ id: 'tag', name: 'Tag', icon: '' }),
    createProcessors: (ctx: any) => {
      processorsConfig = ctx
      return {}
    },
  }

  const result = await exportPagesToMarkdown([basePage], {
    writeToFs: false,
  }, dependencies)

  assert.equal(fileWriterCalled, false)
  assert.deepEqual(processorsConfig, { imageDir: undefined, writeToFs: false })
  assert.equal(result.length, 1)
  assert.equal(result[0].id, basePage.id)
  assert.equal(result[0].content, '# content')
})
