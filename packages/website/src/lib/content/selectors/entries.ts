import { ENTRY_CATEGORIES, type EntryCategory } from '../../../content/schemas'
import { byId, orderByUniqueRank } from './ordering'
import type { EntryRecord } from './types'

const READABLE_ENTRY_CATEGORIES = new Set<EntryCategory>(['essay', 'note', 'review'])

export function sortEntriesNewestFirst<T extends EntryRecord>(entries: readonly T[]) {
  return [...entries].sort((left, right) =>
    Date.parse(right.data.date) - Date.parse(left.data.date) || byId(left, right),
  )
}

export function selectFeaturedEntries<T extends EntryRecord>(entries: readonly T[]) {
  const featured = entries.filter(
    (entry): entry is T & { data: T['data'] & { featuredOrder: number } } =>
      entry.data.featuredOrder !== undefined,
  )

  return orderByUniqueRank(featured, (entry) => entry.data.featuredOrder, 'entry featuredOrder')
}

export function selectUnfeaturedEntries<T extends EntryRecord>(entries: readonly T[]) {
  return sortEntriesNewestFirst(entries).filter((entry) => entry.data.featuredOrder === undefined)
}

export function selectEntriesByCategory<T extends EntryRecord>(
  entries: readonly T[],
  category: EntryCategory,
) {
  return entries.filter((entry) => entry.data.category === category)
}

export function selectNextReads<T extends EntryRecord>(
  entries: readonly T[],
  currentId: string,
  limit = 2,
) {
  return entries
    .filter((entry) => (
      entry.id !== currentId
      && READABLE_ENTRY_CATEGORIES.has(entry.data.category)
    ))
    .map((entry) => ({ entry, rank: hashText(`${currentId}:${entry.id}`) }))
    .sort((left, right) => left.rank - right.rank || byId(left.entry, right.entry))
    .slice(0, limit)
    .map(({ entry }) => entry)
}

export function countEntriesByCategory(entries: readonly EntryRecord[]) {
  const emptyCounts = Object.fromEntries(
    ENTRY_CATEGORIES.map((category) => [category, 0]),
  ) as Record<EntryCategory, number>

  return entries.reduce<Record<EntryCategory, number>>((counts, entry) => {
    counts[entry.data.category] += 1
    return counts
  }, emptyCounts)
}

export function getEntryTopics(entry: EntryRecord) {
  return [...new Set(entry.data.topics ?? [])]
}

function hashText(value: string) {
  let hash = 2_166_136_261

  for (const character of value) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16_777_619) >>> 0
  }

  return hash
}
