import type { SearchDocument } from './search-document'

type BrowserSearchModule = typeof import('./browser-search')

export interface BrowserSearchRuntime {
  engine: ReturnType<BrowserSearchModule['createSearchEngine']>
  searchDocuments: BrowserSearchModule['searchDocuments']
}

let runtime: BrowserSearchRuntime | undefined
let runtimePromise: Promise<BrowserSearchRuntime> | undefined

async function requireSearchDocuments(response: Response): Promise<SearchDocument[]> {
  if (!response.ok) throw new Error(`Search index returned ${String(response.status)}`)
  return await response.json() as SearchDocument[]
}

export function loadBrowserSearch() {
  if (runtime) return Promise.resolve(runtime)
  if (runtimePromise) return runtimePromise

  runtimePromise = Promise.all([
    fetch('/search-index.json').then(requireSearchDocuments),
    import('./browser-search'),
  ]).then(([documents, searchModule]) => {
    runtime = {
      engine: searchModule.createSearchEngine(documents),
      searchDocuments: searchModule.searchDocuments,
    }
    return runtime
  }).catch((error: unknown) => {
    runtimePromise = undefined
    throw error
  })

  return runtimePromise
}

export function resetBrowserSearchForTesting() {
  runtime = undefined
  runtimePromise = undefined
}
