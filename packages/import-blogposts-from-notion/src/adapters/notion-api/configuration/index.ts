import { NotionToMarkdown } from 'notion-to-md'
import { Client } from '@notionhq/client'
import environment from '../../../infrastructure/environment.ts'
import type { BlockType } from 'notion-to-md/build/types'
import type { BlockTransformer } from '../../notion-block-to-md/types.ts'

export const notionApiClient = new Client({
  auth: environment.NOTION_API_KEY,
  notionVersion: '2022-06-28',
})

export const createNotionToMarkdownClient = (
  processors?: Partial<Record<BlockType, BlockTransformer>>,
  notionClient = notionApiClient,
) => {
  const n2m = new NotionToMarkdown({
    notionClient,
    config: {
      parseChildPages: true,
    },
  })

  if (processors) {
    Object.entries(processors).forEach(([blockType, processor]) => {
      n2m.setCustomTransformer(blockType, s => processor(s, n2m))
    })
  }

  return n2m
}
