import { initializeSearch } from './search/runtime'

document.addEventListener('astro:page-load', initializeSearch)
initializeSearch()
