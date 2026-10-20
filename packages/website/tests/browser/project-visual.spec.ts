import { expect, test } from '@playwright/test'

test('project visuals preserve responsive image metadata and literal code', async ({ page }) => {
  await page.goto('/projects')

  const imageProject = page.locator('[data-project]').filter({
    has: page.getByRole('heading', { name: 'Apple Watch Calendar Widget' }),
  })
  const image = imageProject.getByRole('img', {
    name: 'Apple Watch Calendar widget running on a macOS desktop',
  })

  await expect(image).toHaveAttribute('src', '/projects/apple-watch-calendar-550.webp')
  await expect(image).toHaveAttribute(
    'srcset',
    '/projects/apple-watch-calendar-360.webp 360w, /projects/apple-watch-calendar-550.webp 550w',
  )
  await expect(image).toHaveAttribute(
    'sizes',
    '(max-width: 760px) calc(100vw - 2rem), (max-width: 1180px) calc(100vw - 4rem), min(48vw, 47rem)',
  )
  await expect(image).toHaveAttribute('width', '550')
  await expect(image).toHaveAttribute('height', '312')
  await expect(image).toHaveAttribute('loading', 'eager')
  await expect(image).toHaveAttribute('fetchpriority', 'high')

  const codeProject = page.locator('[data-project]').filter({
    has: page.getByRole('heading', { name: 'Compare JSON Schemas' }),
  })
  const code = codeProject.locator('.project-visual code')

  await expect(code).toHaveText(
    'npm install -g compare-json-schemas\ncompare-schemas base.json copy.json config.yaml',
  )
  await expect(codeProject.locator('.project-visual img')).toHaveCount(0)
})
