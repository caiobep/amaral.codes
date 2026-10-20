import assert from 'node:assert/strict'
import type { PageObjectResponse as NotionPage } from '@notionhq/client'
import { test } from 'vitest'
import {
  getDate,
  getMultiSelect,
  getNumber,
  getSelect,
  getText,
  getTitle,
  getUrl,
  readOptionalHttpsUrl,
  requireDate,
  requireNumber,
  requireText,
  requireUrl,
} from './index.ts'

test('reads and normalizes supported Notion property values', () => {
  const page = createPage({
    Name: { title: [{ plain_text: ' A ' }, null, { plain_text: 'title ' }] },
    Text: { rich_text: [{ plain_text: ' body ' }] },
    FormulaText: { formula: { type: 'string', string: ' calculated body ' } },
    Select: { select: { name: ' Option ' } },
    Status: { select: null, status: { name: ' Published ' } },
    Topics: { multi_select: [{ name: 'One' }, null, { name: '' }, { name: 'Two' }] },
    Number: { number: 42 },
    Url: { url: ' https://example.com ' },
    Date: { date: { start: '2026-07-26' } },
    Created: { created_time: '2021-09-08T11:20:00.000Z' },
  })

  assert.equal(getTitle(page), 'A title')
  assert.equal(getText(page, 'Text'), 'body')
  assert.equal(getText(page, 'FormulaText'), 'calculated body')
  assert.equal(getSelect(page, 'Select'), 'Option')
  assert.equal(getSelect(page, 'Status'), 'Published')
  assert.deepEqual(getMultiSelect(page, 'Topics'), ['One', 'Two'])
  assert.equal(getNumber(page, 'Number'), 42)
  assert.equal(getUrl(page, 'Url'), 'https://example.com')
  assert.equal(getDate(page, 'Date'), '2026-07-26')
  assert.equal(getDate(page, 'Created'), '2021-09-08T11:20:00.000Z')
})

test('returns safe defaults for absent and malformed properties', () => {
  const page = createPage({
    EmptyText: { rich_text: [{ plain_text: ' ' }] },
    InvalidText: { rich_text: 'text' },
    EmptySelect: { select: { name: ' ' } },
    InvalidTopics: { multi_select: 'topic' },
    InvalidNumber: { number: '42' },
    EmptyUrl: { url: ' ' },
    InvalidDate: { date: [] },
  })

  assert.equal(getTitle(page), 'Untitled')
  assert.equal(getText(page, 'Missing'), undefined)
  assert.equal(getText(page, 'EmptyText'), undefined)
  assert.equal(getText(page, 'InvalidText'), undefined)
  assert.equal(getSelect(page, 'Missing'), undefined)
  assert.equal(getSelect(page, 'EmptySelect'), undefined)
  assert.deepEqual(getMultiSelect(page, 'Missing'), [])
  assert.deepEqual(getMultiSelect(page, 'InvalidTopics'), [])
  assert.equal(getNumber(page, 'InvalidNumber'), undefined)
  assert.equal(getUrl(page, 'EmptyUrl'), undefined)
  assert.equal(getDate(page, 'InvalidDate'), undefined)
})

test('requires normalized Notion property values', () => {
  const page = createPage({
    Name: { title: [{ plain_text: 'Entry' }] },
    Text: { rich_text: [{ plain_text: ' body ' }] },
    Url: { url: ' https://example.com ' },
    Date: { date: { start: '2026-07-26' } },
    Zero: { number: 0 },
  })

  assert.equal(requireText(page, 'Text'), 'body')
  assert.equal(requireUrl(page, 'Url'), 'https://example.com')
  assert.equal(requireDate(page, 'Date'), '2026-07-26')
  assert.equal(requireNumber(page, 'Zero'), 0)
  assert.equal(readOptionalHttpsUrl(page, 'Url'), 'https://example.com/')
  assert.equal(readOptionalHttpsUrl(page, 'Missing'), undefined)
})

test('required Notion properties identify the page and missing property', () => {
  const page = createPage({ Name: { title: [{ plain_text: 'Entry' }] } })

  assert.throws(() => requireText(page, 'Summary'), {
    message: '"Entry" is missing Summary',
  })
  assert.throws(() => requireUrl(page, 'Link'), {
    message: '"Entry" is missing Link',
  })
  assert.throws(() => requireDate(page, 'Created'), {
    message: '"Entry" is missing Created',
  })
  assert.throws(() => requireNumber(page, 'Order'), {
    message: '"Entry" is missing Order',
  })
})

function createPage(properties: Record<string, unknown>): NotionPage {
  return { properties } as unknown as NotionPage
}
