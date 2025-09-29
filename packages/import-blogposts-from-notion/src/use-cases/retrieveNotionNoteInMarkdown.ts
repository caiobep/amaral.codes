import {
  createNotionMarkdownExporter,
  getBlogpostMetadataById,
  getTagNameAndIcon,
} from '../adapters/notion-api/use-cases/index.ts'
import type { Blogpost } from '../domain/blogpost.ts'
import { normalizeNotionPageIdOrUrl } from '../adapters/notion-api/use-cases/normalizeNotionPageIdOrUrl.ts'
import { renderRecordAsMarkdownWithMetadata } from '../adapters/notion-block-to-md/index.ts'

export async function getBlogpostById(pageId: string): Promise<Omit<Blogpost, 'content'>> {
  const pageMetadata = await getBlogpostMetadataById(pageId)
  const tags = await Promise.all(pageMetadata.tagIds.map(getTagNameAndIcon))

  return {
    id: pageMetadata.id,
    title: pageMetadata.title,
    summary: pageMetadata.summary,
    date: pageMetadata.date,
    readTime: pageMetadata.readTime,
    tags,
  }
}
export async function retrieveNotionNoteInMarkdown(
  noteId: string,
): Promise<string> {
  const normalizedId = normalizeNotionPageIdOrUrl(noteId)

  const blogpost = await getBlogpostById(normalizedId)
  const getPageContentInMd = await createNotionMarkdownExporter()

  try {
    const content = await getPageContentInMd(normalizedId)
    const { title, ...metadata } = blogpost
    return renderRecordAsMarkdownWithMetadata({
      header: title,
      metadata,
      content,
    })
  } catch (err) {
    console.error(err)
  }
}
