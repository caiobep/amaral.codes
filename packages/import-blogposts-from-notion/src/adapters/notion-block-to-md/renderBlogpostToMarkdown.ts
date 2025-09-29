export interface MarkdownWithHeader {
  header?: string
  content: string
  metadata?: Record<string, any>
}

export function recordToPageHeader(
  headerProps: Record<string, string | object>,
) {
  const pageHeaders = Object.entries(headerProps)
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
    .join('\n')

  return `---\n${pageHeaders}\n---`
}

export function renderRecordAsMarkdownWithMetadata(md: MarkdownWithHeader): string {
  const { header, content, metadata } = md
  const postHeader = recordToPageHeader(metadata)
  const title = header ? `# ${header}` : ''

  return `${title}\n${postHeader}\n${content}`
}
