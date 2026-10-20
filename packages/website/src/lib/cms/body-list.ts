import type { TextBlock } from './body-text'

interface ListItemContext {
  level: number
  indent: string
  marker: string
  index: number
}
interface OrderedSequence {
  start: number | undefined
  count: number
}
export interface ListContext {
  items: ListItemContext[]
  sequences: Map<string, OrderedSequence>
  segment: number
  index: number
}

type BodyBlock = TextBlock | { _type: string }

export function createListContext(
  blocks: readonly BodyBlock[] = [],
): ListContext {
  const context: ListContext = {
    items: [],
    sequences: new Map(),
    segment: 0,
    index: 0,
  }
  precomputeListStarts(blocks, context)
  return context
}

function precomputeListStarts(
  blocks: readonly BodyBlock[],
  context: ListContext,
): void {
  // Native numbering selects the first present base across all list segments.
  for (const block of blocks) {
    if (isTextList(block)) listPrefix(block, context)
    else resetListContext(context)
  }
  for (const sequence of context.sequences.values()) sequence.count = 0
  context.items.length = 0
  context.segment = 0
  context.index = 0
}

function isTextList(block: BodyBlock): block is TextBlock {
  return (
    block._type === 'block' && 'listItem' in block && Boolean(block.listItem)
  )
}

export function resetListContext(context: ListContext): void {
  context.items.length = 0
  context.segment++
}

export function listPrefix(block: TextBlock, context: ListContext): string {
  const level = block.level ?? 1
  context.items = context.items.filter(item => item.level < level)
  const parent = context.items.at(-1)
  const indent = parent
    ? `${parent.indent}${' '.repeat(parent.marker.length + 1)}`
    : ''
  const marker = listMarker(block, parent, context)
  context.items.push({ level, indent, marker, index: context.index++ })
  return `${indent}${marker} `
}

function listMarker(
  block: TextBlock,
  parent: ListItemContext | undefined,
  context: ListContext,
): string {
  if (block.listItem !== 'number') return '-'
  return numberedMarker(block, parent, context)
}

function numberedMarker(
  block: TextBlock,
  parent: ListItemContext | undefined,
  context: ListContext,
): string {
  const sourceId = normalizedListId(block.listId)
  const scope = orderedScope(block, parent, context, sourceId)
  const sequence = context.sequences.get(scope) ?? {
    start: undefined,
    count: 0,
  }
  context.sequences.set(scope, sequence)
  const start = sequenceStart(sequence, sourceId ? block.listStart : undefined)
  return `${String(start + sequence.count++)}.`
}

function orderedScope(
  block: TextBlock,
  parent: ListItemContext | undefined,
  context: ListContext,
  sourceId: string | undefined,
): string {
  return JSON.stringify([
    sourceId ?? context.segment,
    block.level ?? 1,
    parent?.index,
  ])
}

function normalizedListId(value: string | undefined): string | undefined {
  const id = value?.trim()
  return id && id.length <= 128 ? id : undefined
}

function sequenceStart(
  sequence: OrderedSequence,
  start: number | undefined,
): number {
  sequence.start ??= start
  return sequence.start ?? 1
}
