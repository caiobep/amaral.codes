import { applyBrowserChromeSurface } from '../../../features/appearance/appearance.client'

let footerObserver: IntersectionObserver | null = null
let observedFooter: Element | null = null

const setFooterVisibility = (visible: boolean) => {
  applyBrowserChromeSurface(visible ? 'footer' : 'page')
}

export const initializeFooterChrome = () => {
  const footer = document.querySelector('.footer-shell')
  if (footer === observedFooter) return

  footerObserver?.disconnect()
  footerObserver = null
  observedFooter = footer

  if (!footer) {
    setFooterVisibility(false)
    return
  }

  footerObserver = new IntersectionObserver(([entry]) => {
    setFooterVisibility(entry?.isIntersecting === true)
  })
  footerObserver.observe(footer)
}
