import { expect, test } from '@playwright/test'

test('notes controls form a clear library index on desktop', async ({ page }, testInfo) => {
  test.skip(['mobile-webkit', 'tablet-webkit'].includes(testInfo.project.name))
  await page.goto('/posts')

  const search = page.getByRole('searchbox', { name: 'Search the library' })
  const filters = page.getByRole('group', { name: 'Browse the shelves' })
  await expect(search).toBeVisible()
  await expect(filters).toBeVisible()

  const layout = await page.evaluate(() => {
    const getRect = (selector: string) => document.querySelector(selector)?.getBoundingClientRect()
    const searchField = getRect('.post-search-field')
    const input = getRect('.post-search input')
    const filters = getRect('.post-filters')
    const firstFilter = getRect('.post-filters button')
    const icon = getRect('.post-search-field > svg')

    return {
      filterButtonHeight: firstFilter?.height ?? 0,
      filtersTop: filters?.top ?? 0,
      iconInsideField: Boolean(
        icon
        && searchField
        && icon.left >= searchField.left
        && icon.right <= searchField.right
        && icon.top >= searchField.top
        && icon.bottom <= searchField.bottom,
      ),
      inputHeight: input?.height ?? 0,
      searchBottom: searchField?.bottom ?? 0,
    }
  })

  expect(layout.filtersTop).toBeGreaterThan(layout.searchBottom)
  expect(layout.inputHeight).toBeGreaterThanOrEqual(56)
  expect(layout.filterButtonHeight).toBeGreaterThanOrEqual(44)
  expect(layout.iconInsideField).toBe(true)
})

test('notes filters wrap without clipping on mobile', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-webkit')
  await page.goto('/posts')

  const layout = await page.evaluate(() => {
    const options = document.querySelector<HTMLElement>('.post-filter-options')
    const optionRect = options?.getBoundingClientRect()
    const buttons = Array.from(document.querySelectorAll<HTMLElement>('.post-filters button'))
    const rows = new Set(buttons.map((button) => Math.round(button.getBoundingClientRect().top)))

    return {
      buttonsInsideOptions: buttons.every((button) => {
        const rect = button.getBoundingClientRect()
        return rect.left >= (optionRect?.left ?? 0) - 1
          && rect.right <= (optionRect?.right ?? 0) + 1
      }),
      documentOverflow: document.documentElement.scrollWidth - window.innerWidth,
      optionsOverflow: (options?.scrollWidth ?? 0) - (options?.clientWidth ?? 0),
      rowCount: rows.size,
    }
  })

  expect(layout.documentOverflow).toBeLessThanOrEqual(1)
  expect(layout.optionsOverflow).toBeLessThanOrEqual(1)
  expect(layout.buttonsInsideOptions).toBe(true)
  expect(layout.rowCount).toBeGreaterThan(1)
})

test('notes search and filters preserve their query parameters', async ({ page }) => {
  await page.goto('/posts?query=tools&category=note')

  const search = page.getByRole('searchbox', { name: 'Search the library' })
  const filters = page.getByRole('group', { name: 'Browse the shelves' })
  const visiblePosts = page.locator('.post:not([hidden])')
  await expect(search).toHaveValue('tools')
  await expect(filters.getByRole('button', { name: /notes/i })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  await search.fill('not-a-real-note-query')
  await expect(visiblePosts).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Nothing matches that search.' })).toBeVisible()
  await expect(page).toHaveURL(/query=not-a-real-note-query&category=note$/)

  await page.getByRole('button', { name: 'Clear note search' }).click()
  await expect(search).toBeFocused()
  await expect(search).toHaveValue('')
  await expect(page).toHaveURL(/category=note$/)
  await expect(visiblePosts).not.toHaveCount(0)
})
