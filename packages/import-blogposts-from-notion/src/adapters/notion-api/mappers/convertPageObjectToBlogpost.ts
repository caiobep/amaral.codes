import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import type { Blogpost } from '../../../domain/blogpost.ts'

type RichTextProperty = { rich_text: Array<{ plain_text: string }> }

export type BlogpostPageResponse = PageObjectResponse & {
  properties: {
    Tags: { relation: Array<{ id: string }> }
    Summary: { rich_text: Array<{ plain_text: string }> }
    Name: { title: Array<{ plain_text: string }> }
    '[Blog] Summary': RichTextProperty
    '[Blog] Reading time': RichTextProperty
  }
}

export function convertPageObjectToBlogpostHeader(
  page: BlogpostPageResponse,
): Omit<Blogpost, 'content' | 'tags'> {
  return {
    id: page?.id,
    date: page?.created_time,
    title: page?.properties?.Name?.title?.[0]?.plain_text,
    summary: page?.properties?.['[Blog] Summary']?.rich_text?.[0]?.plain_text,
    readTime: page?.properties?.['[Blog] Reading time']?.rich_text?.[0]?.plain_text,
  }
}
