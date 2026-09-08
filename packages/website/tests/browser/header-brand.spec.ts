import { expect, test } from '@playwright/test'

test('header wordmark consistently uses Georgia', async ({ page }) => {
  await page.goto('/')

  const wordmark = page.locator('.brand span')

  await expect(wordmark).toHaveCSS('font-family', /Georgia/u)
  await expect(wordmark).not.toHaveCSS('font-family', /Instrument Serif/u)
})
