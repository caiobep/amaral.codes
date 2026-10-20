import { fromMarkdown } from 'mdast-util-from-markdown'
import type { Nodes, Root } from 'mdast'
import { markdownDestination } from './body-url'

interface Span {
  text: string
  marks?: string[] | undefined
}
interface Link {
  _key: string
  href: string
}
interface Run {
  text: string
  marks: string[]
}
interface ParseContext {
  runs: Run[]
  htmlMarks: string[]
  valid: boolean
}
const htmlMarks: Record<string, string> = {
  strong: 'strong',
  em: 'em',
  code: 'code',
  s: 'strike-through',
  u: 'underline',
  sup: 'superscript',
  sub: 'subscript',
}
interface HtmlToken {
  mark: string
  closing: boolean
}
const htmlTokens = new Map<string, HtmlToken>(
  Object.entries(htmlMarks).flatMap(([tag, mark]): [string, HtmlToken][] => [
    [`<${tag}>`, { mark, closing: false }],
    [`</${tag}>`, { mark, closing: true }],
  ]),
)

export function inlineMarkdownMatches(
  markdown: string,
  spans: Span[],
  links: Link[],
): boolean {
  const expected: Run[] = []
  for (const span of spans)
    appendRun(
      expected,
      span.text,
      (span.marks ?? []).map(mark => nativeMark(mark, links)),
    )
  const context: ParseContext = { runs: [], htmlMarks: [], valid: true }
  parseRoot(fromMarkdown(markdown), context)
  return (
    context.valid && JSON.stringify(context.runs) === JSON.stringify(expected)
  )
}

function nativeMark(mark: string, links: Link[]): string {
  const link = links.find(definition => definition._key === mark)
  return link ? `link:${markdownDestination(link.href)}` : mark
}

function parseRoot(root: Root, context: ParseContext): void {
  if (root.children.length === 0) return
  if (root.children.length !== 1 || root.children[0]?.type !== 'paragraph') {
    context.valid = false
    return
  }
  for (const child of root.children[0].children) parseInline(child, [], context)
}

function parseInline(
  node: Nodes,
  inherited: string[],
  context: ParseContext,
): void {
  if (node.type === 'html') {
    parseHtml(node.value, inherited, context)
    return
  }
  const terminal = terminalText(node)
  if (terminal) {
    appendRun(context.runs, terminal.text, [
      ...inherited,
      ...context.htmlMarks,
      ...terminal.marks,
    ])
    return
  }
  const mark = markdownMark(node)
  if (!mark || !('children' in node)) {
    context.valid = false
    return
  }
  for (const child of node.children)
    parseInline(child, [...inherited, mark], context)
}

function terminalText(node: Nodes): Run | undefined {
  if (node.type === 'text') return { text: node.value, marks: [] }
  if (node.type === 'inlineCode') return { text: node.value, marks: ['code'] }
  if (node.type === 'break') return { text: '\n', marks: [] }
  return undefined
}

function markdownMark(node: Nodes): string | undefined {
  if (node.type === 'strong') return 'strong'
  if (node.type === 'emphasis') return 'em'
  if (node.type === 'link') return `link:${node.url}`
  return undefined
}

function parseHtml(
  value: string,
  inherited: string[],
  context: ParseContext,
): void {
  if (/^<br\s*\/?\s*>$/u.test(value)) {
    appendRun(context.runs, '\n', [...inherited, ...context.htmlMarks])
    return
  }
  const token = htmlTokens.get(value)
  if (!token) {
    context.valid = false
    return
  }
  if (token.closing) context.htmlMarks.pop()
  else context.htmlMarks.push(token.mark)
}

function appendRun(runs: Run[], text: string, marks: string[]): void {
  if (!text) return
  const normalized = [...marks].sort()
  const previous = runs.at(-1)
  if (previous && JSON.stringify(previous.marks) === JSON.stringify(normalized))
    previous.text += text
  else runs.push({ text, marks: normalized })
}
