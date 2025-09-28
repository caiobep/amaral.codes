import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import type { Blogpost } from '../../../domain/blogpost.ts'

export type BlogpostPageResponse = PageObjectResponse & {
  properties: {
    Tags: { relation: Array<{ id: string }> }
    Summary: { rich_text: Array<{ plain_text: string }> }
    Name: { title: Array<{ plain_text: string }> }
    'Time to Read': { rich_text: Array<{ plain_text: string }> }
  }
}

export function convertPageObjectToBlogpostHeader(
  page: BlogpostPageResponse,
): Omit<Blogpost, 'content' | 'tags'> {
  return {
    id: page?.id,
    date: page?.created_time,
    title: page?.properties?.Name?.title?.[0]?.plain_text,
    summary: page?.properties?.Summary?.rich_text?.[0]?.plain_text,
    readTime: page?.properties?.['Time to Read']?.rich_text?.[0]?.plain_text,
  }
}
