export function normalizeNotionPageIdOrUrl(str: string): string {
  const isUrl = str.startsWith('http')
  if (!isUrl) return str

  const url = new URL(str)
  const versionWithText = url.pathname.split('/').at(-1)
  return versionWithText?.split('-').at(-1) || ''
}
