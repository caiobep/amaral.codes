import path from 'node:path'
import type { PageObjectResponse as NotionPage } from '@notionhq/client'
import type { ContentMapper } from '../application/ports.ts'
import { createDocumentExporter } from '../application/document-exporter/index.ts'
import { syncCollection } from '../application/sync-collection/index.ts'
import { writeContentSource } from '../adapters/filesystem/write-document/index.ts'
import { createFilesystemSnapshotStore } from '../adapters/filesystem/snapshot-store/index.ts'
import { createFilesystemSlugReservations } from '../adapters/filesystem/slug-reservations/index.ts'
import {
  createMarkdownAssetMaterializationSession,
  createMarkdownAssetMaterializer,
} from '../adapters/markdown/assets/index.ts'
import { renderMarkdownDocument } from '../adapters/markdown/document/index.ts'
import { createNotionClient } from '../adapters/notion/client/index.ts'
import { isTrustedNotionAssetUrl } from '../adapters/notion/asset-url/index.ts'
import { entriesMapper } from '../adapters/notion/collections/entries/index.ts'
import { podcastsMapper } from '../adapters/notion/collections/podcasts/index.ts'
import { projectsMapper } from '../adapters/notion/collections/projects/index.ts'
import { createNotionDatabaseSource } from '../adapters/notion/databases/index.ts'
import { createNotionFileSourceResolver } from '../adapters/notion/file-source/index.ts'
import { getPageContentsInMarkdown } from '../adapters/notion/markdown/index.ts'
import { createNotionCollectionSource } from '../adapters/notion/pages/index.ts'
import type {
  CollectionConfiguration,
  ContentSyncConfiguration,
} from '../configuration/index.ts'
import type { CollectionName } from '../domain/content/index.ts'

const MAPPERS: Record<CollectionName, ContentMapper<NotionPage>> = {
  entries: entriesMapper,
  podcasts: podcastsMapper,
  projects: projectsMapper,
}

export function createContentSync(
  configuration: ContentSyncConfiguration,
): ContentSync {
  const notion = createNotionClient(configuration.token)
  const sources = {
    database: createNotionDatabaseSource(notion),
    dataSource: createNotionCollectionSource(notion),
  }
  const materializationSession = createMarkdownAssetMaterializationSession()
  const exporter = createDocumentExporter<NotionPage>({
    destinations: {
      resolve: (root, identity) => identity.partition
        ? path.join(root, identity.partition)
        : root,
    },
    reader: {
      read: source => getPageContentsInMarkdown(source.id, notion),
    },
    materializer: {
      materialize: (markdown, destination, source) => createMarkdownAssetMaterializer(
        destination,
        {
          isTrustedSource: isTrustedNotionAssetUrl,
          resolveSource: createNotionFileSourceResolver(notion, source.id),
          session: materializationSession,
        },
      )(markdown),
    },
    writer: {
      write: (destination, document) => writeContentSource(
        destination,
        document.slug,
        renderMarkdownDocument(document),
      ).then(() => undefined),
    },
  })

  return {
    sync: async (collection: CollectionName) => {
      const collectionConfiguration = requireCollectionConfiguration(
        configuration,
        collection,
      )
      return syncCollection({
        publicationSafety: collectionConfiguration.publicationSafety,
        sourceId: collectionConfiguration.sourceId,
      }, {
        exporter,
        mapper: MAPPERS[collection],
        reservations: createFilesystemSlugReservations({
          contentRoot: collectionConfiguration.contentRoot,
          syncedRoot: collectionConfiguration.destination,
        }),
        snapshots: createFilesystemSnapshotStore(
          collectionConfiguration.destination,
        ),
        source: sources[collectionConfiguration.sourceKind],
      })
    },
  }
}

export interface ContentSync {
  sync: (collection: CollectionName) => Promise<number>
}

function requireCollectionConfiguration(
  configuration: ContentSyncConfiguration,
  collection: CollectionName,
): CollectionConfiguration {
  const collectionConfiguration = configuration.collections[collection]
  if (!collectionConfiguration) {
    throw new Error(`Content collection is not configured: ${collection}`)
  }
  return collectionConfiguration
}
