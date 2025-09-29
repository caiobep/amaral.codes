import { convertPageObjectToBlogpostHeader } from '../../mappers/convertPageObjectToBlogpost.ts'
import { notionApiClient } from '../../configuration/index.ts'
import environment from '../../../../infrastructure/environment.ts'
import type { Blogpost } from '../../../../domain/blogpost.ts'
import { getTagNameAndIcon } from '../getTagById/index.ts'
import { createNotionMarkdownExporter } from '../getPageContentsInMarkdown.ts'

type BlogpostPageResponse = Parameters<
  typeof convertPageObjectToBlogpostHeader
>[0]

type QueryDatabaseResponse = {
  results: Array<unknown>
  next_cursor: string | null
}

export type GetBlogpostPagesOptions = {
  startCursor?: string
  databaseId?: string
  tagId?: string | null
  notionClient?: typeof notionApiClient
}

export async function getBlogpostPages({
  startCursor,
  databaseId = environment.NOTION_BLOG_DATABASE,
  tagId = environment.NOTION_BLOG_TAG,
  notionClient = notionApiClient,
}: GetBlogpostPagesOptions = {}): Promise<QueryDatabaseResponse> {
  const path = `databases/${databaseId}/query`
  const body: Record<string, unknown> = {
    ...(startCursor && { start_cursor: startCursor }),
  }

  if (tagId) {
    body.filter = {
      property: 'Tags',
      relation: { contains: tagId },
    }
  }

  const { results, next_cursor: apiNextCursor } =
    await notionClient.request<QueryDatabaseResponse>({
      path,
      method: 'post',
      body,
    })

  return { results, next_cursor: apiNextCursor ?? null }
}

export type GetAllBlogpostPageMetadataOptions = Omit<
  GetBlogpostPagesOptions,
  'startCursor'
>

export type GetAllBlogpostPageMetadataReturn = Omit<
  Blogpost,
  'content' | 'tags'
> & { tagIds: string[] }

export async function getAllBlogpostPageMetadata(
  options: GetAllBlogpostPageMetadataOptions = {},
): Promise<Array<GetAllBlogpostPageMetadataReturn>> {
  const pagesInMemory: BlogpostPageResponse[] = []

  let nextCursor: string | null = null
  do {
    const pages = await getBlogpostPages({
      ...options,
      startCursor: nextCursor ?? undefined,
    })
    pagesInMemory.push(...(pages?.results as BlogpostPageResponse[]))
    nextCursor = pages?.next_cursor || null
  } while (nextCursor !== null)

  return pagesInMemory.map(mapPageToMetadata)
}

export async function getBlogpostMetadataById(
  pageId: string,
  notionClient: typeof notionApiClient = notionApiClient,
): Promise<GetAllBlogpostPageMetadataReturn> {
  const page = (await notionClient.pages.retrieve({
    page_id: pageId,
  })) as unknown as BlogpostPageResponse

  return mapPageToMetadata(page)
}

export async function getBlogpostById(
  pageId: string,
  notionClient: typeof notionApiClient = notionApiClient,
): Promise<Blogpost> {
  const pageMetadata = await getBlogpostMetadataById(pageId, notionClient)
  const getPageContentInMd = await createNotionMarkdownExporter()
  const content = await getPageContentInMd(pageId)
  const tags = await Promise.all(pageMetadata.tagIds.map(getTagNameAndIcon))

  return {
    id: pageMetadata.id,
    title: pageMetadata.title,
    summary: pageMetadata.summary,
    date: pageMetadata.date,
    readTime: pageMetadata.readTime,
    content,
    tags,
  }
}

function mapPageToMetadata(
  page: BlogpostPageResponse,
): GetAllBlogpostPageMetadataReturn {
  return {
    ...convertPageObjectToBlogpostHeader(page),
    tagIds: page?.properties?.Tags?.relation?.map(t => t?.id) ?? [],
  }
}
