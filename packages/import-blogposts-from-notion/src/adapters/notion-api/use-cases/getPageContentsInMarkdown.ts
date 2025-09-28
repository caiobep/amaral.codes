import { createNotionToMarkdownClient } from '../configuration/index.ts'

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
  const notionMarkdownClient = createNotionToMarkdownClient(...args)
  return (p: string) => getPageContentsInMarkdown(p, notionMarkdownClient)
}
