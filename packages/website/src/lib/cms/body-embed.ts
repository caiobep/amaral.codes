import { z } from 'astro/zod'
import { sanitizeCmsHtml } from './body-html'
import { escapeMarkdown, markdownDestination, publicUrl } from './body-url'

const embed = z.object({
  _type: z.literal('embed'),
  url: publicUrl,
  caption: z.string().optional(),
  html: z.string().optional(),
  provider: z.string().optional(),
})
export const embedBlock = embed.transform(block => ({
  _type: block._type,
  markdown: embedMarkdown(block),
}))
export const iframeBlock = z
  .object({
    _type: z.literal('iframe'),
    src: publicUrl.refine(value => value.startsWith('https://')),
    title: z.string().optional(),
  })
  .transform(block => ({
    _type: block._type,
    markdown: publicLink(block.title ?? 'Embedded content', block.src),
  }))
export const fileBlock = z
  .object({
    _type: z.literal('file'),
    url: publicUrl,
    filename: z.string().optional(),
  })
  .transform(block => ({
    _type: block._type,
    markdown: publicLink(block.filename ?? 'Download file', block.url),
  }))

function embedMarkdown(block: z.infer<typeof embed>): string {
  const link = publicLink(block.caption ?? 'Embedded content', block.url)
  const html = block.html ? sanitizeCmsHtml(block.html) : ''
  return html && usesEmbedHtml(block.url, block.provider)
    ? `${link}\n\n${html}`
    : link
}

export function usesEmbedHtml(url: string, provider: unknown): boolean {
  if (provider === 'video' || provider === 'audio') return false
  return (
    !/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}/u.test(
      url,
    ) && !/vimeo\.com\/\d+/u.test(url)
  )
}

function publicLink(label: string, url: string): string {
  return `[${escapeMarkdown(label)}](${markdownDestination(url)})`
}
