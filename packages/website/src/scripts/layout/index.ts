import { initializeHeaderSearch } from './header-search/runtime'
import { initializeFooterChrome } from './footer-chrome/runtime'
import { initializeMobileHeader } from './mobile-header'
import { initializePageMotion } from './motion'
import { initializeNavigationState } from './navigation-state/runtime'
import { initializePwa } from './pwa'
import { initializeSwipeNavigation } from './swipe-navigation'
import { initializeTheme } from './theme/runtime'
import { initializeTouchFocus } from './touch-focus'
import { initializeShareControls } from '../share/runtime'
import { initializeTalkMaterialPreviews } from '../talk-material-preview'

const initializers = [
  initializeNavigationState,
  initializeHeaderSearch,
  initializeMobileHeader,
  initializeTheme,
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
  initializeTheme()
})

initializeTouchFocus()
