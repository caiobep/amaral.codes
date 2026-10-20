import { z } from 'astro/zod'
import {
  createPortableTextTableCellMarkResolver,
  normalizePortableTextTable,
} from '@emdash-cms/admin/portable-text-table'
import type { PortableTextTableCell } from '@emdash-cms/admin/portable-text-table'
import { linkDefinition, serializeInline, span } from './body-text'

export const tableBlock = z
  .looseObject({ _type: z.literal('table') })
  .transform(block => ({ _type: block._type, markdown: tableMarkdown(block) }))

function tableMarkdown(value: unknown): string {
  let key = 0
  const normalized = normalizePortableTextTable(value, {
    path: 'public-table',
    createKey: () => `table-${String(key++)}`,
  })
  if (!normalized.ok)
    throw new Error('CMS table contains unsupported or malformed content')
  const resolveMarks = createPortableTextTableCellMarkResolver(normalized.table)
  const rows = normalized.table.rows
    .map(
      row =>
        `<tr>${row.cells.map(cell => cellHtml(cell, resolveMarks(cell))).join('')}</tr>`,
    )
    .join('\n')
  return `<table>\n${rows}\n</table>`
}

function cellHtml(cell: PortableTextTableCell, definitions: unknown): string {
  const tag = cell.isHeader ? 'th' : 'td'
  const content = serializeInline(
    z.array(span).parse(cell.content),
    z.array(linkDefinition).parse(definitions),
    'html',
  )
  return `<${tag}${cellAttributes(cell)}>${content}</${tag}>`
}

function cellAttributes(cell: PortableTextTableCell): string {
  const attributes: string[] = []
  if (cell.colspan) attributes.push(` colspan="${String(cell.colspan)}"`)
  if (cell.rowspan) attributes.push(` rowspan="${String(cell.rowspan)}"`)
  if (cell.textAlign) attributes.push(` style="text-align: ${cell.textAlign};"`)
  return attributes.join('')
}
