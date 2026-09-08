import { parseSecureHttpsUrl } from '@amaral.codes/content-contract/public-url'

const TRUSTED_ASSET_HOST_SUFFIXES = [
  'amazonaws.com',
  'notion.site',
  'notion.so',
  'notion-static.com',
] as const

export function isTrustedNotionAssetUrl(value: string): boolean {
  const url = parseSecureHttpsUrl(value)
  if (!url) return false

  return TRUSTED_ASSET_HOST_SUFFIXES.some(suffix =>
    url.hostname === suffix || url.hostname.endsWith(`.${suffix}`),
  )
}
