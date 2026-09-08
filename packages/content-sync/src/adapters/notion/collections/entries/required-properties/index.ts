import type { PageObjectResponse as NotionPage } from '@notionhq/client'
import {
  getText,
  getTitle,
  getUrl,
} from '../../../properties/index.ts'

export function requireText(page: NotionPage, name: string): string {
  const value = getText(page, name)
  if (value) return value
  throw new Error(`"${getTitle(page)}" is missing ${name}`)
}

export function requireUrl(page: NotionPage, name: string): string {
  const value = getUrl(page, name)
  if (value) return value
  throw new Error(`"${getTitle(page)}" is missing ${name}`)
}
