import { createNotionToMarkdownClient } from '../configuration/index.ts'
import {
  bookmarkToInlineLinkMentionProcessor,
  embedToIframeProcessor,
  videoToIFrameProcessor,
} from '../../notion-block-to-md/index.ts'

const standardProcessors = {
  embed: embedToIframeProcessor,
  video: videoToIFrameProcessor,
  bookmark: bookmarkToInlineLinkMentionProcessor,
} satisfies Parameters<typeof createNotionToMarkdownClient>[0]

export async function getPageContentsInMarkdown(
  postId: string,
  notionToMarkdownClient: ReturnType<typeof createNotionToMarkdownClient>,
) {
  const pageContents = await notionToMarkdownClient.pageToMarkdown(postId)
  const contentInMd = notionToMarkdownClient.toMarkdownString(pageContents)

  return contentInMd.parent
}

export async function createNotionMarkdownExporter(
  ...args: Parameters<typeof createNotionToMarkdownClient>
) {
  const [processors, ...options] = args
  const notionMarkdownClient = createNotionToMarkdownClient(
    { ...standardProcessors, ...processors },
    ...options,
  )
  return (p: string) => getPageContentsInMarkdown(p, notionMarkdownClient)
}
