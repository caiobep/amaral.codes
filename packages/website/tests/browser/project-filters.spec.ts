import { expect, test } from '@playwright/test'

test('projects can be searched and filtered by label', async ({ page }) => {
  await page.goto('/projects')

  const projects = page.locator('[data-project]')
  const visibleProjects = page.locator('[data-project]:not([hidden])')
  const search = page.getByRole('searchbox', { name: 'Search projects' })
  const filters = page.getByRole('group', { name: 'Labels' })

  await expect(projects).toHaveCount(6)
  await expect(visibleProjects).toHaveCount(6)
  await expect(filters.getByRole('button', { name: 'All' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  await filters.getByRole('button', { name: 'Systems' }).click()
  await expect(visibleProjects).toHaveCount(2)
  await expect(page).toHaveURL(/\/projects\/?\?label=systems$/)
  await expect(page.locator('.project-band')).toBeHidden()

  await search.fill('python')
  await expect(visibleProjects).toHaveCount(1)
  await expect(visibleProjects).toContainText(['Python Blockchain'])
  await expect(page).toHaveURL(/label=systems&query=python$/)

  await search.fill('calendar')
  await expect(visibleProjects).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Nothing matches that search.' })).toBeVisible()

  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expect(search).toBeFocused()
  await expect(search).toHaveValue('')
  await expect(visibleProjects).toHaveCount(6)
  await expect(page).toHaveURL(/\/projects\/?$/)
})

test('project filters hydrate from descriptive query parameters', async ({ page }) => {
  await page.goto('/projects?label=systems&query=port')

  await expect(page.getByRole('searchbox', { name: 'Search projects' })).toHaveValue('port')
  await expect(page.getByRole('button', { name: 'Systems' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.locator('[data-project]:not([hidden])')).toHaveCount(1)
  await expect(page.locator('[data-project]:not([hidden])')).toContainText(['Port Sniffer'])
})

test('clearing search restores the full-width additional project list', async ({ page }) => {
  await page.goto('/projects?query=Scriptable')
  const search = page.getByRole('searchbox', { name: 'Search projects' })
  const group = page.getByRole('region', { name: 'More projects', exact: true })

  await expect(page.locator('[data-project]:not([hidden])')).toContainText(['Fancy Scriptable Editor'])

  await search.fill('')
  await expect(group.locator('[data-project]:not([hidden])')).toHaveCount(3)
  await search.fill('Scriptable')
  await expect(group.locator('[data-project]:not([hidden])')).toHaveCount(1)
  await search.fill('   ')
  await expect(group.locator('[data-project]:not([hidden])')).toHaveCount(3)
  const widths = await group.evaluate((section) => ({
    section: section.clientWidth,
    list: section.querySelector('.project-list')?.clientWidth,
  }))
  expect(widths.list).toBe(widths.section)
})

test('project index wraps within the mobile viewport', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-webkit')
  await page.goto('/projects')

  const layout = await page.evaluate(() => {
    const controls = document.querySelector<HTMLElement>('[data-project-controls]')
    const controlsRect = controls?.getBoundingClientRect()
    const buttons = Array.from(
      document.querySelectorAll<HTMLElement>('[data-project-filter]'),
    )

    return {
      buttonsInsideControls: buttons.every((button) => {
        const rect = button.getBoundingClientRect()
        return rect.left >= (controlsRect?.left ?? 0) - 1
          && rect.right <= (controlsRect?.right ?? 0) + 1
      }),
      documentOverflow: document.documentElement.scrollWidth - window.innerWidth,
      filterRows: new Set(
        buttons.map((button) => Math.round(button.getBoundingClientRect().top)),
      ).size,
    }
  })

  expect(layout.documentOverflow).toBeLessThanOrEqual(1)
  expect(layout.buttonsInsideControls).toBe(true)
  expect(layout.filterRows).toBeGreaterThan(1)
})
