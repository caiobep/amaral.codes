import { expect, test } from '@playwright/test'

const browseDestinations = {
  Notes: '/posts',
  Podcasts: '/posts?category=podcast',
  Talks: '/posts?category=talk',
  Projects: '/projects',
  About: '/about',
  CV: '/resume/CV.pdf',
  Contact: '/contact',
}

const feedDestinations = {
  'All content feed': '/rss#everything',
  'Reviews feed': '/rss#reviews',
  'Podcast feed': '/rss#podcasts',
  'Talk feed': '/rss#talks',
}

test('footer separates browse destinations from RSS feeds', async ({ page }) => {
  await page.goto('/')

  const footer = page.getByRole('contentinfo')
  const explore = footer.getByRole('region', { name: 'Explore' })
  const rss = footer.getByRole('region', { name: 'RSS' })

  await expect(footer.getByRole('region', { name: 'Formats' })).toHaveCount(0)

  for (const [label, href] of Object.entries(browseDestinations)) {
    await expect(explore.getByRole('link', { name: label, exact: true })).toHaveAttribute('href', href)
  }

  for (const [label, href] of Object.entries(feedDestinations)) {
    await expect(rss.getByRole('link', { name: label, exact: true })).toHaveAttribute('href', href)
  }

  const feedLabels = await rss.getByRole('link').allTextContents()
  expect(feedLabels.every((label) => label.endsWith(' feed'))).toBe(true)

  const linkLabels = await footer.getByRole('link').allTextContents()
  expect(new Set(linkLabels).size).toBe(linkLabels.length)
})

test('footer groups form columns with vertically stacked links', async ({ page }) => {
  await page.goto('/')

  const layout = await page.locator('.footer-links').evaluate((element) => {
    return {
      columns: getComputedStyle(element).gridTemplateColumns.split(' ').length,
      linkLayout: getComputedStyle(element.querySelector('ul') ?? element).display,
      width: window.innerWidth,
    }
  })

  expect(layout.columns).toBe(layout.width > 760 ? 3 : 2)
  expect(layout.linkLayout).toBe('grid')
})

test('CV is available from the footer and About page', async ({ page, request }) => {
  const cvResponse = await request.get('/resume/CV.pdf')
  expect(cvResponse.ok()).toBe(true)
  expect(cvResponse.headers()['content-type']).toContain('application/pdf')

  await page.goto('/about')

  await expect(page.getByRole('main').getByRole('link', { name: 'View my CV' })).toHaveAttribute(
    'href',
    '/resume/CV.pdf',
  )
  await expect(page.getByRole('contentinfo').getByRole('link', { name: 'CV', exact: true })).toHaveAttribute(
    'href',
    '/resume/CV.pdf',
  )
})
