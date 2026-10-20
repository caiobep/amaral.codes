import type { Nodes } from 'mdast'
import { fromMarkdown } from 'mdast-util-from-markdown'

export function extractMarkdownProse(markdown: string, htmlProse: (markup: string) => string): string {
  return prose(fromMarkdown(markdown), htmlProse)
}

function prose(node: Nodes, htmlProse: (markup: string) => string): string {
  if (node.type === 'paragraph') return node.children.map(inlineText).join('')
  if (node.type === 'html') return htmlProse(node.value)
  if (node.type === 'heading') return ''
  if ('children' in node) {
    return node.children.map(child => prose(child, htmlProse)).filter(Boolean).join(' ')
  }
  return ''
}

function inlineText(node: Nodes): string {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value
  if ('children' in node) return node.children.map(inlineText).join('')
  if (node.type === 'break') return ' '
  return ''
}
