const EXCLUDED_PATHS = new Set([
  '/deeplink/',
  '/content-index.json/',
  '/llms-full.txt/',
  '/llms.txt/',
  '/offline/',
  '/physical-projects/',
  '/reviews/',
  '/search/',
])

const toRoutePath = (page) => {
  const pathname = new URL(page).pathname
  return pathname.endsWith('/') ? pathname : `${pathname}/`
}

export const shouldIncludeInSitemap = (page) => {
  const routePath = toRoutePath(page)
  return !EXCLUDED_PATHS.has(routePath) &&
    !routePath.startsWith('/utils/') &&
    !routePath.endsWith('.md/')
}
