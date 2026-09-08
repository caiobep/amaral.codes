import { entrySchema, type EntryCategory } from '@amaral.codes/content-contract'
import type { Entry } from '../payload-types'
import { podcastData, recordingUrl, talkData } from './media'

export type EntryInput = Partial<Omit<Entry, 'category' | 'podcast' | 'talk'>> & {
  category?: EntryCategory
  podcast?: unknown
  talk?: unknown
}

export function toEntryData(entry: EntryInput) {
  return entrySchema.parse({
    title: entry.title,
    summary: optionalSummary(entry.summary),
    category: entry.category,
    date: entry.date,
    language: entry.language ?? undefined,
    topics: entry.topics ?? [],
    podcast: entry.category === 'podcast' ? podcastData(entry.podcast) : undefined,
    talk: entry.category === 'talk' ? talkData(entry.talk) : undefined,
  })
}

function optionalSummary(value: Entry['summary']) {
  return value === '' ? undefined : value ?? undefined
}

export function toRecordingUrl(entry: EntryInput) {
  return entry.category === 'talk' ? recordingUrl(entry.talk) : undefined
}
