import type { PageObjectResponse as NotionPage } from '@notionhq/client'

type UnknownRecord = Record<string, unknown>

export function getTitle(page: NotionPage, name = 'Name'): string {
  return getText(page, name) ?? 'Untitled'
}

export function getText(page: NotionPage, name: string): string | undefined {
  const property = getProperty(page, name)
  if (!property) return undefined

  const formulaValue = getFormulaString(property.formula)
  if (formulaValue) return formulaValue

  const richText = property.rich_text ?? property.title
  if (!Array.isArray(richText)) return undefined

  const value = richText
    .map(item => isRecord(item) ? item.plain_text : undefined)
    .filter((item): item is string => typeof item === 'string')
    .join('')
    .trim()
  return value.length > 0 ? value : undefined
}

function getFormulaString(value: unknown): string | undefined {
  if (!isRecord(value) || typeof value.string !== 'string') return undefined
  const normalized = value.string.trim()
  return normalized.length > 0 ? normalized : undefined
}

export function getSelect(page: NotionPage, name: string): string | undefined {
  const property = getProperty(page, name)
  if (!property) return undefined
  return getOptionName(property.select) ?? getOptionName(property.status)
}

export function getMultiSelect(page: NotionPage, name: string): string[] {
  const property = getProperty(page, name)
  if (!property || !Array.isArray(property.multi_select)) return []

  return property.multi_select
    .map(item => isRecord(item) ? item.name : undefined)
    .filter((item): item is string => typeof item === 'string' && item.length > 0)
}

export function getNumber(page: NotionPage, name: string): number | undefined {
  const value = getProperty(page, name)?.number
  return typeof value === 'number' ? value : undefined
}

export function getUrl(page: NotionPage, name: string): string | undefined {
  const value = getProperty(page, name)?.url
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export function getDate(page: NotionPage, name: string): string | undefined {
  const date = getDateValue(getProperty(page, name))
  if (!isRecord(date)) return undefined
  return typeof date.start === 'string' ? date.start : undefined
}

function getDateValue(property: UnknownRecord | undefined): unknown {
  if (!property) return undefined
  if (typeof property.created_time === 'string') {
    return { start: property.created_time }
  }
  if (property.date !== undefined) return property.date
  if (!isRecord(property.formula)) return undefined
  return property.formula.date
}

function getProperty(page: NotionPage, name: string): UnknownRecord | undefined {
  const value: unknown = page.properties[name]
  return isRecord(value) ? value : undefined
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getOptionName(value: unknown): string | undefined {
  if (!isRecord(value) || typeof value.name !== 'string') return undefined
  const name = value.name.trim()
  return name.length > 0 ? name : undefined
}
