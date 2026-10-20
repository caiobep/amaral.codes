import { escapeHtml, escapeMarkdownLabel } from '../../../../serialization.ts'
import { requirePublicHttpsUrl } from '@amaral.codes/content-contract/public-url'
import type {
  LinkBlockData,
  NotionBlockResponse,
} from '../types/index.ts'

export function renderUnsupportedBlock(block: NotionBlockResponse): string {
  if (!block.type) throw new Error('Notion returned a partial block')

  const data = getLinkBlockData(block)
  const renderer = getUnsupportedBlockRenderer(block.type)
  if (data?.url && renderer) return renderer(data)

  throw new Error(`Cannot convert unsupported Notion ${block.type} block`)
}

function getLinkBlockData(block: NotionBlockResponse): LinkBlockData | undefined {
  if (block.type === 'bookmark') return block.bookmark
  if (block.type === 'embed') return block.embed
  if (block.type === 'link_preview') return block.link_preview
  return undefined
}

function getUnsupportedBlockRenderer(
  blockType: string,
): ((data: LinkBlockData) => string) | undefined {
  const renderers: Record<string, (data: LinkBlockData) => string> = {
    bookmark: renderLink,
    embed: renderEmbed,
    link_preview: renderLink,
  }
  return renderers[blockType]
}

function renderEmbed(data: LinkBlockData): string {
  const url = requirePublicHttpsUrl(data.url ?? '', 'Notion embed URL')
  const title = getLinkLabel(data, 'Embedded content')

  return [
    '<figure>',
    `  <iframe src="${escapeHtml(url)}" title="${escapeHtml(title)}" loading="lazy" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"></iframe>`,
    '</figure>',
  ].join('\n')
}

function renderLink(data: LinkBlockData): string {
  const url = requirePublicHttpsUrl(data.url ?? '', 'Notion link URL')
  return `[${escapeMarkdownLabel(getLinkLabel(data, url))}](${url})`
}

function getLinkLabel(data: LinkBlockData, fallback: string): string {
  return getLinkCaption(data) ?? getUrlLabel(data.url, fallback)
}

function getLinkCaption(data: LinkBlockData): string | undefined {
  const caption = data.caption
    ?.map(part => part.plain_text ?? '')
    .join('')
    .trim()
  return caption && caption.length > 0 ? caption : undefined
}

function getUrlLabel(url: string | undefined, fallback: string): string {
  try {
    const hostname = new URL(url ?? '').hostname.replace(/^www\./, '')
    return hostname.length > 0 ? hostname : fallback
  } catch {
    return fallback
  }
}
