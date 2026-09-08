export interface LinkBlockData {
  caption?: { plain_text?: string }[]
  url?: string
}

export interface NotionMarkdownResponse {
  id: string
  markdown: string
  truncated: boolean
  unknown_block_ids: string[]
}

export interface NotionBlockResponse {
  bookmark?: LinkBlockData
  embed?: LinkBlockData
  id: string
  link_preview?: LinkBlockData
  type?: string
}

export interface NotionMarkdownClient {
  blocks: {
    retrieve(input: { block_id: string }): Promise<NotionBlockResponse>
  }
  pages: {
    retrieveMarkdown(input: { page_id: string }): Promise<NotionMarkdownResponse>
  }
}
