import { fromMarkdown } from 'mdast-util-from-markdown'
import type { Nodes } from 'mdast'
import { renderUnsupportedBlock } from '../unsupported-block-renderer/index.ts'
import type {
  NotionMarkdownClient,
  NotionMarkdownResponse,
} from '../types/index.ts'

interface UnknownBlockReference {
  blockId: string
  end: number
  source: string
  start: number
}

const UNKNOWN_BLOCK_PATTERN = /<unknown\s+url="([^"]+)"\s+alt="[^"]*"\s*\/>/g
const NOTION_ID_PATTERN = /^[a-f\d]{32}$/i

export async function resolveUnknownBlocks(
  response: NotionMarkdownResponse,
  notionClient: NotionMarkdownClient,
  visitedBlockIds: Set<string>,
): Promise<string> {
  const references = getUnknownBlockReferences(response.markdown)
  if (references.length === 0) {
    assertCompleteResponse(response)
    return response.markdown
  }

  const truncatedIds = new Set(response.unknown_block_ids.map(normalizeNotionId))
  const replacements = await Promise.all(
    references.map(async reference => ({
      end: reference.end,
      start: reference.start,
      value: await resolveUnknownBlock(
        reference,
        truncatedIds,
        notionClient,
        visitedBlockIds,
      ),
    })),
  )

  return replacements
    .sort((left, right) => right.start - left.start)
    .reduce(
      (markdown, replacement) => markdown.slice(0, replacement.start)
        + replacement.value
        + markdown.slice(replacement.end),
      response.markdown,
    )
}

async function resolveUnknownBlock(
  reference: UnknownBlockReference,
  truncatedIds: Set<string>,
  notionClient: NotionMarkdownClient,
  visitedBlockIds: Set<string>,
): Promise<string> {
  if (truncatedIds.has(reference.blockId) && !visitedBlockIds.has(reference.blockId)) {
    const nestedVisitedIds = new Set(visitedBlockIds).add(reference.blockId)
    const nested = await notionClient.pages.retrieveMarkdown({
      page_id: reference.blockId,
    })

    if (nested.markdown.trim() !== reference.source.trim()) {
      return resolveUnknownBlocks(nested, notionClient, nestedVisitedIds)
    }
  }

  const block = await notionClient.blocks.retrieve({
    block_id: reference.blockId,
  })
  return renderUnsupportedBlock(block)
}

function getUnknownBlockReferences(markdown: string): UnknownBlockReference[] {
  const references: UnknownBlockReference[] = []
  walkMarkdownTree(fromMarkdown(markdown), node => {
    if (node.type !== 'html') return
    const nodeStart = node.position?.start.offset
    if (nodeStart === undefined) return

    references.push(...[...node.value.matchAll(UNKNOWN_BLOCK_PATTERN)].flatMap(match => {
      const url = match[1]
      if (!url) return []
      const start = nodeStart + match.index
      return [{
        blockId: getBlockIdFromNotionUrl(url),
        end: start + match[0].length,
        source: match[0],
        start,
      }]
    }))
  })
  return references
}

function getBlockIdFromNotionUrl(rawUrl: string): string {
  const url = new URL(rawUrl)
  if (!isNotionUrl(url)) {
    throw new Error('Notion returned an unknown block reference with an invalid URL')
  }
  const candidate = firstNonEmpty(
    url.hash.slice(1),
    url.pathname.split('/').at(-1),
  )
  const blockId = normalizeNotionId(candidate)

  if (!blockId) throw new Error('Could not read a Notion block id from the supplied URL')
  return blockId
}

function isNotionUrl(url: URL): boolean {
  if (url.protocol !== 'https:' || url.username || url.password) return false
  const hostname = url.hostname.toLowerCase()
  return ['notion.com', 'notion.site', 'notion.so']
    .some(domain => hostname === domain || hostname.endsWith(`.${domain}`))
}

function normalizeNotionId(value: string): string {
  const compactId = value.replaceAll('-', '')
  if (!NOTION_ID_PATTERN.test(compactId)) return ''

  return [
    compactId.slice(0, 8),
    compactId.slice(8, 12),
    compactId.slice(12, 16),
    compactId.slice(16, 20),
    compactId.slice(20),
  ].join('-')
}

function assertCompleteResponse(response: NotionMarkdownResponse): void {
  if (!response.truncated && response.unknown_block_ids.length === 0) return
  throw new Error(
    `Notion returned incomplete markdown for ${response.id}: ${String(response.unknown_block_ids.length)} unresolved blocks`,
  )
}

function firstNonEmpty(...values: (string | undefined)[]): string {
  return values.find(value => value !== undefined && value.length > 0) ?? ''
}

function walkMarkdownTree(node: Nodes, visit: (node: Nodes) => void): void {
  visit(node)
  if (!('children' in node)) return
  node.children.forEach(child => walkMarkdownTree(child, visit))
}
