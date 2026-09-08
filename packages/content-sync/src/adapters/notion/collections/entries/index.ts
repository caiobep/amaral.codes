import type { PageObjectResponse as NotionPage } from '@notionhq/client'
import type {
  EntryCategory,
  EntryData,
} from '@amaral.codes/content-contract'
import {
  ENTRY_CATEGORIES,
  ENTRY_LANGUAGES,
} from '@amaral.codes/content-contract'
import type { ContentMapper } from '../../../../application/ports.ts'
import type { ContentPartition } from '../../../../domain/content/index.ts'
import { createSlug } from '../../../../domain/slug/index.ts'
import {
  getDate,
  getMultiSelect,
  getNumber,
  getSelect,
  getText,
  getTitle,
} from '../../properties/index.ts'
import { isPublishedNotionStatus } from '../../publication-status/index.ts'
import { readOption } from './options/index.ts'
import { mapPodcast } from './podcast/index.ts'
import { mapTalk } from './talk/index.ts'

const PARTITION_BY_TYPE: Record<EntryCategory, ContentPartition> = {
  essay: 'essays',
  note: 'notes',
  review: 'reviews',
  link: 'links',
  video: 'videos',
  podcast: 'podcasts',
  talk: 'talks',
}

export const entriesMapper: ContentMapper<NotionPage, EntryData> = {
  isPublished: page => isPublishedNotionStatus(getSelect(page, 'Status')),
  map: (page) => {
    const title = getTitle(page)
    const category = readEntryType(page)
    const summary = readEntrySummary(page)

    return {
      slug: getText(page, 'Slug') ?? createSlug(title),
      partition: PARTITION_BY_TYPE[category],
      metadata: {
        title,
        date: readEntryDate(page),
        language: readEntryLanguage(page),
        summary,
        category,
        topics: readTopics(page, category),
        featuredOrder: getNumber(page, 'Featured order'),
        podcast: category === 'podcast' ? mapPodcast(page) : undefined,
        talk: category === 'talk' ? mapTalk(page) : undefined,
      },
    }
  },
}

function readEntryDate(page: NotionPage): string {
  return getDate(page, 'Created At')
    ?? getDate(page, 'Date')
    ?? page.created_time
}

function readEntrySummary(page: NotionPage): string | undefined {
  return getText(page, 'Summary override')
    ?? getText(page, 'Summary')
    ?? getText(page, 'AI summary')
}

function readEntryLanguage(page: NotionPage) {
  return readOption(page, 'Language', ENTRY_LANGUAGES, undefined)
}

function readEntryType(page: NotionPage) {
  const explicitType = readOption(page, 'Type', ENTRY_CATEGORIES, undefined)
  if (explicitType) return explicitType
  return readOption(page, 'Category', ENTRY_CATEGORIES, 'note')
}

function readTopics(
  page: NotionPage,
  category: EntryCategory,
): string[] {
  const topics = getMultiSelect(page, 'Topics')
  if (topics.length > 0) return topics

  const sourceCategory = getSelect(page, 'Category')
  if (!sourceCategory || sourceCategory.toLowerCase() === category) return []
  return [sourceCategory]
}
