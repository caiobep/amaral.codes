import { expect, test, type Locator } from '@playwright/test'
import { createTwoPagePdf } from './fixtures/two-page-pdf'

const pdfUrl = '**/talks/nativescript-vs-ionic/slides.pdf'
const pdfResponse = { body: createTwoPagePdf(), contentType: 'application/pdf' }

function signal() {
  let resolve: () => void = () => undefined
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}

async function expectFittedCanvas(preview: Locator, color: 'red' | 'blue') {
  const canvas = preview.locator('[data-preview-canvas]')
  await expect(canvas).toBeVisible()
  await expect.poll(() => preview.evaluate((root, expectedColor) => {
    const frame = root.querySelector<HTMLElement>('[data-preview-frame-container]')
    const image = root.querySelector<HTMLCanvasElement>('[data-preview-canvas]')
    if (!frame || !image) throw new Error('Missing preview elements')
    const context = image.getContext('2d')
    if (!context) throw new Error('Canvas context unavailable')
    const scale = Math.min(frame.clientWidth / 640, frame.clientHeight / 480)
    const pixels = context.getImageData(1, 1, 1, 1).data
    const red = pixels.at(0)
    const blue = pixels.at(2)
    if (red === undefined || blue === undefined) throw new Error('Missing rendered pixel data')
    const pixelScale = scale * Math.min(window.devicePixelRatio, 2)
    return image.clientWidth === Math.floor(640 * scale)
      && image.clientHeight === Math.floor(480 * scale)
      && image.width === Math.floor(640 * pixelScale)
      && image.height === Math.floor(480 * pixelScale)
      && (expectedColor === 'red' ? red > blue : blue > red)
  }, color)).toBe(true)
}

test('PDF pages refit on container and viewport resize, and hide navigation when closed', async ({ page }, testInfo) => {
  let requests = 0
  await page.route(pdfUrl, async (route) => {
    requests += 1
    await route.fulfill(pdfResponse)
  })
  await page.goto('/posts/nativescript-vs-ionic/')
  const preview = page.locator('[data-talk-material-preview]')
  const toggle = preview.locator('[data-preview-toggle]')
  const navigation = preview.locator('[data-preview-navigation]')
  await expect(navigation).toBeHidden()
  expect(requests).toBe(0)
  await toggle.click()
  await expect(preview.locator('[data-preview-total]')).toHaveText('2')
  await expectFittedCanvas(preview, 'red')
  await expect(preview.locator('[data-preview-previous]')).toBeDisabled()

  await preview.evaluate(root => { root.style.width = '280px' })
  await expectFittedCanvas(preview, 'red')
  await preview.evaluate(root => { root.style.width = '' })
  await page.setViewportSize({ width: 390, height: 844 })
  await expectFittedCanvas(preview, 'red')
  await preview.locator('[data-preview-next]').click()
  await expect(preview.locator('[data-preview-page]')).toHaveText('2')
  await expectFittedCanvas(preview, 'blue')
  await expect(preview.locator('[data-preview-next]')).toBeDisabled()
  await testInfo.attach('mobile-second-slide', {
    body: await preview.screenshot({ path: testInfo.outputPath('mobile-second-slide.png') }),
    contentType: 'image/png',
  })

  await toggle.click()
  await expect(navigation).toBeHidden()
  await expect(preview.locator('[data-preview-frame-container]')).toBeHidden()
  await expect(preview.locator('[data-preview-poster]')).toBeVisible()
  await testInfo.attach('closed-preview', {
    body: await preview.screenshot({ path: testInfo.outputPath('closed-preview.png') }),
    contentType: 'image/png',
  })
  await page.setViewportSize({ width: 1280, height: 900 })
  await toggle.click()
  await expectFittedCanvas(preview, 'blue')
  await preview.locator('[data-preview-frame-container]').press('ArrowLeft')
  await expectFittedCanvas(preview, 'red')
  expect(requests).toBe(1)
})

test('closing during PDF loading keeps late work hidden and reopens at the current size', async ({ page }) => {
  const release = signal()
  const requested = signal()
  await page.route(pdfUrl, async (route) => {
    requested.resolve()
    await release.promise
    await route.fulfill(pdfResponse)
  })
  await page.goto('/posts/nativescript-vs-ionic/')
  const preview = page.locator('[data-talk-material-preview]')
  const toggle = preview.locator('[data-preview-toggle]')
  await toggle.click()
  await requested.promise
  await toggle.click()
  const response = page.waitForResponse(pdfUrl)
  release.resolve()
  await response
  await expect(preview.locator('[data-preview-navigation]')).toBeHidden()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await page.setViewportSize({ width: 390, height: 844 })
  await toggle.click()
  await expectFittedCanvas(preview, 'red')
  await expect(preview.locator('[data-preview-navigation]')).toBeVisible()
})

test('failed PDF loads release workers and resize does not retry them', async ({ page }) => {
  let requests = 0
  await page.route(pdfUrl, route => {
    requests += 1
    return route.fulfill({ status: 503, body: 'Unavailable' })
  })
  await page.goto('/posts/nativescript-vs-ionic/')
  const preview = page.locator('[data-talk-material-preview]')
  const toggle = preview.locator('[data-preview-toggle]')
  const status = preview.locator('[data-preview-status]')

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await toggle.click()
    await expect(status).toHaveText('Preview unavailable. Open the PDF instead.')
    await expect.poll(() => page.workers().length).toBe(0)
    expect(requests).toBe(attempt)
    await preview.evaluate(async (root, width) => {
      root.style.width = `${String(width)}px`
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    }, 300 - attempt * 10)
    await expect(status).toHaveText('Preview unavailable. Open the PDF instead.')
    expect(requests).toBe(attempt)
    await expect(preview.locator('[data-preview-spinner]')).toBeHidden()
    await expect(preview.locator('[data-preview-navigation]')).toBeHidden()
    await toggle.click()
  }
  expect(page.workers()).toHaveLength(0)
})
