import type { CollectionEntry } from 'astro:content'
import { expect, it } from 'vitest'
import { selectCmsArticle, shouldQueryCmsArticle } from './article-source'
import { mapCmsEntry, type CmsArticleResult } from './entries'

const file: CollectionEntry<'entries'> = {
  id: 'existing-note', collection: 'entries', body: 'Existing file content',
  data: { title: 'Existing note', date: '2026-10-11', category: 'note', topics: [] },
}
const cms = mapCmsEntry({
  id: 'existing-note',
  data: { id: 'native-id', title: 'CMS note', category: 'note', date: '2026-10-11', content: [] },
})

function result(isPreview: boolean): CmsArticleResult {
  return { entry: { id: cms.id, data: {}, edit: {} }, isPreview, cacheHint: {}, publicEntry: cms, renderFields: undefined }
}

it('loads a signed CMS preview even when its slug belongs to a file-backed post', () => {
  const preview = result(true)
  expect(shouldQueryCmsArticle(file, true)).toBe(true)
  expect(selectCmsArticle(file, preview)).toBe(preview)
})

it('preserves the public file article for an invalid or unrelated preview token', () => {
  expect(shouldQueryCmsArticle(file, false)).toBe(false)
  expect(selectCmsArticle(file, result(false))).toBeUndefined()
  expect(selectCmsArticle(file, undefined)).toBeUndefined()
  expect(selectCmsArticle(file, { ...result(true), entry: null, publicEntry: undefined })).toBeUndefined()
})

it('retains native missing/error responses for indexed CMS articles', () => {
  const missing = { ...result(false), publicEntry: undefined }
  expect(shouldQueryCmsArticle(cms, false)).toBe(true)
  expect(selectCmsArticle(cms, missing)).toBe(missing)
  expect(selectCmsArticle(undefined, result(false))).toBeUndefined()
  expect(selectCmsArticle(undefined, result(true))?.isPreview).toBe(true)
})
