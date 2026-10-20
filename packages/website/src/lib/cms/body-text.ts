import { z } from 'astro/zod'
import { inlineMarkdownMatches } from './body-inline-fidelity'
import { createListContext, listPrefix, resetListContext } from './body-list'
import {
  escapeHtml,
  escapeMarkdown,
  markdownDestination,
  publicUrl,
} from './body-url'

export const span = z.object({
  _type: z.literal('span'),
  text: z.string(),
  marks: z.array(z.string()).optional(),
})
export const linkDefinition = z.object({
  _type: z.literal('link'),
  _key: z.string(),
  href: publicUrl,
})
export const textBlock = z.object({
  _type: z.literal('block'),
  style: z
    .enum(['normal', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote'])
    .optional(),
  listItem: z.enum(['bullet', 'number']).optional(),
  level: z.number().int().positive().optional(),
  listId: z.string().optional(),
  listStart: z.number().int().positive().max(2_147_483_647).optional(),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
  children: z.array(span),
  markDefs: z.array(linkDefinition).optional(),
})
export type TextBlock = z.infer<typeof textBlock>
type RichSpan = z.infer<typeof span>
type LinkDefinition = z.infer<typeof linkDefinition>
type InlineFormat = 'html' | 'markdown'

const htmlWrappers: Record<string, (text: string) => string> = {
  strong: text => `<strong>${text}</strong>`,
  em: text => `<em>${text}</em>`,
  code: text => `<code>${text}</code>`,
  'strike-through': text => `<s>${text}</s>`,
  underline: text => `<u>${text}</u>`,
  superscript: text => `<sup>${text}</sup>`,
  subscript: text => `<sub>${text}</sub>`,
}
const markdownWrappers: Record<string, (text: string) => string> = {
  ...htmlWrappers,
  strong: text => `**${text}**`,
  em: text => `_${text}_`,
  code: inlineCode,
}

export function serializeTextRun(
  blocks: TextBlock[],
  lists = createListContext(blocks),
): string {
  const chunks: string[] = []
  let previous: TextBlock | undefined
  for (const block of blocks) {
    const content = exporterBlock(block)
    const prefix = block.listItem ? listPrefix(block, lists) : ''
    if (!block.listItem) resetListContext(lists)
    const separator = blockSeparator(previous, block, prefix)
    chunks.push(
      `${separator}${prefix}${content.replaceAll('\n', `\n${' '.repeat(prefix.length)}`)}`,
    )
    previous = block
  }
  return chunks.join('')
}

function blockSeparator(
  previous: TextBlock | undefined,
  block: TextBlock,
  prefix: string,
): string {
  if (!previous) return ''
  if (!previous.listItem || !block.listItem)
    return proseSeparator(previous, block)
  const indent = prefix.slice(0, prefix.length - prefix.trimStart().length)
  return listSeparator(previous, block, indent)
}

function proseSeparator(previous: TextBlock, block: TextBlock): string {
  return isMarkdownQuote(previous) && isMarkdownQuote(block) ? '\n>\n' : '\n\n'
}

function isMarkdownQuote(block: TextBlock): boolean {
  return (
    block.style === 'blockquote' &&
    !block.listItem &&
    (!block.textAlign || block.textAlign === 'left')
  )
}

function listSeparator(
  previous: TextBlock,
  block: TextBlock,
  indent: string,
): string {
  if (needsNestedListBreak(previous, block)) return '\n\n'
  if (startsDistinctList(previous, block)) return `\n\n${indent}<!-- -->\n\n`
  return '\n'
}

function needsNestedListBreak(previous: TextBlock, block: TextBlock): boolean {
  return (
    (block.level ?? 1) > (previous.level ?? 1) &&
    needsListContentBreak(previous, block)
  )
}

function needsListContentBreak(previous: TextBlock, block: TextBlock): boolean {
  return (
    Boolean(previous.textAlign && previous.textAlign !== 'left') ||
    (block.listItem === 'number' && block.listStart !== 1)
  )
}

function startsDistinctList(previous: TextBlock, block: TextBlock): boolean {
  return Boolean(
    previous.listId &&
    block.listId &&
    previous.level === block.level &&
    previous.listId !== block.listId,
  )
}

function exporterBlock(block: TextBlock): string {
  if (block.textAlign && block.textAlign !== 'left')
    return alignedTextBlock(block, block.textAlign)
  const content = protectBlockMarkup(
    serializeInline(block.children, block.markDefs, 'markdown'),
  )
  return markdownTextBlock(block, content)
}

function markdownTextBlock(block: TextBlock, content: string): string {
  if (block.listItem) return content
  if (block.style === 'blockquote')
    return `> ${content.replaceAll('\n', '\n> ')}`
  if (!block.style?.startsWith('h')) return content
  if (block.children.some(child => child.text.includes('\n')))
    return htmlTextBlock(block)
  return `${'#'.repeat(Number(publicHeadingStyle(block.style).slice(1)))} ${content}`
}

export function protectBlockMarkup(value: string): string {
  return value
    .replace(/^( {0,3})(#{1,6}|[-+>]|-{3,}|=+)(?=[ \t]|$)/gmu, '$1\\$2')
    .replace(/^( {0,3})(\d{1,9})([.)])(?=[ \t])/gmu, '$1$2\\$3')
    .replace(
      /^( {4}|\t)/gmu,
      whitespace =>
        `&#${String(whitespace.charCodeAt(0))};${whitespace.slice(1)}`,
    )
}

function publicHeadingStyle(style: NonNullable<TextBlock['style']>): string {
  return style === 'h1' ? 'h2' : style
}

function alignedTextBlock(
  block: TextBlock,
  alignment: NonNullable<TextBlock['textAlign']>,
): string {
  return htmlTextBlock(block, ` style="text-align: ${alignment};"`)
}

function htmlTextBlock(block: TextBlock, attributes = ''): string {
  const tag = textTag(block.style)
  return `<${tag}${attributes}>${serializeInline(block.children, block.markDefs, 'html')}</${tag}>`
}

function textTag(style: TextBlock['style']): string {
  if (style === 'h1') return 'h2'
  if (style === 'blockquote') return style
  return style?.startsWith('h') ? style : 'p'
}

export function serializeInline(
  children: RichSpan[],
  definitions: LinkDefinition[] | undefined,
  format: InlineFormat,
): string {
  const links = definitions ?? []
  const content = children
    .map(child => serializeSpan(child, links, format))
    .join('')
  if (format === 'html') return content
  return inlineMarkdownMatches(protectBlockMarkup(content), children, links)
    ? content
    : serializeInline(children, definitions, 'html')
}

function serializeSpan(
  child: RichSpan,
  definitions: LinkDefinition[],
  format: InlineFormat,
): string {
  const marks = [...(child.marks ?? [])].sort(
    (left, right) => Number(right === 'code') - Number(left === 'code'),
  )
  const text = inlineText(child.text, marks, format)
  return marks.reduce(
    (current, mark) => applyMark(current, mark, definitions, format),
    text,
  )
}

function inlineText(
  text: string,
  marks: string[],
  format: InlineFormat,
): string {
  if (format === 'html') return escapeHtml(text).replaceAll('\n', '<br>')
  return marks.includes('code')
    ? text
    : escapeMarkdown(text).replaceAll('\n', '\\\n')
}

function applyMark(
  text: string,
  mark: string,
  definitions: LinkDefinition[],
  format: InlineFormat,
): string {
  const definition = definitions.find(link => link._key === mark)
  if (definition)
    return format === 'html'
      ? `<a href="${escapeHtml(definition.href)}">${text}</a>`
      : `[${text}](${markdownDestination(definition.href)})`
  const wrappers = format === 'html' ? htmlWrappers : markdownWrappers
  const wrap = wrappers[mark]
  if (!wrap) throw new Error('CMS content has unsupported inline formatting')
  return wrap(text)
}

function inlineCode(text: string): string {
  const ticks = text.match(/`+/gu) ?? []
  const fence = '`'.repeat(
    ticks.reduce((longest, run) => Math.max(longest, run.length + 1), 1),
  )
  const padding =
    /^`|`$/u.test(text) || (/^ .* $/su.test(text) && /\S/u.test(text))
      ? ' '
      : ''
  return `${fence}${padding}${text}${padding}${fence}`
}
