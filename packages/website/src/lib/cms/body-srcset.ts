import { parseSrcset, stringifySrcset } from 'srcset'
import type { SrcSetDefinition } from 'srcset'
import { isPublishableUrl } from './body-url'

export function rewriteCmsSrcset(
  value: string,
  rewriteUrl?: (url: string) => string,
): string {
  const sources = parsePublicSrcset(value).map(source => ({
    ...source,
    url: rewriteUrl ? rewriteUrl(source.url) : source.url,
  }))
  return stringifySrcset(sources, { strict: true })
}

export function cmsSrcsetUrls(value: string): string[] {
  return parsePublicSrcset(value).map(source => source.url)
}

function parsePublicSrcset(value: string): SrcSetDefinition[] {
  const sources = parseStrictSrcset(value)
  if (value.trim() && sources.length === 0)
    throw new Error('CMS HTML contains malformed image sources')
  return sources.map(validateSource)
}

function parseStrictSrcset(value: string): SrcSetDefinition[] {
  try {
    return parseSrcset(value, { strict: true })
  } catch {
    throw new Error('CMS HTML contains malformed image sources')
  }
}

function validateSource(source: SrcSetDefinition): SrcSetDefinition {
  if (!isPublishableUrl(source.url))
    throw new Error('CMS HTML contains an unsafe or private URL')
  return source
}
