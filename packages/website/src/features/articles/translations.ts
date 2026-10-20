import type { EntryData } from '../../content/schemas'
import { getEntryHref } from '../../lib/routes'

interface LocalizedEntry {
  id: string
  data: Pick<EntryData, 'language' | 'translation'>
}

export function isTranslatedEntry(entry: LocalizedEntry): boolean {
  return entry.data.translation?.primary === false
}

export function originalSlug(entry: LocalizedEntry): string {
  return (entry.data.translation?.key ?? entry.id).split('/').at(-1) ?? entry.id
}

export function translatedPath(entry: LocalizedEntry): string {
  return getEntryHref(entry.id, entry.data.translation)
}

export function translationLinks(entries: readonly LocalizedEntry[], current: LocalizedEntry) {
  if (!current.data.translation) return []
  return entries.filter(entry => entry.data.translation?.key === current.data.translation?.key)
    .flatMap(entry => entry.data.language ? [{ language: entry.data.language, href: translatedPath(entry) }] : [])
}
