import { expect, test } from '@playwright/test'

test('email starting points hand off the selected subject after client navigation', async ({ page }) => {
  const handoffs: string[] = []
  await page.exposeFunction('captureEmail', (href: string) => handoffs.push(href))
  await page.addInitScript(() => {
    HTMLAnchorElement.prototype.click = function () {
      if (this.protocol !== 'mailto:') throw new Error('Expected an email handoff')
      const testWindow = window as typeof window & { captureEmail: (href: string) => void }
      testWindow.captureEmail(this.href)
    }
  })
  await page.goto('/about')
  await page.locator('.site-nav').getByRole('link', { name: 'Contact', exact: true }).click()
  const options = [
    ['A project or collaboration', 'A project or collaboration'],
    ['Something I made or wrote', 'About your work'],
    ['Just saying hello', 'Hello, Caio'],
  ] as const
  for (const [index, [label, subject]] of options.entries()) {
    const button = page.getByRole('button', { name: new RegExp(label) })
    await expect(button).toBeEnabled()
    await button.focus()
    await page.keyboard.press('Enter')
    await expect.poll(() => handoffs.length).toBe(index + 1)
    const href = handoffs[index]
    if (!href) throw new Error('Expected an email handoff')
    const handoff = new URL(href)
    expect(handoff.protocol).toBe('mailto:')
    expect(handoff.pathname).toBe(['caiobep', 'me.com'].join('@'))
    expect(handoff.searchParams.get('subject')).toBe(subject)
  }
  await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0)
})

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

test('contact routes remain reachable without publishing the email address', async ({ page }) => {
  const response = await page.goto('/contact')
  expect(await response?.text()).not.toContain('caiobep@me.com')
  const content = page.locator('main')
  await expect(content).toHaveCount(1)
  await expect(content.getByRole('heading', { name: 'What’s on your mind?' })).toBeVisible()
  const email = content.getByRole('button', { name: /Just saying hello/ })
  await expect(email).toBeEnabled()
  await expect(content).not.toContainText('caiobep@me.com')
  await expect(content.locator('a[href^="mailto:"]')).toHaveCount(0)
  await email.scrollIntoViewIfNeeded()
  await expect(email).toBeInViewport()
  await expect(content.locator('form')).toHaveCount(0)

  const calendar = content.getByRole('link', { name: /Book a 20-minute chat/ })
  await expect(calendar).toHaveAttribute('href', 'https://fantastical.app/caio/20-minute-chat-with-caio')
  await calendar.scrollIntoViewIfNeeded()
  await expect(calendar).toBeInViewport()
  const profiles = content.getByRole('navigation', { name: 'Social profiles' })
  await expect(profiles.getByRole('link')).toHaveCount(3)
  for (const link of await content.locator('a[target="_blank"]').all()) {
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  if ((page.viewportSize()?.width ?? 0) > 760) {
    const alignment = await page.evaluate(() => {
      const rect = (selector: string) => {
        const element = document.querySelector(selector)
        if (!element) throw new Error('Expected contact column')
        return element.getBoundingClientRect()
      }
      return {
        bottomDifference: rect('.email-options').bottom - rect('.profiles').bottom,
        labelDifference: rect('.email-start .section-label').top - rect('.calendar .section-label').top,
      }
    })
    expect(Math.abs(alignment.bottomDifference)).toBeLessThan(1)
    expect(Math.abs(alignment.labelDifference)).toBeLessThan(1)
  }
})
