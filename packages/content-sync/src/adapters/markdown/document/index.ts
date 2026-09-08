import type { PublicContentMetadata } from '@amaral.codes/content-contract'

import { sanitizePublicMarkdown } from '../sanitizer/index.ts'

export interface MarkdownDocument {
  content: string
  metadata: PublicContentMetadata
}

export function renderMarkdownDocument(document: MarkdownDocument): string {
  const frontmatter = renderFrontmatter(document.metadata)
  const content = sanitizePublicMarkdown(document.content).trim()

  return `${frontmatter}\n\n${content}\n`
}

function renderFrontmatter(metadata: PublicContentMetadata): string {
  const properties = Object.entries(metadata)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${renderFrontmatterValue(value)}`)
    .join('\n')

  return `---\n${properties}\n---`
}

function renderFrontmatterValue(value: unknown): string {
  return JSON.stringify(value)
}
