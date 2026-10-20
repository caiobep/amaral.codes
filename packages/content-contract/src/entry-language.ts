import type { EntryData, EntryLanguage } from './metadata/index.ts'

export function resolveEntryLanguage(
  entry: Pick<EntryData, 'category' | 'language' | 'talk'>,
): EntryLanguage {
  return entry.language ?? entry.talk?.language ?? (entry.category === 'podcast' ? 'pt-BR' : 'en')
}
