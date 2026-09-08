import type { PageObjectResponse as NotionPage } from '@notionhq/client'
import { getSelect } from '../../../properties/index.ts'

export function readOption<const T extends readonly string[]>(
  page: NotionPage,
  name: string,
  options: T,
  fallback: T[number],
): T[number]
export function readOption<const T extends readonly string[]>(
  page: NotionPage,
  name: string,
  options: T,
  fallback: undefined,
): T[number] | undefined
export function readOption<const T extends readonly string[]>(
  page: NotionPage,
  name: string,
  options: T,
  fallback: T[number] | undefined,
): T[number] | undefined {
  const value = getSelect(page, name)
  return options.find(option => option.toLowerCase() === value?.toLowerCase())
    ?? fallback
}
