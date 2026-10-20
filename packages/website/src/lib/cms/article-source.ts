import type { CollectionEntry } from 'astro:content'
import { isCmsEntry, type CmsArticleResult } from './entries'

export function shouldQueryCmsArticle(
  indexedEntry: CollectionEntry<'entries'> | undefined,
  hasPreview: boolean,
): boolean {
  return hasPreview || !!indexedEntry && isCmsEntry(indexedEntry)
}

export function selectCmsArticle(
  indexedEntry: CollectionEntry<'entries'> | undefined,
  article: CmsArticleResult | undefined,
): CmsArticleResult | undefined {
  return hasMatchingPreview(article) || indexedEntry && isCmsEntry(indexedEntry)
    ? article
    : undefined
}

function hasMatchingPreview(article: CmsArticleResult | undefined): boolean {
  return !!(article?.isPreview && article.entry && article.publicEntry)
}
