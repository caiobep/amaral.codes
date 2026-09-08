export type NavigationId = 'about' | 'home' | 'posts' | 'projects'

interface NavigationLinkInput {
  currentHref: string
  download: boolean
  href: string
  target: string
}

const navigationRoutes: readonly { id: NavigationId, path: string }[] = [
  { id: 'home', path: '/' },
  { id: 'projects', path: '/projects' },
  { id: 'posts', path: '/posts' },
  { id: 'about', path: '/about' },
]

export const resolveActiveNavigation = (pathname: string): NavigationId | undefined => (
  navigationRoutes.find(({ path }) => (
    path === '/' ? pathname === path : pathname.startsWith(path)
  ))?.id
)

export const shouldUseNativeNavigation = ({
  currentHref,
  download,
  href,
  target,
}: NavigationLinkInput) => {
  if (download) return false
  if (target !== '' && target !== '_self') return false

  const current = new URL(currentHref)
  const destination = new URL(href, current)
  const isPageNavigation = destination.pathname !== current.pathname || destination.search !== current.search
  return destination.origin === current.origin && isPageNavigation
}
