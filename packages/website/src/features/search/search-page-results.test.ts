// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { getStatusText, renderResults } from './search-page-results'
import type { SearchDocument } from './search-document'

const note: SearchDocument = { id: 'note', type: 'writing', category: 'note', title: 'Tools for work', summary: 'Software notes', href: '/posts/tools', topics: ['tools'], content: '', date: '2022-01-01', external: false }
const project: SearchDocument = { id: 'project', type: 'project', category: 'software', title: '<img onerror=bad>', summary: '', href: 'https://example.com/tools', topics: [], content: '', date: 'invalid', external: true }

describe('search page results', () => {
  it('renders untrusted text safely with external links and date fallbacks', () => {
    const results = document.createElement('ol')
    renderResults(results, [note, project])
    expect(results.querySelector('img')).toBeNull()
    expect(results.querySelector('[target="_blank"]')?.getAttribute('rel')).toBe('noopener noreferrer')
    expect(results.textContent).toContain('Jan 2022')
    expect(results.textContent).toContain('invalid')
    expect(getStatusText('x', 0)).toContain('No results')
    expect(getStatusText('x', 2)).toContain('2 results')
  })
})
