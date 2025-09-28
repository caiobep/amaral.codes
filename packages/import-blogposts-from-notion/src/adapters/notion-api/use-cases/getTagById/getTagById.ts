import { notionApiClient } from '../../configuration/index.ts'

interface NotionTagResponse {
  id: string
  icon: { emoji?: string; url?: string }
  properties: {
    Name: { title: [{ plain_text: string }] }
  }
}

export type Tag = { id: string; name: string; icon: string }
const tagsCache: Record<string, Tag> = {}

export const getTagNameAndIcon = async (tagId: string): Promise<Tag> => {
  const dataInCache = tagsCache[tagId]
  if (dataInCache !== undefined) {
    return dataInCache
  }

  try {
    const tag = (await notionApiClient.pages.retrieve({
      page_id: tagId,
      filter_properties: ['title'],
    })) as unknown as NotionTagResponse

    const name = tag.properties.Name.title[0].plain_text
    const icon = tag?.icon?.emoji || tag?.icon?.url || ''
    const id = tag?.id
    const tagValue = { id, name, icon }

    tagsCache[tagId] = tagValue

    return tagValue
  } catch (er) {
    throw new Error(er as any)
  }
}
