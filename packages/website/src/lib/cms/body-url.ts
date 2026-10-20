import { z } from 'astro/zod'
import {
  isPublicHttpsUrl,
  isRootRelativePublicUrl,
} from '@amaral.codes/content-contract/public-url'

export const publicUrl = z
  .string()
  .refine(isPublishableUrl, 'CMS URLs must be public and durable')

export function isPublishableUrl(value: string): boolean {
  if (!isPublicHttpsUrl(value) && !isRootRelativePublicUrl(value)) return false
  return !new URL(value, 'https://local.invalid').searchParams.has('_preview')
}

export function markdownDestination(value: string): string {
  return value.replace(/[()<>\s\\]/gu, character =>
    encodeURIComponent(character).replaceAll('(', '%28').replaceAll(')', '%29'),
  )
}

export function escapeHtml(value: string): string {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
  }
  return value.replace(
    /[&<>"]/gu,
    character => entities[character] ?? character,
  )
}

export function escapeMarkdown(value: string): string {
  return value.replace(/[\\`*_[\]<>&]/gu, character =>
    character === '&' ? '&amp;' : `\\${character}`,
  )
}
