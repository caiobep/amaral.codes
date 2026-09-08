import { expect, test } from '@playwright/test'

const routeStates = [
  ['/', '/'],
  ['/posts', '/posts'],
  ['/projects', '/projects'],
  ['/about', '/about'],
  ['/contact', '/contact'],
] as const

test('primary navigation exposes Contact and marks only the current route', async ({ page }) => {
  for (const [route, activeHref] of routeStates) {
    await page.goto(route)

    const navigation = page.locator('.site-nav')
    await expect(navigation.locator('a')).toHaveCount(5)
    await expect(navigation.getByRole('link', { name: 'Contact', exact: true }))
      .toHaveAttribute('href', '/contact')
    await expect(navigation.locator('a[aria-current="page"]')).toHaveCount(1)
    await expect(navigation.locator('a[aria-current="page"]'))
      .toHaveAttribute('href', activeHref)
    await expect(navigation.locator('a:not([aria-current])')).toHaveCount(4)
  }
})

test('five primary links fit at desktop, tablet, and mobile widths', async ({ page }, testInfo) => {
  const viewports = {
    'desktop-chromium': { width: 1280, height: 900 },
    'tablet-webkit': { width: 768, height: 1024 },
    'mobile-webkit': { width: 390, height: 844 },
  } as const

  test.skip(!(testInfo.project.name in viewports))
  await page.setViewportSize(viewports[testInfo.project.name as keyof typeof viewports])
  await page.goto('/contact')

  const measurements = await page.locator('.site-nav').evaluate((navigation) => {
    const navigationRect = navigation.getBoundingClientRect()
    const links = Array.from(navigation.querySelectorAll('a'))

    return {
      documentWidth: document.documentElement.scrollWidth,
      linksInsideNavigation: links.every((link) => {
        const linkRect = link.getBoundingClientRect()
        return linkRect.left >= navigationRect.left - 1
          && linkRect.right <= navigationRect.right + 1
      }),
      navigationClientWidth: navigation.clientWidth,
      navigationScrollWidth: navigation.scrollWidth,
      viewportWidth: window.innerWidth,
    }
  })

  expect(measurements.documentWidth).toBeLessThanOrEqual(measurements.viewportWidth + 1)
  expect(measurements.navigationScrollWidth)
    .toBeLessThanOrEqual(measurements.navigationClientWidth + 1)
  expect(measurements.linksInsideNavigation).toBe(true)
})

test('contact page prioritizes email and preserves secondary destinations', async ({ page }) => {
  await page.goto('/contact')

  const primaryContact = page.locator('.primary-contact')
  await expect(primaryContact).toHaveAttribute('href', 'mailto:caiobep@me.com')
  await expect(primaryContact).toContainText('Start with an email.')
  await expect(primaryContact).toContainText('caiobep@me.com')

  const secondaryContacts = page.locator('.secondary-contact-list a')
  await expect(secondaryContacts).toHaveCount(4)
  for (const secondaryContact of await secondaryContacts.all()) {
    await expect(secondaryContact).toHaveAttribute('target', '_blank')
    await expect(secondaryContact).toHaveAttribute('rel', 'noopener noreferrer')
  }
  await expect(secondaryContacts).toHaveText([
    /Calendar/,
    /GitHub/,
    /LinkedIn/,
    /X \/ Twitter/,
  ])

  await expect(page.locator('#contact-page-form')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Prepare email' })).toBeVisible()
})
