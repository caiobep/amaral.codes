import { expect, test, type Page } from '@playwright/test'

function signal() {
  let resolve!: () => void
  const promise = new Promise<void>(complete => { resolve = complete })
  return { promise, resolve }
}

for (const closeMethod of ['button', 'escape', 'breakpoint'] as const) {
  test(`a delayed search response stays closed after ${closeMethod}`, async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 900 })
    const responseGate = signal()
    const requestStarted = signal()
    await page.route('**/search-index.json', async route => {
      requestStarted.resolve()
      await responseGate.promise
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify([{
          id: 'post:delayed', type: 'writing', title: 'Delayed result',
          summary: '', content: '', href: '/posts/delayed', category: 'note',
          topics: [], external: false,
        }]),
      })
    })
    await page.goto('/')
    const form = page.locator('[data-header-search]')
    const input = page.locator('[data-header-search-input]')
    const trigger = page.locator('[data-header-search-open]')
    await expect(form).toHaveAttribute('data-header-search', 'ready')
    await trigger.click()
    await input.fill('Delayed')
    await requestStarted.promise
    if (closeMethod === 'button') await page.locator('[data-header-search-close]').click()
    if (closeMethod === 'escape') await input.press('Escape')
    if (closeMethod === 'breakpoint') await page.setViewportSize({ width: 1024, height: 900 })
    await expect(form).toHaveAttribute('data-open', 'false')
    const responseFinished = page.waitForResponse('**/search-index.json')
    responseGate.resolve()
    await (await responseFinished).finished()
    await page.evaluate(() => new Promise<void>(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    }))
    await expect(input).toHaveAttribute('aria-expanded', 'false')
    await expect(page.locator('[data-header-search-results] [role="option"]')).toHaveCount(0)
    await expect(page.locator('main')).toHaveJSProperty('inert', false)
    await page.setViewportSize({ width: 768, height: 900 })
    await trigger.click()
    await expect(input).toBeFocused()
    await expect(page.locator('[data-header-search-results] [role="option"]')).toHaveCount(1)
  })
}

async function gesture(page: Page, points: [number, number][]) {
  await page.locator('main').evaluate((main, path) => {
    for (const [index, [clientX, clientY]] of path.entries()) {
      const type = index === 0 ? 'touchstart' : index === path.length - 1 ? 'touchend' : 'touchmove'
      const touch = { clientX, clientY, identifier: 1, target: main }
      const event = new Event(type, { bubbles: true, cancelable: true })
      Object.defineProperties(event, {
        touches: { value: type === 'touchend' ? [] : [touch] },
        changedTouches: { value: [touch] },
      })
      main.dispatchEvent(event)
    }
  }, points)
}

test('tablet search closes and releases background content across the desktop breakpoint', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'tablet-webkit')
  await page.setViewportSize({ width: 768, height: 1024 })
  await page.goto('/')
  const form = page.locator('[data-header-search]')
  const input = page.locator('[data-header-search-input]')
  const trigger = page.locator('[data-header-search-open]')
  await expect(form).toHaveAttribute('data-header-search', 'ready')
  await trigger.click()
  await input.fill('Apple Watch Calendar Widget')
  await expect(page.locator('[data-header-search-results] [role="option"]')).toHaveCount(1)
  await input.press('ArrowDown')
  await expect(input).toHaveAttribute('aria-activedescendant', 'header-search-option-0')
  await expect(page.locator('main')).toHaveJSProperty('inert', true)
  await expect(page.locator('.site-nav')).toHaveJSProperty('inert', true)
  await page.setViewportSize({ width: 920, height: 768 })
  await expect(form).toHaveAttribute('data-open', 'true')
  await page.setViewportSize({ width: 921, height: 768 })
  await expect(form).toHaveAttribute('data-open', 'false')
  await expect(page.locator('[data-header-search-link]')).toBeFocused()
  await page.setViewportSize({ width: 1024, height: 768 })
  await expect(form).toBeHidden()
  await expect(form).toHaveAttribute('aria-hidden', 'true')
  await expect(form).toHaveJSProperty('inert', true)
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(input).toHaveAttribute('aria-expanded', 'false')
  await expect(input).not.toHaveAttribute('aria-activedescendant', /.+/)
  await expect(page.locator('html')).toHaveAttribute('data-search-overlay-open', 'false')
  await expect(page.locator('main')).toHaveJSProperty('inert', false)
  await expect(page.locator('.site-nav')).toHaveJSProperty('inert', false)
  await page.setViewportSize({ width: 768, height: 1024 })
  await expect(form).toHaveAttribute('data-open', 'false')
  await trigger.click()
  await expect(input).toBeFocused()
  await page.getByRole('button', { name: 'Close search', exact: true }).click()
  await expect(trigger).toBeFocused()
  await page.locator('.site-nav a[href="/projects"]').click()
  await expect(page).toHaveURL(/\/projects\/?$/)
})

test('a vertical-then-horizontal phone gesture stays cancelled until the next touch', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-webkit')
  await page.goto('/')
  await expect(page.locator('main')).toHaveAttribute('data-swipe-navigation', 'ready')
  await gesture(page, [[220, 320], [218, 380], [85, 385], [85, 385]])
  await expect(page).toHaveURL(/\/$/)
  await expect(page.locator('html')).not.toHaveAttribute('data-swipe-feedback', /.+/)
  const clickWasPrevented = await page.locator('main').evaluate(main => {
    const click = new MouseEvent('click', { bubbles: true, cancelable: true })
    main.dispatchEvent(click)
    return click.defaultPrevented
  })
  expect(clickWasPrevented).toBe(false)
  await gesture(page, [[220, 320], [85, 325], [85, 325]])
  await expect(page).toHaveURL(/\/projects\/?$/)
})
