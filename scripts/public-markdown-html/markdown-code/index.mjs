import { fromMarkdown } from 'mdast-util-from-markdown'

export function maskMarkdownCode(markdown) {
  const output = []
  let cursor = 0
  for (const { start, end } of findCodePositions(fromMarkdown(markdown))) {
    output.push(
      markdown.slice(cursor, start.offset),
      maskText(markdown.slice(start.offset, end.offset)),
    )
    cursor = end.offset
  }
  output.push(markdown.slice(cursor))
  return output.join('')
}

function findCodePositions(node) {
  if (node.type === 'code' || node.type === 'inlineCode') return [node.position]
  return 'children' in node ? node.children.flatMap(findCodePositions) : []
}

function maskText(value) {
  return value.replace(/[^\r\n]/g, ' ')
}
