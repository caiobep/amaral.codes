import environment from '../../../infrastructure/environment.ts'
import { notionApiClient } from '../configuration/index.ts'

export interface GetPageFromDatabase {
  title: string
  properties: Record<string, any>
}

export async function getPageFromDatabase(
  pageId: string,
  databaseId = environment.NOTION_BLOG_DATABASE,
  notionClient = notionApiClient,
) {
  const response = await notionClient.pages.retrieve({ page_id: pageId })
  console.dir({ response })

  const properties = response?.properties
  const title = properties.Name.title[0].plain_text

  return {
    title,
    properties,
  }
}
