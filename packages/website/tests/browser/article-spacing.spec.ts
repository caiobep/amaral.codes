import { expect, test } from '@playwright/test'

test('article text stays close to the topic tags', async ({ page }) => {
  await page.goto('/posts/fixture-essay')

  await expect(page.locator('.article header + .content')).toHaveCSS('margin-top', '8px')
  const gap = await page.locator('.article').evaluate((article) => {
    const tags = article.querySelector('.tag-list')
    const body = article.querySelector('.content')
    if (!tags || !body) throw new Error('Article topics and body must be present')
    return body.getBoundingClientRect().top - tags.getBoundingClientRect().bottom
  })
  expect(gap).toBeGreaterThan(16)
  expect(gap).toBeLessThan(52)
})
