import { resolveActiveNavigation, shouldUseNativeNavigation } from './index'

const setCurrentPage = (element: Element, current: boolean) => {
  if (current) element.setAttribute('aria-current', 'page')
  else element.removeAttribute('aria-current')
}

const useNativeMobileNavigation = () => {
  const mobile = window.matchMedia('(max-width: 920px) and (hover: none) and (pointer: coarse)')
  if (!mobile.matches) return

  document.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((link) => {
    const shouldReload = shouldUseNativeNavigation({
      currentHref: window.location.href,
      download: link.hasAttribute('download'),
      href: link.href,
      target: link.target,
    })
    if (shouldReload) link.setAttribute('data-astro-reload', '')
  })
}

export const initializeNavigationState = () => {
  useNativeMobileNavigation()
  const activeId = resolveActiveNavigation(window.location.pathname)
  document.querySelectorAll<HTMLElement>('[data-nav-id]').forEach((link) => {
    setCurrentPage(link, link.dataset.navId === activeId)
  })

  const searchLink = document.querySelector('[data-header-search-link]')
  if (searchLink) setCurrentPage(searchLink, window.location.pathname.startsWith('/search'))
}
