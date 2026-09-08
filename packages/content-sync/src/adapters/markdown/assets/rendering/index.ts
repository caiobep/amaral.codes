import path from 'node:path'
import {
  requirePublicHttpsUrl,
  requirePublicUrl,
} from '@amaral.codes/content-contract/public-url'
import type { MarkdownAssetReference } from '../references/index.ts'

const LINK_ASSET_KINDS = new Set(['file', 'pdf'])

export function renderYoutubeEmbed(reference: MarkdownAssetReference): string | null {
  if (reference.kind !== 'video') return null
  const url = parsePublicHttpsUrl(reference.source)
  if (!url) return null
  const videoId = getYoutubeVideoId(url)
  if (!videoId) return null

  const title = reference.caption || 'YouTube video'
  return `<iframe src="https://www.youtube-nocookie.com/embed/${escapeHtml(videoId)}" title="${escapeHtml(title)}" loading="lazy" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-popups allow-presentation" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`
}

export function renderExternalAsset(
  reference: MarkdownAssetReference,
  source: string,
): string {
  if (reference.kind === 'image') {
    return normalizePublicSource(requirePublicUrl(source, 'image URL'))
  }
  const publicSource = requirePublicHttpsUrl(source, `${reference.kind} URL`)
  if (LINK_ASSET_KINDS.has(reference.kind)) {
    return `[${escapeMarkdown(getAssetTitle(reference, publicSource))}](${publicSource})`
  }

  return `<${reference.kind} src="${escapeHtml(publicSource)}" controls preload="metadata">${escapeHtml(reference.caption)}</${reference.kind}>`
}

function parsePublicHttpsUrl(source: string): URL | null {
  try {
    return new URL(requirePublicHttpsUrl(source, 'Media URL'))
  } catch {
    return null
  }
}

function getYoutubeVideoId(url: URL): string | null {
  const hostname = url.hostname.replace(/^www\./, '')
  if (hostname === 'youtu.be') return url.pathname.slice(1)
  if (hostname !== 'youtube.com' && !hostname.endsWith('.youtube.com')) return null
  return url.searchParams.get('v')
}

function normalizePublicSource(source: string): string {
  return source.startsWith('https://') ? new URL(source).href : source
}

function getAssetTitle(reference: MarkdownAssetReference, source: string): string {
  if (reference.caption) return reference.caption
  const fileName = path.basename(decodeURIComponent(new URL(source).pathname))
  if (fileName) return fileName
  return reference.kind === 'file' ? 'Download file' : reference.kind
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function escapeMarkdown(value: string): string {
  return value.replaceAll('[', '\\[').replaceAll(']', '\\]')
}
