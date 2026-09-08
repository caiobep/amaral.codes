export const PUBLIC_ASSET_ORIGIN = 'https://pub-aacefab4a1bf472d8cc20cc5b9434399.r2.dev'

const EXTERNAL_ASSET_PATH_PREFIXES = ['/podcasts/'] as const

export function resolvePublicAssetUrl(url: string) {
  const isExternallyHosted = EXTERNAL_ASSET_PATH_PREFIXES.some((prefix) => url.startsWith(prefix))
  return isExternallyHosted ? `${PUBLIC_ASSET_ORIGIN}${url}` : url
}
