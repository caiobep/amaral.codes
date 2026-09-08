import { expect, test, type Page } from '@playwright/test'

const swipe = async (
  page: Page,
  fromX: number,
  toX: number,
) => {
  await page.locator('main').evaluate((main, positions) => {
    const dispatchTouch = (
      type: 'touchstart' | 'touchmove' | 'touchend',
      clientX: number,
    ) => {
      const touch = { clientX, clientY: 320, identifier: 1, target: main }
      const activeTouches = type === 'touchend' ? [] : [touch]
      const event = new Event(type, {
        bubbles: true,
        cancelable: true,
      })
      Object.defineProperties(event, {
        changedTouches: { value: [touch] },
        touches: { value: activeTouches },
      })
      main.dispatchEvent(event)
    }

    dispatchTouch('touchstart', positions.fromX)
    dispatchTouch('touchmove', positions.toX)
    dispatchTouch('touchend', positions.toX)
  }, { fromX, toX })
}

test('horizontal swipes navigate between mobile tabs', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-webkit')
  await page.addInitScript(() => {
    window.addEventListener('pagereveal', (event) => {
      const transition = (event as Event & { viewTransition?: unknown }).viewTransition
      document.documentElement.dataset.crossDocumentTransition = String(Boolean(transition))
    })
  })
  await page.goto('/')

  await expect(page.locator('main')).toHaveAttribute('data-swipe-navigation', 'ready')
  await swipe(page, 320, 100)
  await expect(page).toHaveURL(/\/projects\/?$/)
  await expect(page.locator('html')).toHaveAttribute('data-cross-document-transition', 'true')
  await expect(page.locator('main')).not.toHaveAttribute('data-swipe-arrival', /.+/)

  await expect(page.locator('main')).toHaveAttribute('data-swipe-navigation', 'ready')
  await swipe(page, 100, 320)
  await expect(page).toHaveURL(/\/$/)
})
