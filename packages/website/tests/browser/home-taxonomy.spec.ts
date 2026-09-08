import { expect, test } from '@playwright/test'

test('homepage presents Notes as the umbrella content section', async ({ page }) => {
  await page.goto('/')

  const notesSection = page.locator('.notebook')
  const hero = page.locator('.hero')

  await expect(notesSection.locator('.section-label')).toHaveText('Notes')
  await expect(notesSection.locator('h2')).toHaveText('Recent notes.')
  await expect(hero.getByRole('link')).toHaveCount(0)
  await expect(hero.locator('.hero-summary')).toContainText('This is my online home')
  await expect(page.getByRole('link', { name: 'See all notes' })).toHaveAttribute('href', '/posts')
  await expect(page.getByText('Featured notes', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Things I’ve written.', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Browse notes' })).toHaveCount(0)
})

test('homepage keeps distinct hero and notes typography roles', async ({ page }) => {
  await page.goto('/')

  await expect(page.locator('[data-headline-lead]')).toHaveCSS(
    'font-family',
    /Instrument Sans/,
  )
  await expect(page.locator('[data-headline-lead]')).toHaveCSS('font-weight', '700')
  await expect(page.locator('[data-headline-lead]')).toHaveCSS(
    'text-transform',
    'none',
  )
  await expect(page.locator('[data-headline-emphasis]')).toHaveCSS(
    'font-family',
    /Newsreader/,
  )
  await expect(page.locator('.notebook h2')).toHaveCSS('font-family', /Literata/)
  await expect(page.locator('.story-list h3').first()).toHaveCSS(
    'font-family',
    /Literata/,
  )
  await expect(page.locator('#work-title')).toHaveCSS('font-family', /Literata/)
  await expect(page.locator('#work-context-title')).toHaveCSS(
    'font-family',
    /Literata/,
  )
  await expect(page.locator('.closing h2')).toHaveCSS('font-family', /Literata/)
})

test('homepage keeps the hero and featured note composition responsive', async ({ page }) => {
  await page.goto('/')

  const featuredNoteFooter = page.locator('.lead-story-footer')
  await expect(featuredNoteFooter.locator('p')).toContainText('I moved from OmniFocus')
  await expect(featuredNoteFooter.locator('.story-action')).toHaveText('Open note')

  const [metaBox, titleBox, footerBox] = await Promise.all([
    page.locator('.lead-story .story-meta').boundingBox(),
    page.locator('.lead-story h3').boundingBox(),
    featuredNoteFooter.boundingBox(),
  ])
  if (!metaBox || !titleBox || !footerBox) {
    throw new Error('Expected the featured note layout regions to be visible')
  }
  expect(titleBox.y).toBeGreaterThanOrEqual(metaBox.y + metaBox.height - 0.5)
  expect(titleBox.y + titleBox.height).toBeLessThanOrEqual(footerBox.y + 0.5)

  if ((page.viewportSize()?.width ?? 0) > 900) {
    await expect(page.locator('.hero-sentence')).toHaveCSS('display', 'grid')
    await expect(featuredNoteFooter).toHaveCSS('grid-template-columns', /\d+.*px \d+.*px/)
  }
})

test('homepage stages its major sections as desktop slides', async ({ page }) => {
  await page.goto('/')

  const viewport = page.viewportSize()
  if (!viewport) throw new Error('Expected a viewport for the homepage layout test')

  const slides = page.locator('[data-home-slide]')
  await expect(slides).toHaveCount(5)

  if (viewport.width <= 900) {
    await expect(page.locator('html')).toHaveCSS('scroll-snap-type', 'none')
    return
  }

  await expect(page.locator('html')).toHaveCSS('scroll-snap-type', /^y(?: proximity)?$/)
  await expect(slides.first()).toHaveCSS('scroll-snap-align', 'start')

  const leadStory = await page.locator('.lead-story').boundingBox()
  const storyList = await page.locator('.story-list').boundingBox()
  if (!leadStory || !storyList) throw new Error('Expected the homepage stories to be visible')
  expect(Math.abs((leadStory.y + leadStory.height) - (storyList.y + storyList.height))).toBeLessThan(2)

  const hero = await page.locator('.hero').boundingBox()
  if (!hero) throw new Error('Expected the homepage hero to be visible')
  expect(hero.height).toBeGreaterThanOrEqual(viewport.height - 120)
})

test('homepage uses consistent type roles across notes and projects', async ({ page }) => {
  await page.goto('/')

  const typography = await page.evaluate(() => {
    const fontFamily = (selector: string) => {
      const element = document.querySelector(selector)
      if (!(element instanceof HTMLElement)) throw new Error(`Missing ${selector}`)
      return getComputedStyle(element).fontFamily
    }

    return {
      noteSummary: fontFamily('.story-list p'),
      noteTitle: fontFamily('.story-list h3'),
      projectMeta: fontFamily('.project-links span'),
      projectSummary: fontFamily('.project-links p'),
      projectTitle: fontFamily('.project-links h3'),
    }
  })

  expect(typography.projectTitle).toBe(typography.noteTitle)
  expect(typography.projectSummary).toBe(typography.noteSummary)
  expect(typography.projectMeta).toContain('IBM Plex Mono')
})
