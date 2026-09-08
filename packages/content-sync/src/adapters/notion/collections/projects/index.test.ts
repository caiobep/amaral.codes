import assert from 'node:assert/strict'
import { test } from 'vitest'
import type { PageObjectResponse as NotionPage } from '@notionhq/client'
import { projectsMapper } from './index.ts'

test('maps project properties', () => {
  const result = mapProject(createPage({
    Name: title('Desk cable guide'),
    Summary: text('A printed guide that keeps cables within reach.'),
    Kind: select('Physical'),
    Status: select('Published'),
    Order: number(7),
    Technologies: multiSelect('PETG', 'Bambu Lab P1S'),
  }))

  assert.equal(result.slug, 'desk-cable-guide')
  assert.equal(result.metadata.kind, 'physical')
  assert.equal(result.metadata.category, 'Physical')
})

test('requires project metadata used by the index', () => {
  assert.throws(
    () => mapProject(createPage({
      Name: title('Incomplete'),
      Order: number(1),
    })),
    /missing Summary/,
  )
})

test('does not publish preview projects', () => {
  const page = createPage({
    Name: title('Preview project'),
    Summary: text('A project being reviewed locally.'),
    Status: select('Preview'),
    Order: number(1),
  })

  assert.equal(projectsMapper.isPublished(page), false)
})

test('rejects unsafe external project URLs', () => {
  assert.throws(
    () => mapProject(createPage({
      Name: title('Unsafe project'),
      Summary: text('This project has an unsafe destination.'),
      Order: number(1),
      'External URL': url('javascript:alert(1)'),
    })),
    /public HTTPS URL/,
  )
})

test('maps featured project evidence', () => {
  const result = mapProject(createFeaturedProject({
    'Code preview': text('const result = true'),
  }))
  assert.equal(result.metadata.featuredOrder, 1)
})

function mapProject(page: NotionPage) {
  return projectsMapper.map(page)
}

function createFeaturedProject(
  overrides: Record<string, unknown>,
): NotionPage {
  return createPage({
    Name: title('Featured project'),
    Summary: text('A project selected for the homepage.'),
    Status: select('Published'),
    Order: number(1),
    'Featured order': number(1),
    ...overrides,
  })
}

function createPage(properties: Record<string, unknown>): NotionPage {
  return {
    object: 'page',
    id: 'project-1',
    created_time: '2026-07-01T00:00:00.000Z',
    properties,
  } as unknown as NotionPage
}

const title = (value: string) => ({ title: [{ plain_text: value }] })
const text = (value: string) => ({ rich_text: [{ plain_text: value }] })
const select = (value: string) => ({ select: { name: value } })
const number = (value: number) => ({ number: value })
const url = (value: string) => ({ url: value })
const multiSelect = (...values: string[]) => ({
  multi_select: values.map(name => ({ name })),
})
