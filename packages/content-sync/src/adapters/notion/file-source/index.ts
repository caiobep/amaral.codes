import type { NotionClient } from '../client/index.ts'

interface NotionFileMetadata {
  permissionRecord?: { id?: string }
}

interface FileBlockData {
  external?: { url?: string }
  file?: { url?: string }
}

interface BlockParent {
  block_id?: string
  page_id?: string
  type?: string
}

type RetrievedBlock = Awaited<ReturnType<NotionClient['blocks']['retrieve']>>

const MAX_BLOCK_ANCESTRY_DEPTH = 100

export function createNotionFileSourceResolver(
  notion: Pick<NotionClient, 'blocks'>,
  sourcePageId: string,
): (source: string) => Promise<string> {
  return async source => {
    if (!source.startsWith('file://')) return source
    const blockId = getNotionFileBlockId(source)
    const block = await notion.blocks.retrieve({ block_id: blockId })
    await assertBlockOwnedByPage(block, sourcePageId, notion)
    return getFileUrlFromBlock(block, blockId)
  }
}

async function assertBlockOwnedByPage(
  block: RetrievedBlock,
  sourcePageId: string,
  notion: Pick<NotionClient, 'blocks'>,
): Promise<void> {
  const visitedBlockIds = new Set<string>()
  let currentBlock = block

  for (let depth = 0; depth < MAX_BLOCK_ANCESTRY_DEPTH; depth += 1) {
    const parentBlockId = getParentBlockId(getBlockParent(currentBlock), sourcePageId)
    if (!parentBlockId) return

    const normalizedParentId = normalizeNotionId(parentBlockId)
    if (visitedBlockIds.has(normalizedParentId)) {
      throw new Error('Notion file block ancestry contained a cycle')
    }
    visitedBlockIds.add(normalizedParentId)
    currentBlock = await notion.blocks.retrieve({ block_id: parentBlockId })
  }

  throw new Error('Notion file block does not belong to its source page')
}

function getBlockParent(block: RetrievedBlock): BlockParent {
  if (!('type' in block)) throw new Error('Notion returned a partial block')
  const parent = (block as unknown as Record<string, unknown>).parent
  if (typeof parent !== 'object' || parent === null) {
    throw new Error('Notion returned a block without parent data')
  }
  return parent
}

function getParentBlockId(
  parent: BlockParent,
  sourcePageId: string,
): string | undefined {
  if (parent.type === 'page_id' && sameNotionId(parent.page_id, sourcePageId)) {
    return undefined
  }
  if (parent.type === 'block_id' && parent.block_id) return parent.block_id
  throw new Error('Notion file block does not belong to its source page')
}

function sameNotionId(left: string | undefined, right: string): boolean {
  return Boolean(left) && normalizeNotionId(left ?? '') === normalizeNotionId(right)
}

function normalizeNotionId(value: string): string {
  return value.replaceAll('-', '').toLowerCase()
}

function getNotionFileBlockId(source: string): string {
  const blockId = parseNotionFileMetadata(source).permissionRecord?.id
  if (blockId) return blockId
  throw new Error('Notion file metadata did not include a block id')
}

function parseNotionFileMetadata(source: string): NotionFileMetadata {
  try {
    const value: unknown = JSON.parse(decodeURIComponent(source.slice('file://'.length)))
    if (typeof value !== 'object' || value === null) {
      throw new Error('Notion file metadata was not an object')
    }
    return value
  } catch (error) {
    throw new Error('Could not parse Notion file metadata', { cause: error })
  }
}

function getFileUrlFromBlock(
  block: RetrievedBlock,
  blockId: string,
): string {
  if (!('type' in block)) throw new Error(`Notion returned a partial block for ${blockId}`)

  const blockData = block as unknown as Record<string, unknown>
  const data = blockData[block.type] as FileBlockData
  const currentUrl = readCurrentFileUrl(data)
  if (currentUrl) return currentUrl
  throw new Error(`Notion did not return a file URL for ${blockId}`)
}

function readCurrentFileUrl(data: FileBlockData): string | undefined {
  return data.file?.url ?? data.external?.url
}
