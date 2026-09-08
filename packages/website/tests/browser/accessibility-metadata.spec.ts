import { expect, test } from '@playwright/test'

interface RgbColor {
  blue: number
  green: number
  red: number
}

const parseRgb = (color: string): RgbColor & { alpha: number } => {
  const channels = /^rgba?\(([\d.,\s]+)\)$/u.exec(color)?.[1]?.split(/[,\s]+/u).map(Number)
  if (channels?.length !== 3 && channels?.length !== 4) {
    throw new Error(`Unsupported color: ${color}`)
  }
  const [red, green, blue, alpha = 1] = channels as [number, number, number, number?]
  return { alpha, blue, green, red }
}

const luminance = (color: string) => {
  const { blue, green, red } = parseRgb(color)
  const channels = [red, green, blue].map((channel) => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * channels[0]
    + 0.7152 * channels[1]
    + 0.0722 * channels[2]
}

const contrastRatio = (first: string, second: string) => {
  const firstLuminance = luminance(first)
  const secondLuminance = luminance(second)
  const lighter = Math.max(firstLuminance, secondLuminance)
  const darker = Math.min(firstLuminance, secondLuminance)
  return (lighter + 0.05) / (darker + 0.05)
}

const compositeColor = (foreground: string, background: string, opacity = 1) => {
  const foregroundChannels = parseRgb(foreground)
  const backgroundChannels = parseRgb(background)
  const alpha = foregroundChannels.alpha * opacity
  const compositeChannel = (channel: keyof RgbColor) => (
    foregroundChannels[channel] * alpha + backgroundChannels[channel] * (1 - alpha)
  )
  return `rgb(${String(compositeChannel('red'))}, ${String(compositeChannel('green'))}, ${String(compositeChannel('blue'))})`
}

const renderedBackground = (backgrounds: string[]) => {
  const opaqueIndex = backgrounds.findIndex((color) => parseRgb(color).alpha === 1)
  if (opaqueIndex < 0) throw new Error('Contrast measurement needs an opaque ancestor background')
  return backgrounds.slice(0, opaqueIndex + 1).reduceRight((background, foreground) => (
    compositeColor(foreground, background)
  ))
}

const readFilterCountColors = (counts: Element[]) => counts.map((count) => {
  const button = count.closest('button')
  if (!button) throw new Error('Filter count must belong to a button')
  const countStyle = getComputedStyle(count)
  const backgrounds: string[] = []
  for (let ancestor: Element | null = count; ancestor; ancestor = ancestor.parentElement) {
    backgrounds.push(getComputedStyle(ancestor).backgroundColor)
  }
  return {
    backgrounds,
    foreground: countStyle.color,
    opacity: Number(countStyle.opacity),
    state: button.getAttribute('aria-pressed') === 'true' ? 'active' : 'inactive',
  }
})

test('contrast compositing retains color alpha and text opacity', () => {
  expect(compositeColor('rgba(255, 0, 0, 0.5)', 'rgb(0, 0, 255)', 0.5))
    .toBe('rgb(63.75, 0, 191.25)')
  expect(() => renderedBackground(['rgba(0, 0, 0, 0)']))
    .toThrow('Contrast measurement needs an opaque ancestor background')
})

test('contrast measurement resolves transparent and layered backgrounds in light and dark', async ({ page }) => {
  const themes = [
    { paper: 'rgb(255, 255, 255)', muted: 'rgb(95, 105, 101)', layered: 'rgb(127.5, 127.5, 127.5)', ratio: 5.68316 },
    { paper: 'rgb(15, 20, 19)', muted: 'rgb(166, 178, 173)', layered: 'rgb(37.5, 39.375, 39)', ratio: 8.49104 },
  ]

  for (const theme of themes) {
    await page.setContent(`
      <style>html { background: rgb(255, 0, 255); } button { background: transparent; color: ${theme.muted}; }</style>
      <section style="background: ${theme.paper}">
        <div><button aria-pressed="false"><strong>1</strong></button></div>
        <div style="background: rgba(255, 255, 255, 0.25)">
          <button aria-pressed="true" style="background: rgba(0, 0, 0, 0.5)"><strong>2</strong></button>
        </div>
      </section>
    `)
    const counts = page.locator('button > strong')
    await expect(counts).toHaveCount(2)
    const samples = await counts.evaluateAll(readFilterCountColors)
    const transparent = samples.at(0)
    const layered = samples.at(1)
    if (!transparent || !layered) throw new Error('Both contrast samples must render')
    const background = renderedBackground(transparent.backgrounds)
    expect(background).toBe(theme.paper)
    expect(contrastRatio(transparent.foreground, background)).toBeCloseTo(theme.ratio, 5)
    expect(renderedBackground(layered.backgrounds)).toBe(theme.layered)
  }
})

test('mobile search contains focus and disables the skip link', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-webkit')
  await page.goto('/')
  const trigger = page.getByRole('button', { name: 'Search' })
  await trigger.click()

  const form = page.locator('[data-header-search]')
  const input = page.getByRole('combobox', { name: 'Search the site' })
  const closeButton = page.getByRole('button', { name: 'Close search' })
  const skipLink = page.getByRole('link', { name: 'Skip to content' })

  await expect(input).toBeFocused()
  await expect(skipLink).toHaveAttribute('inert', '')
  await input.press('Shift+Tab')
  await expect(closeButton).toBeFocused()
  await closeButton.press('Shift+Tab')
  await expect(input).toBeFocused()
  await input.press('Tab')
  await expect(closeButton).toBeFocused()
  await expect(form).toContainText('Find something.')

  await closeButton.click()
  await expect(trigger).toBeFocused()
  await expect(skipLink).not.toHaveAttribute('inert', '')
})

test('article and social metadata expose content language and image alternatives', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium')
  await page.goto('/')
  await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute(
    'content',
    'Portrait of Caio Amaral',
  )
  await expect(page.locator('meta[name="twitter:image:alt"]')).toHaveAttribute(
    'content',
    'Portrait of Caio Amaral',
  )

  await page.goto('/posts/fixture-portuguese')
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR')
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'pt_BR')
  const portugueseArticleData = JSON.parse(
    await page.locator('script[type="application/ld+json"]').textContent() ?? '{}',
  ) as Record<string, unknown>
  expect(portugueseArticleData.inLanguage).toBe('pt-BR')

  await page.goto('/posts/my_journey_with_productivity_tools')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    'https://amaral.codes/social/article-default.jpg',
  )
  await expect(page.locator('meta[property="og:image:type"]')).toHaveAttribute('content', 'image/jpeg')
  await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', '1200')
  await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute('content', '630')
  await expect(page.locator('meta[property="article:author"]')).toHaveAttribute(
    'content',
    'https://amaral.codes/about/',
  )
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    'content',
    'summary_large_image',
  )
  const englishArticleData = JSON.parse(
    await page.locator('script[type="application/ld+json"]').textContent() ?? '{}',
  ) as Record<string, unknown>
  expect(englishArticleData.inLanguage).toBe('en')
  expect(englishArticleData.image).toBe('https://amaral.codes/social/article-default.jpg')
  expect(englishArticleData.author).toMatchObject({ url: 'https://amaral.codes/about/' })
})

test('top-level page schemas agree with their canonical URLs', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium')
  const routes = [
    { path: '/', type: 'WebPage' },
    { path: '/posts/', type: 'CollectionPage' },
    { path: '/projects/', type: 'CollectionPage' },
    { path: '/about/', type: 'ProfilePage' },
    { path: '/contact/', type: 'ContactPage' },
  ]

  for (const route of routes) {
    await page.goto(route.path)
    const canonicalUrl = await page.locator('link[rel="canonical"]').getAttribute('href')
    const structuredData = JSON.parse(
      await page.locator('script[type="application/ld+json"]').textContent() ?? '{}',
    ) as { '@graph'?: Record<string, unknown>[] }
    const pageData = structuredData['@graph']?.find((item) => item['@type'] === route.type)

    expect(canonicalUrl).not.toBeNull()
    if (!canonicalUrl) throw new Error(`Missing canonical URL for ${route.path}`)
    expect(pageData?.url).toBe(canonicalUrl)
    expect(pageData?.['@id']).toBe(`${canonicalUrl}#webpage`)
  }
})

test('missing pages prevent indexing and link following', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium')
  const response = await page.goto('/does-not-exist')

  expect(response?.status()).toBe(404)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    'content',
    'noindex,nofollow',
  )
  await expect(page.getByText('The cake is a lie.')).toBeVisible()
})

test('generated article markup preserves one page heading and explicit decorative images', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium')
  await page.goto('/posts/fixture-article-markup')

  await expect(page.locator('article h1')).toHaveCount(1)
  await expect(page.locator('.content h1')).toHaveCount(0)
  await expect(page.locator('.content h2', { hasText: 'A fixture section heading' })).toBeVisible()
  const emptyAltImages = page.locator('.content img[alt=""]')
  await expect(emptyAltImages).toHaveCount(1)
  await emptyAltImages.scrollIntoViewIfNeeded()
  await expect.poll(() => emptyAltImages.evaluate(
    (element) => (element as HTMLImageElement).naturalWidth,
  )).toBeGreaterThan(0)
  await expect(page.locator('.content').getByRole('img')).toHaveCount(0)
})

test('search focus, placeholder, and Clear target meet visual accessibility thresholds', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium')
  await page.goto('/search')
  const input = page.getByRole('searchbox', { name: 'Search the site' })

  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => localStorage.setItem('amaral-theme', value), theme)
    await page.reload()
    await input.focus()
    const colors = await input.evaluate((element) => ({
      background: getComputedStyle(document.documentElement).backgroundColor,
      focus: getComputedStyle(element).borderBottomColor,
      placeholder: getComputedStyle(element, '::placeholder').color,
    }))
    expect(contrastRatio(colors.focus, colors.background)).toBeGreaterThanOrEqual(3)
    expect(contrastRatio(colors.placeholder, colors.background)).toBeGreaterThanOrEqual(4.5)
  }

  await input.fill('productivity')
  const clearTarget = await page.locator('.clear-search').evaluate((element) => {
    const bounds = element.getBoundingClientRect()
    return { height: bounds.height, width: bounds.width }
  })
  expect(clearTarget.height).toBeGreaterThanOrEqual(44)
  expect(clearTarget.width).toBeGreaterThanOrEqual(44)
})

test('note filter counts meet text contrast in every theme and selection state', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium')
  await page.goto('/posts')

  for (const theme of ['light', 'dark']) {
    await page.evaluate((value) => localStorage.setItem('amaral-theme', value), theme)
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    const countColors = await page.locator('.post-filters button > strong').evaluateAll(readFilterCountColors)
    expect(countColors.map(({ state }) => state)).toEqual(expect.arrayContaining(['active', 'inactive']))

    for (const colors of countColors) {
      const background = renderedBackground(colors.backgrounds)
      const renderedForeground = compositeColor(colors.foreground, background, colors.opacity)
      expect(
        contrastRatio(renderedForeground, background),
        `${theme} ${colors.state} filter count`,
      ).toBeGreaterThanOrEqual(4.5)
    }
  }
})
