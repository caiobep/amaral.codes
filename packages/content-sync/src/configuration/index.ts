import 'dotenv/config'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { CollectionName } from '../domain/content/index.ts'

interface PublicationCollectionPolicy {
  expectedDocuments: number
  label: string
  snapshotPath: string
}

interface PublicationPolicyDocument {
  collections: Record<CollectionName, PublicationCollectionPolicy>
  maximumDropRatio: number
}

export interface PublicationSafetyConfiguration {
  allowLargeReduction: boolean
  baselineDocuments: number
  maximumDropRatio: number
}

export interface CollectionConfiguration {
  contentRoot: string
  destination: string
  publicationSafety: PublicationSafetyConfiguration
  sourceKind: 'database' | 'dataSource'
  sourceId: string
}

export interface ContentSyncConfiguration {
  collections: Partial<Record<CollectionName, CollectionConfiguration>>
  token: string
}

const WEBSITE_ROOT = path.resolve(import.meta.dirname, '../../../website')
const REPOSITORY_ROOT = path.resolve(WEBSITE_ROOT, '../..')
const PUBLICATION_POLICY = readPublicationPolicy()

export function readConfiguration(
  collections: readonly CollectionName[],
): ContentSyncConfiguration {
  return {
    token: requireEnvironmentValue('NOTION_TOKEN'),
    collections: Object.fromEntries(
      collections.map(collection => [
        collection,
        readCollectionConfiguration(collection),
      ]),
    ),
  }
}

function readCollectionConfiguration(
  collection: CollectionName,
): CollectionConfiguration {
  const policy = PUBLICATION_POLICY.collections[collection]
  const shared = {
    destination: path.join(REPOSITORY_ROOT, policy.snapshotPath),
    publicationSafety: {
      allowLargeReduction: process.env.PUBLICATION_ALLOW_LARGE_DROP === '1',
      baselineDocuments: policy.expectedDocuments,
      maximumDropRatio: PUBLICATION_POLICY.maximumDropRatio,
    },
  }

  if (collection === 'entries') {
    return {
      ...shared,
      contentRoot: path.join(WEBSITE_ROOT, 'src/content/entries'),
      sourceKind: 'dataSource',
      sourceId: requireEnvironmentValue(
        'NOTION_ENTRIES_DATA_SOURCE_ID',
        'NOTION_POSTS_DATA_SOURCE_ID',
      ),
    }
  }

  if (collection === 'podcasts') {
    return {
      ...shared,
      contentRoot: path.join(WEBSITE_ROOT, 'src/content/entries'),
      sourceKind: 'database',
      sourceId: requireEnvironmentValue('NOTION_PODCASTS_DATABASE_ID'),
    }
  }

  return {
    ...shared,
    contentRoot: path.join(WEBSITE_ROOT, 'src/content/projects'),
    sourceKind: 'dataSource',
    sourceId: requireEnvironmentValue('NOTION_PROJECTS_DATA_SOURCE_ID'),
  }
}

function readPublicationPolicy(): PublicationPolicyDocument {
  const source = readFileSync(
    path.join(REPOSITORY_ROOT, 'publication-policy.json'),
    'utf8',
  )
  return JSON.parse(source) as PublicationPolicyDocument
}

function requireEnvironmentValue(key: string, legacyKey?: string): string {
  const value = process.env[key]?.trim()
  if (value) return value

  const legacyValue = legacyKey ? process.env[legacyKey]?.trim() : undefined
  if (legacyValue) return legacyValue
  throw new Error(`Missing environment variable: ${key}`)
}
