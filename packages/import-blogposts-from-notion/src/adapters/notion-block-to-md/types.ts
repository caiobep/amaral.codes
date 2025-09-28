import type { ListBlockChildrenResponseResult } from 'notion-to-md/build/types'
import { NotionToMarkdown } from 'notion-to-md'

export type BlockTransformer = (
  block: ListBlockChildrenResponseResult,
  n2mClient: NotionToMarkdown,
) => string | boolean | Promise<string | boolean>
