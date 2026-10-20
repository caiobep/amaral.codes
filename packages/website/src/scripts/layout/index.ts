import { initializeHeaderSearch } from '../../features/search/header-search.client'
import { initializeAppearance } from '../../features/appearance/appearance.client'
import { initializeFooterChrome } from './footer-chrome/runtime'
import { initializeMobileHeader } from './mobile-header'
import { initializePageMotion } from './motion'
import { initializeNavigationState } from './navigation-state/runtime'
import { initializePwa } from './pwa'
import { initializeSwipeNavigation } from './swipe-navigation'
import { initializeTouchFocus } from './touch-focus'
import { initializeShareControls } from '../../features/sharing/share.client'
import { initializeTalkMaterialPreviews } from '../../features/talks/material-preview.client'

const initializers = [
  initializeNavigationState,
  initializeHeaderSearch,
  initializeMobileHeader,
  initializeAppearance,
  initializeFooterChrome,
  initializePageMotion,
  initializePwa,
  initializeShareControls,
  initializeTalkMaterialPreviews,
  initializeSwipeNavigation,
]

initializers.forEach((initialize) => {
  document.addEventListener('astro:page-load', initialize)
  initialize()
})

document.addEventListener('astro:after-swap', () => {
  initializeNavigationState()
  initializeAppearance()
})

initializeTouchFocus()
