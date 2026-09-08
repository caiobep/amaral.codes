import { normalizeNotionMarkdown } from './normalization/index.ts'
import { resolveUnknownBlocks } from './unknown-blocks/index.ts'
import type { NotionMarkdownClient } from './types/index.ts'

export { normalizeNotionMarkdown } from './normalization/index.ts'
export type { NotionMarkdownClient } from './types/index.ts'

export async function getPageContentsInMarkdown(
  pageId: string,
  notionClient: NotionMarkdownClient,
): Promise<string> {
  const response = await notionClient.pages.retrieveMarkdown({
    page_id: pageId,
  })
  const markdown = await resolveUnknownBlocks(response, notionClient, new Set())

  return normalizeNotionMarkdown(markdown)
}
