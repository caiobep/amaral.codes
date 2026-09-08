import { expect, test } from '@playwright/test'

test.use({ serviceWorkers: 'allow' })

const desktopChromiumOnly = (projectName: string) => {
  test.skip(projectName !== 'desktop-chromium', 'Platform behavior needs one browser runtime.')
}

test('compiled redirect utilities allow only policy-approved targets', async ({ page }, testInfo) => {
  desktopChromiumOnly(testInfo.project.name)

  await page.goto(`/deeplink?${new URLSearchParams({ url: '/about' })}`)
  await expect(page).toHaveURL(/\/about\/?$/)

  await page.goto(`/utils/links/d?${new URLSearchParams({ l: '/projects' })}`)
  await expect(page).toHaveURL(/\/projects\/?$/)

  const scriptTarget = 'javascript:document.body.dataset.redirectExecuted="true"'
  await page.goto(`/deeplink?${new URLSearchParams({ url: scriptTarget })}`)
  await expect(page).toHaveURL(/\/deeplink\?url=/)
  await expect(page.locator('body')).not.toHaveAttribute('data-redirect-executed')
  await expect(page.locator('body')).toHaveAttribute('data-redirect-state', 'invalid')
  await expect(page.getByRole('heading', { name: 'This link is invalid.' })).toBeVisible()

  await page.goto(`/utils/links/d?${new URLSearchParams({ url: 'https://example.com' })}`)
  await expect(page).toHaveURL(/\/utils\/links\/d\?url=/)
  await expect(page.locator('body')).toHaveAttribute('data-redirect-state', 'invalid')

  await page.goto('/utils/links/shortcuts')
  await expect(page.locator('body')).toHaveAttribute('data-redirect-state', 'invalid')
})

test('generated sitemap contains only indexable document routes', async ({ request }, testInfo) => {
  desktopChromiumOnly(testInfo.project.name)

  const response = await request.get('/sitemap-0.xml')
  expect(response.ok()).toBe(true)
  const sitemap = await response.text()

  for (const route of [
    '/deeplink/',
    '/offline/',
    '/physical-projects/',
    '/reviews/',
    '/search/',
    '/utils/links/d/',
    '/utils/links/shortcuts/',
  ]) {
    expect(sitemap).not.toContain(`<loc>https://amaral.codes${route}</loc>`)
  }

  for (const route of ['/', '/about/', '/posts/', '/projects/', '/rss/']) {
    expect(sitemap).toContain(`<loc>https://amaral.codes${route}</loc>`)
  }
})

test('installed service worker serves and initializes cached routes offline', async ({
  context,
  page,
}, testInfo) => {
  desktopChromiumOnly(testInfo.project.name)

  await page.goto('/')
  const registration = await page.evaluate(async () => {
    const ready = await navigator.serviceWorker.ready
    const activeWorker = ready.active
    if (!activeWorker) throw new Error('Service worker registration has no active worker.')
    if (activeWorker.state !== 'activated') {
      await new Promise<void>((resolve) => {
        activeWorker.addEventListener('statechange', () => {
          if (activeWorker.state === 'activated') resolve()
        })
      })
    }
    return {
      active: activeWorker.state,
      scope: ready.scope,
    }
  })
  expect(registration.active).toBe('activated')
  expect(registration.scope).toBe(new URL('/', page.url()).href)

  await page.reload()
  expect(await page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true)

  const onlineSearchIndex = await page.evaluate(async () => {
    const cacheNames = await caches.keys()
    const shellCacheName = cacheNames.find((name) => name.startsWith('amaral-shell-'))
    if (!shellCacheName) throw new Error('Service worker shell cache was not created.')

    const shellCache = await caches.open(shellCacheName)
    await shellCache.put('/search-index.json', new Response(
      JSON.stringify([{ title: 'stale shell search index' }]),
      { headers: { 'content-type': 'application/json' } },
    ))

    const response = await fetch('/search-index.json')
    return response.text()
  })
  expect(onlineSearchIndex).not.toContain('stale shell search index')

  await page.goto('/about/')
  await expect(page.locator('main')).toBeVisible()

  await context.setOffline(true)
  try {
    const offlineSearchIndex = await page.evaluate(async () => {
      const response = await fetch('/search-index.json')
      return response.text()
    })
    expect(offlineSearchIndex).toBe(onlineSearchIndex)

    await page.goto(`/posts?${new URLSearchParams({ category: 'note', query: 'spaced' })}`)
    await expect(page.locator('.posts')).toHaveAttribute('data-ready', 'true')
    await expect(page.locator('#search-post')).toHaveValue('spaced')
    await expect(page.locator('[data-filter="note"]')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('#visible-post-count')).toHaveText('1')

    await page.goto(`/search?${new URLSearchParams({ category: 'writing', query: 'productivity' })}`)
    await expect(page.locator('[data-search-root]')).toHaveAttribute('data-ready', 'true')
    await expect(page.locator('[data-search-input]')).toHaveValue('productivity')
    await expect(page.locator('[data-search-filter="writing"]'))
      .toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('[data-search-status]')).toContainText(/results? for “productivity”/)
    expect(await page.locator('[data-search-results] > li').count()).toBeGreaterThan(0)

    await page.goto('/about/?offline-check=cached')
    await expect(page.locator('main')).toBeVisible()
    await expect(page).toHaveTitle(/About/)

    await page.goto('/not-cached-offline-check/')
    await expect(page).toHaveTitle('Offline | Caio Amaral')
    await expect(page.getByRole('heading', { name: 'The connection dropped.' })).toBeVisible()
  } finally {
    await context.setOffline(false)
  }
})
