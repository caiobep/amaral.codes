import { createSearchEngine } from '../../lib/search'
import type { SearchDocument } from '../../lib/search'
import type { SearchState } from './types'

export function loadSearchEngine(state: SearchState) {
  if (state.engine) return Promise.resolve(state.engine)
  if (state.loadPromise) return state.loadPromise

  state.loadPromise = fetch('/search-index.json')
    .then(requireSearchIndex)
    .then((documents) => {
      state.engine = createSearchEngine(documents)
      return state.engine
    })
    .catch((error: unknown) => {
      delete state.loadPromise
      throw error
    })

  return state.loadPromise
}

async function requireSearchIndex(response: Response): Promise<SearchDocument[]> {
  if (!response.ok) throw new Error(`Search index returned ${String(response.status)}`)
  return await response.json() as SearchDocument[]
}
