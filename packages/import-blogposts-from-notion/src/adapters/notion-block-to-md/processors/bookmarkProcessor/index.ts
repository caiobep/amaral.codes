import type { BlockTransformer } from '../../types.ts'

export const bookmarkToInlineLinkMentionProcessor: BlockTransformer = async (block, n2m) => {
  const { bookmark } = block as any
  const url: string | undefined = bookmark?.url
  if (!url) return ''

  const caption = await n2m.blockToMarkdown(bookmark?.caption)
  const label = caption?.trim()?.length ? caption : url

  return `[${label}](${url})`
}
