import { expect, it } from 'vitest'
import { getEntryHref, getProjectHref } from '.'

it('builds public content routes', () => {
  expect(getEntryHref('a-note')).toBe('/posts/a-note')
  expect(getProjectHref('a-project')).toBe('/projects/a-project')
})
