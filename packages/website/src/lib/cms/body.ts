import { z } from 'astro/zod'
import { textBlock, serializeTextRun } from './body-text'
import type { TextBlock } from './body-text'
import { imageBlock, galleryBlock } from './body-media'
import { tableBlock } from './body-table'
import { htmlBlock } from './body-html'
import { embedBlock, iframeBlock, fileBlock } from './body-embed'
import { createListContext, resetListContext } from './body-list'
import type { ListContext } from './body-list'
export { hydrateCmsImages } from './body-media'

const codeBlock = z
  .object({
    _type: z.literal('code'),
    language: z
      .string()
      .regex(/^[^`\r\n]*$/u)
      .default(''),
    code: z.string(),
  })
  .transform(block => ({ _type: block._type, markdown: fencedCode(block) }))
const blockSchema = z.discriminatedUnion('_type', [
  textBlock,
  codeBlock,
  imageBlock,
  galleryBlock,
  tableBlock,
  embedBlock,
  iframeBlock,
  fileBlock,
  htmlBlock,
  z
    .object({ _type: z.literal('break') })
    .transform(block => ({ _type: block._type, markdown: '---' })),
])

export function serializeCmsBody(value: unknown): string {
  const blocks = z.array(blockSchema).parse(value ?? [])
  const chunks: string[] = []
  const text: TextBlock[] = []
  const lists = createListContext(blocks)
  for (const block of blocks) {
    if (block._type === 'block') text.push(block)
    else {
      flushText(text, chunks, lists)
      chunks.push(block.markdown)
    }
  }
  flushText(text, chunks, lists)
  return chunks.join('\n\n')
}

function flushText(
  text: TextBlock[],
  chunks: string[],
  lists: ListContext,
): void {
  if (text.length === 0) return
  chunks.push(serializeTextRun(text, lists))
  resetListContext(lists)
  text.length = 0
}

function fencedCode(block: { code: string; language: string }): string {
  const backticks = block.code.match(/`+/gu) ?? []
  const length = backticks.reduce(
    (longest, run) => Math.max(longest, run.length + 1),
    3,
  )
  const fence = '`'.repeat(length)
  return `${fence}${block.language}\n${block.code}\n${fence}`
}
