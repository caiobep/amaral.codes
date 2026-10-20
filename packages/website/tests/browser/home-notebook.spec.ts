import { expect, test } from '@playwright/test'

test('Featured Notes stays aligned while its section is hidden for reveal', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('desktop'))
  await page.goto('/')

  const offset = await page.evaluate(() => {
    const section = document.querySelector<HTMLElement>('.notebook')
    const lead = document.querySelector<HTMLElement>('.lead-story')
    const firstNote = document.querySelector<HTMLElement>('.story-list > a')
    if (!section || !lead || !firstNote) return Number.POSITIVE_INFINITY

    document.documentElement.classList.add('reveal-ready')
    section.dataset.revealReady = 'true'
    section.classList.remove('is-visible')

    return Math.abs(
      firstNote.getBoundingClientRect().top - lead.getBoundingClientRect().top,
    )
  })

  expect(offset).toBeLessThanOrEqual(2)
})

test('Featured Notes rows animate without shifting their content', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('desktop'))
  await page.goto('/')

  const firstNote = page.locator('.story-list > a').first()
  const metadata = firstNote.locator('.story-meta')
  const title = firstNote.locator('h3')
  const summary = firstNote.locator('p')
  const animatedText = [metadata, title, summary]
  const stylesBefore = await Promise.all(animatedText.map(
    (element) => element.evaluate((node) => {
      const style = getComputedStyle(node)
      return { color: style.color, transform: style.transform }
    }),
  ))
  const before = await firstNote.evaluate((note) => Array.from(
    note.children,
    (child) => child.getBoundingClientRect().left,
  ))
  expect(await firstNote.evaluate((note) => parseFloat(getComputedStyle(note).paddingLeft)))
    .toBeGreaterThanOrEqual(16)
  await firstNote.hover()
  await expect(firstNote).toHaveCSS('background-size', '100% 100%')
  for (const [index, element] of animatedText.entries()) {
    await expect.poll(() => element.evaluate((node) => {
      const style = getComputedStyle(node)
      return { color: style.color, transform: style.transform }
    })).not.toEqual(stylesBefore[index])
  }

  const after = await firstNote.evaluate((note) => Array.from(
    note.children,
    (child) => child.getBoundingClientRect().left,
  ))
  expect(after).toEqual(before)
})

test('the lead note uses anchored pointer parallax', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('desktop'))
  await page.goto('/')

  const leadNote = page.locator('.lead-story')
  const title = leadNote.locator('h3')
  const before = await leadNote.evaluate((note) => ({
    boxShadow: getComputedStyle(note).boxShadow,
    offsetHeight: (note as HTMLElement).offsetHeight,
    offsetLeft: (note as HTMLElement).offsetLeft,
    offsetTop: (note as HTMLElement).offsetTop,
    offsetWidth: (note as HTMLElement).offsetWidth,
  }))
  const titleTransformBefore = await title.evaluate((heading) => getComputedStyle(heading).transform)
  await leadNote.scrollIntoViewIfNeeded()
  const bounds = await leadNote.boundingBox()
  if (!bounds) throw new Error('Lead note is not visible')
  await page.mouse.move(
    bounds.x + bounds.width * 0.8,
    bounds.y + bounds.height * 0.25,
  )

  await expect.poll(() => leadNote.evaluate(
    (note) => getComputedStyle(note).boxShadow,
  )).not.toBe(before.boxShadow)
  await expect.poll(() => leadNote.evaluate(
    (note) => getComputedStyle(note).transform,
  )).not.toBe('none')
  await expect.poll(() => title.evaluate(
    (heading) => getComputedStyle(heading).transform,
  )).not.toBe(titleTransformBefore)
  expect(await leadNote.evaluate((note) => ({
    offsetHeight: (note as HTMLElement).offsetHeight,
    offsetLeft: (note as HTMLElement).offsetLeft,
    offsetTop: (note as HTMLElement).offsetTop,
    offsetWidth: (note as HTMLElement).offsetWidth,
  }))).toEqual({
    offsetHeight: before.offsetHeight,
    offsetLeft: before.offsetLeft,
    offsetTop: before.offsetTop,
    offsetWidth: before.offsetWidth,
  })

  await page.mouse.move(0, 0)
  await expect(leadNote).toHaveCSS('transform', 'none')
})

test('the lead note parallax respects reduced motion', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('desktop'))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  const leadNote = page.locator('.lead-story')
  await leadNote.hover()
  await expect(leadNote).toHaveCSS('transform', 'none')
  await expect(leadNote).not.toHaveAttribute('data-parallax-active', 'true')
})

test('Featured Projects mirrors the anchored title feedback from notes', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('desktop'))
  await page.goto('/')

  for (const selector of ['.featured-project', '.project-links > a']) {
    const project = page.locator(selector).first()
    const title = project.locator('h3')
    const summary = project.locator('p')
    await project.scrollIntoViewIfNeeded()
    await page.waitForTimeout(650)
    const projectRectBefore = await project.evaluate((element) => {
      const { height, width, x, y } = element.getBoundingClientRect()
      return { height, width, x, y: y + window.scrollY }
    })
    const titleTransformBefore = await title.evaluate((heading) => getComputedStyle(heading).transform)
    const summaryStyleBefore = await summary.evaluate((element) => {
      const style = getComputedStyle(element)
      return { color: style.color, transform: style.transform }
    })
    await project.hover()

    await expect.poll(() => title.evaluate(
      (heading) => getComputedStyle(heading).transform,
    )).not.toBe(titleTransformBefore)
    await expect.poll(() => summary.evaluate((element) => {
      const style = getComputedStyle(element)
      return { color: style.color, transform: style.transform }
    })).not.toEqual(summaryStyleBefore)
    expect(await project.evaluate((element) => {
      const { height, width, x, y } = element.getBoundingClientRect()
      return { height, width, x, y: y + window.scrollY }
    })).toEqual(projectRectBefore)
    if (selector === '.featured-project') {
      await page.screenshot({ path: testInfo.outputPath('featured-project-hover.png') })
    }
    await page.mouse.move(0, 0)
    await expect(title).toHaveCSS('transform', 'none')
    await project.focus()
    await expect(title).not.toHaveCSS('transform', 'none')
  }
})

test('primary navigation has transient hover feedback', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('desktop'))
  await page.goto('/')

  const projects = page.getByRole('navigation', { name: 'Primary navigation' })
    .getByRole('link', { name: 'Projects' })
  await projects.hover()

  await expect.poll(() => projects.evaluate(
    (link) => getComputedStyle(link).transform,
  )).not.toBe('none')
})
