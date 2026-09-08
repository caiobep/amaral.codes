import { expect, test } from '@playwright/test'

test('homepage company logos use their optical scale', async ({ page }) => {
  await page.goto('/')

  const logos = page.locator('.companies img')
  await expect(logos).toHaveCount(16)

  const styles = await logos.evaluateAll((images) => images.map((image) => {
    const computed = getComputedStyle(image)
    return {
      scale: Number(computed.getPropertyValue('--logo-scale')),
      transform: computed.transform,
      transformOrigin: computed.transformOrigin,
    }
  }))

  expect(styles.every(({ scale }) => scale >= 0.75 && scale <= 1.3)).toBe(true)
  expect(new Set(styles.map(({ scale }) => scale)).size).toBeGreaterThan(1)
  expect(styles.every(({ transform }) => transform !== 'none')).toBe(true)
  expect(styles.every(({ transformOrigin }) => transformOrigin !== '0px 0px')).toBe(true)

  const linkTransitions = await page.locator('.companies a').evaluateAll((links) => (
    links.map((link) => {
      const computed = getComputedStyle(link)
      return {
        duration: computed.transitionDuration,
        property: computed.transitionProperty,
        timing: computed.transitionTimingFunction,
      }
    })
  ))
  expect(linkTransitions.every(({ property }) => property.includes('transform'))).toBe(true)
  expect(linkTransitions.every(({ duration }) => duration === '0.18s')).toBe(true)
  expect(linkTransitions.every(({ timing }) => timing === 'ease-in-out')).toBe(true)

  const imageTransitions = await logos.evaluateAll((images) => images.map((image) => {
    const computed = getComputedStyle(image)
    return {
      duration: computed.transitionDuration,
      timing: computed.transitionTimingFunction,
    }
  }))
  expect(imageTransitions.every(({ duration }) => (
    duration.split(',').every((value) => value.trim() === '0.18s')
  ))).toBe(true)
  expect(imageTransitions.every(({ timing }) => (
    timing.split(',').every((value) => value.trim() === 'ease-in-out')
  ))).toBe(true)

  const largestLogoWidth = Math.max(...await logos.evaluateAll((images) => (
    images.map((image) => image.getBoundingClientRect().width)
  )))
  expect(largestLogoWidth).toBeGreaterThanOrEqual(150)
})

test('about page presents the same work history as an annotated chronology', async ({ page }) => {
  await page.goto('/about')

  const workContext = page.locator('.work-context')
  await expect(workContext.getByRole('heading', {
    name: 'Some of the places the work took me.',
  })).toBeVisible()

  const logos = workContext.locator('.companies img')
  await expect(logos).toHaveCount(16)
  await expect(logos.first()).toHaveAttribute('alt', 'Redbrick')
  await expect(logos.last()).toHaveAttribute('alt', 'Embraer')
  await expect(workContext.locator('.chronology')).toContainText('More recent')
  await expect(workContext.locator('.chronology')).toContainText('Earlier')
})

test('about hero remains balanced at intermediate widths and preserves portrait motion', async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium')

  for (const width of [820, 900, 1000]) {
    await page.setViewportSize({ height: 900, width })
    await page.goto('/about')

    const copy = page.locator('.about-hero .hero-copy')
    const portrait = page.locator('.about-hero [data-portrait-motion]')
    const [copyBox, portraitBox] = await Promise.all([copy.boundingBox(), portrait.boundingBox()])

    expect(copyBox).not.toBeNull()
    expect(portraitBox).not.toBeNull()
    if (!copyBox || !portraitBox) continue

    expect(copyBox.x + copyBox.width).toBeLessThan(portraitBox.x)
    expect(portraitBox.width).toBeGreaterThanOrEqual(260)
    expect(portraitBox.x + portraitBox.width).toBeLessThanOrEqual(width)
  }

  const portrait = page.locator('.about-hero [data-portrait-motion]')
  const image = portrait.locator('img')
  const restingTransform = await image.evaluate((element) => getComputedStyle(element).transform)
  const bounds = await portrait.boundingBox()
  expect(bounds).not.toBeNull()
  if (!bounds) return

  await portrait.hover({
    position: { x: bounds.width * 0.75, y: Math.min(bounds.height * 0.4, 300) },
  })
  await expect.poll(() => image.evaluate((element) => getComputedStyle(element).transform))
    .not.toBe(restingTransform)

  await page.mouse.move(0, 0)
  await expect.poll(() => image.evaluate((element) => getComputedStyle(element).transform))
    .toBe(restingTransform)
})
