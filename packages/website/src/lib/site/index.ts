export function requireSite(site: URL | undefined): URL {
  if (site) return site
  throw new Error('Astro site URL is not configured.')
}

export function createCanonicalUrl(pathname: string, site: URL | undefined): string {
  return new URL(pathname, requireSite(site)).toString()
}
