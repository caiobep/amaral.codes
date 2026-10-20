import type { PageObjectResponse as NotionPage } from '@notionhq/client'
import type {
  ProjectData,
  ProjectKind,
  ProjectVisual,
} from '@amaral.codes/content-contract'
import { PROJECT_KINDS } from '@amaral.codes/content-contract'
import type { ContentMapper } from '../../../../application/ports.ts'
import { createSlug } from '../../../../domain/slug/index.ts'
import {
  getMultiSelect,
  getNumber,
  getSelect,
  getText,
  getTitle,
  readOptionalHttpsUrl,
  requireNumber,
  requireText,
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
        externalUrl: readOptionalHttpsUrl(page, 'External URL'),
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

  const src = readOptionalHttpsUrl(page, 'Visual URL')
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
