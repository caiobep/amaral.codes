import { expect, test, type Locator, type Page } from '@playwright/test'

interface HoverCase {
  children: string[]
  route: string
  row: string
}

const hoverCases: HoverCase[] = [
  {
    route: '/',
    row: '.story-list > a',
    children: ['.story-meta', 'h3', 'p'],
  },
  {
    route: '/projects',
    row: '.project-row',
    children: ['.project-title', '.project-copy'],
  },
  {
    route: '/posts',
    row: '.post',
    children: ['.post-meta', '.post-copy'],
  },
  {
    route: '/contact',
    row: '.secondary-contact-list a',
    children: ['span', 'p'],
  },
]

const leftEdges = async (row: Locator, selectors: string[]) => row.evaluate(
  (element, childSelectors) => childSelectors.map((selector) => {
    const child = element.querySelector(selector)
    return child?.getBoundingClientRect().left ?? Number.NaN
  }),
  selectors,
)

const boundingRect = async (locator: Locator) => locator.evaluate((element) => {
  const { height, width, x, y } = element.getBoundingClientRect()
  return { height, width, x, y: y + window.scrollY }
})

const expectStableRect = (
  actual: Awaited<ReturnType<typeof boundingRect>>,
  expected: Awaited<ReturnType<typeof boundingRect>>,
) => {
  for (const property of ['height', 'width', 'x', 'y'] as const) {
    expect(Math.abs(actual[property] - expected[property])).toBeLessThanOrEqual(0.1)
  }
}

const expectStableHover = async (page: Page, item: HoverCase) => {
  await page.goto(item.route)
  const row = page.locator(item.row).first()
  await expect(row).toBeVisible()
  await row.scrollIntoViewIfNeeded()
  await page.waitForTimeout(650)

  const before = await leftEdges(row, item.children)
  const beforeRect = await boundingRect(row)
  await row.hover()
  await page.waitForTimeout(450)
  const after = await leftEdges(row, item.children)

  expect(after).toEqual(before)
  expectStableRect(await boundingRect(row), beforeRect)
}

for (const item of hoverCases) {
  test(`${item.route} keeps repeated-row content aligned on hover`, async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith('desktop'))
    await expectStableHover(page, item)
  })
}

test('contact options collapse into one clear action per row on mobile', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-webkit')
  await page.goto('/contact')

  const routes = page.locator('.contact-routes')
  const options = routes.locator('.primary-contact, .secondary-contact-list a')
  await expect(options).toHaveCount(5)

  const layout = await routes.evaluate((element) => {
    const routeRect = element.getBoundingClientRect()
    const links = Array.from(element.querySelectorAll('a'))

    return {
      columnCount: getComputedStyle(element).gridTemplateColumns.split(' ').length,
      linksInsideRoutes: links.every((link) => {
        const linkRect = link.getBoundingClientRect()
        return linkRect.left >= routeRect.left - 1 && linkRect.right <= routeRect.right + 1
      }),
      rowCount: new Set(links.map((link) => Math.round(link.getBoundingClientRect().top))).size,
    }
  })

  expect(layout.columnCount).toBe(1)
  expect(layout.linksInsideRoutes).toBe(true)
  expect(layout.rowCount).toBe(5)
})

test('search results stay aligned on hover', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('desktop'))
  await page.goto('/search?query=software')

  const row = page.locator('.search-results a').first()
  await expect(row).toBeVisible()
  const selectors = ['p:first-child', 'div']
  const before = await leftEdges(row, selectors)
  await row.hover()
  await page.waitForTimeout(300)

  expect(await leftEdges(row, selectors)).toEqual(before)
})

test('RSS targets do not move feed content', async ({ page }) => {
  await page.goto('/rss')
  const feed = page.locator('#everything')
  const selectors = ['.rss-feed-intro', '.rss-actions']
  const before = await leftEdges(feed, selectors)

  await page.goto('/rss#everything')
  await expect(feed).toHaveCSS('background-color', /.+/)

  expect(await leftEdges(feed, selectors)).toEqual(before)
})

test('RSS copy feedback keeps the field geometry stable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.resolve() },
    })
  })
  await page.goto('/rss')
  const field = page.locator('#everything .rss-field')
  const input = field.locator('input')
  const button = field.locator('button')
  const before = {
    button: await boundingRect(button),
    input: await boundingRect(input),
  }

  await button.click()
  await expect(button).toHaveText('Copied')

  expect(await boundingRect(button)).toEqual(before.button)
  expect(await boundingRect(input)).toEqual(before.input)
})

test('filtering posts does not animate visible rows through the layout', async ({ page }) => {
  await page.goto('/posts')
  await page.getByRole('searchbox', { name: 'Search the library' }).fill('window')
  const row = page.locator('.post:not([hidden])').first()

  await expect(row).toBeVisible()
  await expect(row).toHaveCSS('animation-name', 'none')
  await expect(row).toHaveCSS('transform', 'none')
})

test('post metadata stays aligned and close to its content', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('desktop'))
  await page.goto('/posts')

  const row = page.locator('.post:not([hidden])').first()
  const article = row.locator('article')
  const metadata = row.locator('.post-meta')
  const copy = row.locator('.post-copy')
  const [articleRect, metadataRect, copyRect] = await Promise.all([
    boundingRect(article),
    boundingRect(metadata),
    boundingRect(copy),
  ])

  expect(metadataRect.y).toBe(copyRect.y)
  expect(copyRect.x - articleRect.x).toBeLessThanOrEqual(160)
})

test('post discovery controls keep their library rhythm after filtering', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('desktop'))
  await page.goto('/posts')

  const input = page.getByRole('searchbox', { name: 'Search the library' })
  const filters = page.locator('.post-filter-options')
  const before = {
    filters: await boundingRect(filters),
    input: await boundingRect(input),
  }

  expect(before.filters.y).toBeGreaterThan(before.input.y + before.input.height)
  expect(Math.abs(before.filters.x - before.input.x)).toBeLessThanOrEqual(1)

  const targetSizes = await page.locator('.post-filters button').evaluateAll((buttons) => (
    buttons.map((button) => button.getBoundingClientRect().height)
  ))
  expect(targetSizes.every((height) => height >= 44)).toBe(true)

  await page.getByRole('button', { name: /Reviews/ }).click()

  expectStableRect(await boundingRect(filters), before.filters)
  expectStableRect(await boundingRect(input), before.input)
})

test('large hover surfaces stay anchored', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('desktop'))

  await page.goto('/')
  const leadStory = page.locator('.lead-story')
  const leadBefore = await boundingRect(leadStory)
  await leadStory.hover()
  await page.waitForTimeout(320)
  expectStableRect(await boundingRect(leadStory), leadBefore)

  await page.goto('/projects')
  const projectVisual = page.locator('.project-visual').first()
  const projectBefore = await boundingRect(projectVisual)
  await projectVisual.hover()
  await page.waitForTimeout(450)
  expectStableRect(await boundingRect(projectVisual), projectBefore)
})

test('failed slide previews stop loading motion', async ({ page }) => {
  await page.route('**/talks/nativescript-vs-ionic/slides.pdf', async (route) => {
    await route.fulfill({ body: 'Unavailable', status: 503 })
  })
  await page.goto('/posts/nativescript-vs-ionic')
  const preview = page.getByRole('region', { name: 'Open the slides preview' })

  await preview.getByRole('button', { name: 'Preview slides' }).click()
  await expect(preview.getByText('Preview unavailable. Open the PDF instead.')).toBeVisible()
  await expect(preview.locator('[data-preview-spinner]')).toBeHidden()
})
