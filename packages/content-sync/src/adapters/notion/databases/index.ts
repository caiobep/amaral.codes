import type { PageObjectResponse } from '@notionhq/client'
import type { CollectionSource } from '../../../application/ports.ts'
import type { NotionClient } from '../client/index.ts'
import { createNotionCollectionSource } from '../pages/index.ts'

export function createNotionDatabaseSource(
  notion: NotionClient,
): CollectionSource<PageObjectResponse> {
  const dataSource = createNotionCollectionSource(notion)

  return {
    list: async databaseId => dataSource.list(
      await resolveOnlyDataSourceId(notion, databaseId),
    ),
  }
}

async function resolveOnlyDataSourceId(
  notion: NotionClient,
  databaseId: string,
): Promise<string> {
  const database = await notion.databases.retrieve({ database_id: databaseId })
  if (!('data_sources' in database)) {
    throw new Error('Notion database returned partial metadata')
  }
  if (database.data_sources.length !== 1) {
    throw new Error(
      'Notion database must contain exactly one data source',
    )
  }

  const [dataSource] = database.data_sources
  if (!dataSource) throw new Error('Notion database has no data source')
  return dataSource.id
}
