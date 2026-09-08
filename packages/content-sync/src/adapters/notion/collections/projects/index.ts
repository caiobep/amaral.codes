import type { PageObjectResponse as NotionPage } from '@notionhq/client'
import type {
  ProjectData,
  ProjectKind,
  ProjectVisual,
} from '@amaral.codes/content-contract'
import { PROJECT_KINDS } from '@amaral.codes/content-contract'
import { requirePublicHttpsUrl } from '@amaral.codes/content-contract/public-url'
import type { ContentMapper } from '../../../../application/ports.ts'
import { createSlug } from '../../../../domain/slug/index.ts'
import {
  getMultiSelect,
  getNumber,
  getSelect,
  getText,
  getTitle,
  getUrl,
} from '../../properties/index.ts'
import { isPublishedNotionStatus } from '../../publication-status/index.ts'

export const projectsMapper: ContentMapper<NotionPage, ProjectData> = {
  isPublished: page => isPublishedNotionStatus(getSelect(page, 'Status')),
  map: (page) => {
    const title = getTitle(page)
    const kind = readKind(page)
    const order = requireNumber(page, 'Order')
    const featuredOrder = getNumber(page, 'Featured order')
    const visual = mapVisual(page)

    return {
      slug: getText(page, 'Slug') ?? createSlug(title),
      metadata: {
        title,
        summary: requireText(page, 'Summary'),
        kind,
        order,
        featuredOrder,
        category: getText(page, 'Category') ?? defaultCategory(kind),
        technologies: getMultiSelect(page, 'Technologies'),
        externalUrl: readOptionalHttpUrl(page, 'External URL'),
        externalLabel: getText(page, 'External label'),
        visual,
      },
    }
  },
}

function readKind(page: NotionPage): ProjectKind {
  const selected = getSelect(page, 'Kind')?.toLowerCase()
  return PROJECT_KINDS.find(kind => kind === selected) ?? 'software'
}

function defaultCategory(kind: ProjectKind): string {
  return kind === 'physical' ? 'Physical' : 'Software'
}

function mapVisual(page: NotionPage): ProjectVisual | undefined {
  const code = getText(page, 'Code preview')
  if (code) return { type: 'code', lines: code.split('\n').filter(Boolean) }

  const src = readOptionalHttpUrl(page, 'Visual URL')
  if (!src) return undefined

  return {
    type: 'image',
    src,
    alt: requireText(page, 'Visual alt'),
    width: requireNumber(page, 'Visual width'),
    height: requireNumber(page, 'Visual height'),
    sources: [],
  }
}

function readOptionalHttpUrl(page: NotionPage, name: string): string | undefined {
  const value = getUrl(page, name)
  return value ? requirePublicHttpsUrl(value, name) : undefined
}

function requireText(page: NotionPage, name: string): string {
  const value = getText(page, name)
  if (value) return value
  throw new Error(`"${getTitle(page)}" is missing ${name}`)
}

function requireNumber(page: NotionPage, name: string): number {
  const value = getNumber(page, name)
  if (value !== undefined) return value
  throw new Error(`"${getTitle(page)}" is missing ${name}`)
}
