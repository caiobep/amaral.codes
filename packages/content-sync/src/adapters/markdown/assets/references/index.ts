import { fromMarkdown } from 'mdast-util-from-markdown'
import type { Nodes } from 'mdast'

export type AssetKind = 'audio' | 'file' | 'image' | 'pdf' | 'video'
type MarkdownImageNode = Extract<Nodes, { type: 'image' }>

export interface MarkdownAssetReference {
  caption: string
  end: number
  kind: AssetKind
  source: string
  start: number
}

type AssetRewriter = (reference: MarkdownAssetReference) => Promise<string>

const MEDIA_PATTERN = /<(?<element>audio|file|pdf|video)\s+src="([^"]+)"[^>]*>([^<]*)<\/\k<element>>/g
const CODE_NODE_TYPES = new Set(['code', 'inlineCode'])

export async function rewriteMarkdownAssets(
  markdown: string,
  rewriteAsset: AssetRewriter,
): Promise<string> {
  const references = findMarkdownAssetReferences(markdown)
  const results = await Promise.allSettled(
    references.map(async reference => ({
      ...reference,
      value: await rewriteAsset(reference),
    })),
  )
  const failure = results.find(result => result.status === 'rejected')
  if (failure?.status === 'rejected') throw failure.reason

  const replacements = results.map(result => {
    if (result.status === 'rejected') throw result.reason
    return result.value
  })

  return replacements
    .sort((left, right) => right.start - left.start)
    .reduce(
      (output, replacement) =>
        output.slice(0, replacement.start)
        + replacement.value
        + output.slice(replacement.end),
      markdown,
    )
}

export function findMarkdownAssetReferences(
  markdown: string,
): MarkdownAssetReference[] {
  return [
    ...findImageReferences(markdown),
    ...findMediaReferences(markdown),
  ].sort((left, right) => left.start - right.start)
}

function findImageReferences(markdown: string): MarkdownAssetReference[] {
  const root = fromMarkdown(markdown)
  const images: MarkdownAssetReference[] = []

  walkMarkdownTree(root, node => {
    const image = toImageReference(node, markdown)
    if (image) images.push(image)
  })

  return images
}

function toImageReference(
  node: Nodes,
  markdown: string,
): MarkdownAssetReference | null {
  if (node.type !== 'image') return null
  return readImageReference(node, markdown)
}

function readImageReference(
  node: MarkdownImageNode,
  markdown: string,
): MarkdownAssetReference | null {
  const offsets = getImageOffsets(node)
  if (!offsets) return null

  const sourceOffset = markdown.slice(offsets.start, offsets.end).indexOf(node.url)
  if (sourceOffset < 0) return null

  return {
    caption: node.alt ?? '',
    end: offsets.start + sourceOffset + node.url.length,
    kind: 'image',
    source: node.url,
    start: offsets.start + sourceOffset,
  }
}

function getImageOffsets(
  node: MarkdownImageNode,
): { end: number; start: number } | null {
  const start = node.position?.start.offset
  const end = node.position?.end.offset
  return start === undefined || end === undefined ? null : { end, start }
}

function walkMarkdownTree(node: Nodes, visit: (node: Nodes) => void): void {
  visit(node)
  if (!('children' in node)) return
  node.children.forEach(child => walkMarkdownTree(child, visit))
}

function findMediaReferences(markdown: string): MarkdownAssetReference[] {
  const excludedRanges = findCodeRanges(markdown)
  return [...markdown.matchAll(MEDIA_PATTERN)].flatMap(match => {
    const kind = match.groups?.element
    const source = match[2]
    const caption = match[3]
    if (!kind || !source || caption === undefined) return []
    if (excludedRanges.some(range => match.index >= range.start && match.index < range.end)) {
      return []
    }
    return [{
      caption: caption.trim(),
      end: match.index + match[0].length,
      kind: kind as Exclude<AssetKind, 'image'>,
      source,
      start: match.index,
    }]
  })
}

function findCodeRanges(markdown: string): { end: number; start: number }[] {
  const ranges: { end: number; start: number }[] = []
  walkMarkdownTree(fromMarkdown(markdown), node => {
    const range = getCodeRange(node)
    if (range) ranges.push(range)
  })
  return ranges
}

function getCodeRange(node: Nodes): { end: number; start: number } | null {
  if (!CODE_NODE_TYPES.has(node.type)) return null
  return getPositionRange(node.position)
}

function getPositionRange(
  position: Nodes['position'],
): { end: number; start: number } | null {
  if (!position) return null
  const start = position.start.offset
  const end = position.end.offset
  if (start === undefined) return null
  if (end === undefined) return null
  return { end, start }
}
