import type { EntryData } from '../../content/schemas'

export function getEntryHref(id: string, translation?: EntryData['translation']): string {
  return translation?.href ?? `/posts/${id}`
}

export function getProjectHref(id: string): string {
  return `/projects/${id}`
}
