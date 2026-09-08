import {
  collectAllDataSourceRows,
  isFullPage,
  type PageObjectResponse,
} from '@notionhq/client'
import type { CollectionSource } from '../../../application/ports.ts'
import type { NotionClient } from '../client/index.ts'

export function createNotionCollectionSource(
  notion: NotionClient,
): CollectionSource<PageObjectResponse> {
  return {
    list: async sourceId => {
      const rows = await collectAllDataSourceRows(notion, {
        data_source_id: sourceId,
      })
      if (rows.every(isFullPage)) return rows
      throw new Error('Notion returned a partial data-source row')
    },
  }
}
