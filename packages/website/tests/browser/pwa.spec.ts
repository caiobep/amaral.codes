import { expect, test } from '@playwright/test'

test.use({ serviceWorkers: 'allow' })

test('the Reviews app shortcut opens its filtered route offline', async ({ context, page, request }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium')

  const reviewsShortcutUrl = '/posts?category=review'
  const manifest = await (await request.get('/manifest.webmanifest')).text()
  expect(manifest).toContain(`"url": "${reviewsShortcutUrl}"`)

  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (navigator.serviceWorker.controller) return
    await new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true })
    })
  })

  await context.setOffline(true)
  try {
    await page.goto(reviewsShortcutUrl)
    await expect(page.getByRole('button', { name: /Reviews/ })).toHaveAttribute('aria-pressed', 'true')
  } finally {
    await context.setOffline(false)
  }
})
