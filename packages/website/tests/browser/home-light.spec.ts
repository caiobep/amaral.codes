import { expect, test } from '@playwright/test'

test('ambient light reaches the footer through the page spacing', async ({ page }, testInfo) => {
  for (const route of ['/posts', '/projects']) {
    await page.goto(route)
    await page.addStyleTag({ content: '.ambient-light::before { animation: none !important; transform: translate(35vw, calc(55vh - 50%)) !important; }' })
    await page.locator('.footer-shell').evaluate((footer) => {
      window.scrollTo(0, footer.getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.55)
    })
    const boundary = await page.locator('.footer-shell').evaluate((footer) => {
      const main = document.querySelector('main')
      if (!main) throw new Error('Expected the main content')
      return {
        mainBottom: main.getBoundingClientRect().bottom,
        footerTop: footer.getBoundingClientRect().top,
        padding: Number.parseFloat(getComputedStyle(main).paddingBottom),
        overlay: getComputedStyle(footer, '::before').content,
      }
    })
    expect(Math.abs(boundary.mainBottom - boundary.footerTop)).toBeLessThan(1)
    expect(boundary.padding).toBeGreaterThanOrEqual(72)
    expect(boundary.overlay).toBe('none')
    await page.screenshot({ path: testInfo.outputPath(route.slice(1) + '-footer-light.png') })
  }
})

test('ambient light is decorative and respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')

  const light = page.locator('.ambient-light')
  await expect(light).toHaveAttribute('aria-hidden', 'true')
  await expect(light).toHaveCSS('pointer-events', 'none')
  const animationName = () => light.evaluate((element) =>
    getComputedStyle(element, '::before').animationName)
  await expect(light).toHaveCSS('position', 'fixed')
  await expect.poll(animationName).toBe('ambient-light-drift')

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect.poll(animationName).toBe('none')
  await expect(page.locator('html')).toHaveCSS('scroll-snap-type', 'none')
})

test('shared pages use a compact viewport light and plum text tokens', async ({ page }) => {
  for (const path of ['/', '/about', '/posts/projects_over_categories']) {
    await page.goto(path)
    const light = page.locator('.ambient-light')
    await expect(light).toHaveCount(1)
    await expect(light).toHaveCSS('position', 'fixed')
    const width = await light.evaluate((element) =>
      Number.parseFloat(getComputedStyle(element, '::before').width))
    expect(width).toBeLessThanOrEqual(521)
    if (path === '/') {
      const cardWidth = await page.locator('.lead-story').evaluate((element) =>
        element.getBoundingClientRect().width)
      expect(width / cardWidth).toBeGreaterThan(0.55)
      expect(width / cardWidth).toBeLessThan(0.65)
    }

    await page.evaluate(() => {
      document.documentElement.dataset.palette = 'plum'
      document.documentElement.dataset.theme = 'light'
    })
    await expect(page.locator('html')).toHaveCSS('color', 'rgb(43, 35, 49)')
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark' })
    await expect(page.locator('html')).toHaveCSS('color', 'rgb(241, 234, 245)')
  }
})
