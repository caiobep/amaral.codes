import { expect, test } from '@playwright/test'

for (const [width, height] of [[200, 250], [1200, 1600], [1600, 900]] as const) {
  test(`article reserves ${String(width)} by ${String(height)} image space before loading`, async ({ page }) => {
    let releaseImage!: () => void
    const imageReady = new Promise<void>((resolve) => { releaseImage = resolve })
    await page.route('**/*fixture-inline*', async (route) => {
      await imageReady
      await route.fulfill({
        contentType: 'image/svg+xml',
        body: `<svg xmlns="http://www.w3.org/2000/svg" width="${String(width)}" height="${String(height)}"/>`,
      })
    })
    await page.goto('/posts/fixture-essay', { waitUntil: 'domcontentloaded' })
    const image = page.getByRole('img', { name: 'A deterministic inline content fixture' })
    await expect(image).toHaveAttribute('data-intrinsic-size', '')
    if (width !== 200) await image.evaluate((element, dimensions) => {
      const image = element as HTMLImageElement
      image.width = dimensions.width
      image.height = dimensions.height
      image.style.setProperty('--image-width', String(dimensions.width))
      image.style.setProperty('--image-ratio', String(dimensions.width / dimensions.height))
    }, { width, height })
    const before = await image.boundingBox()
    releaseImage()
    await image.evaluate(async (element) => { await (element as HTMLImageElement).decode() })
    const after = await image.boundingBox()
    if (!before || !after) throw new Error('Article image must have a layout box')
    expect(before.width).toBeCloseTo(after.width, 1)
    expect(before.height).toBeCloseTo(after.height, 1)
    const original = await image.evaluate((element) => {
      const image = element as HTMLImageElement
      image.removeAttribute('data-intrinsic-size')
      const { width, height } = image.getBoundingClientRect()
      return { width, height }
    })
    expect(after.width).toBeCloseTo(original.width, 1)
    expect(after.height).toBeCloseTo(original.height, 1)
  })
}
