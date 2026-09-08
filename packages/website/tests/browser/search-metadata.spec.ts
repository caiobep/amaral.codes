import { expect, test } from '@playwright/test'

const writingTypes = [
  ['essay', 'Essay'],
  ['note', 'Note'],
  ['review', 'Review'],
  ['podcast', 'Podcast'],
  ['talk', 'Talk'],
  ['video', 'Video'],
  ['link', 'Link'],
] as const

const documents = [
  ...writingTypes.map(([category]) => ({
    id: `post:${category}`,
    type: 'writing' as const,
    title: `Result ${category}`,
    summary: '',
    content: '',
    href: `/posts/${category}`,
    category,
    topics: [],
    external: false,
  })),
  {
    id: 'project:desktop',
    type: 'project' as const,
    title: 'Result project',
    summary: '',
    content: '',
    href: '/projects/desktop',
    category: 'Desktop',
    topics: [],
    external: false,
  },
]

test('search results expose one accurate content type in visible and accessible metadata', async ({ page }) => {
  await page.route('**/search-index.json', (route) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify(documents),
  }))

  await page.goto('/search')
  await page.getByRole('searchbox', { name: 'Search the site' }).fill('result')

  const results = page.locator('[data-search-results] > li')
  await expect(results).toHaveCount(documents.length)

  const expectedMetadata = [
    ...writingTypes.map(([, label]) => [label]),
    ['Project', 'Desktop'],
  ]

  for (const [index, expected] of expectedMetadata.entries()) {
    const metadata = results.nth(index).locator('a > p').first()
    expect(await metadata.locator('span').allTextContents()).toEqual(expected)
    await expect(metadata).toHaveAttribute('aria-label', expected.join(', '))
  }
})
