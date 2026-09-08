import { expect, test } from '@playwright/test'

const routes = ['/', '/posts/', '/projects', '/about', '/contact']

test('post Markdown endpoints expose the authored content', async ({ request }) => {
  const response = await request.get('/posts/my_journey_with_productivity_tools.md')
  const markdown = await response.text()

  expect(response.ok()).toBe(true)
  expect(response.headers()['content-type']).toContain('text/markdown')
  expect(markdown).toContain('# What my productivity tools taught me')
  expect(markdown).toContain('- Author: Caio Amaral')
  expect(markdown).toContain('- Language: en')
  expect(markdown).toContain('- Canonical: https://amaral.codes/posts/my_journey_with_productivity_tools')
  expect(markdown).toContain('## Moving everything into Notion')
})

test('agent discovery endpoints expose only the intended representations', async ({ request }) => {
  const [llmsResponse, fullResponse, indexResponse] = await Promise.all([
    request.get('/llms.txt'),
    request.get('/llms-full.txt'),
    request.get('/content-index.json'),
  ])
  const llms = await llmsResponse.text()
  const full = await fullResponse.text()
  const index = await indexResponse.json() as {
    schemaVersion: number
    entries: { id: string, urls: { markdown: string } }[]
  }

  expect(llmsResponse.headers()['content-type']).toContain('text/plain')
  expect(llms).toContain('## Start here')
  expect(llms).toContain('https://amaral.codes/posts/my_journey_with_productivity_tools.md')
  expect(llms).not.toContain('Agile At Microsoft')
  expect(fullResponse.headers()['content-type']).toContain('text/plain')
  expect(full).toContain('# What my productivity tools taught me')
  expect(full).not.toContain('# Agile At Microsoft')
  expect(indexResponse.headers()['content-type']).toContain('application/json')
  expect(index.schemaVersion).toBe(1)
  expect(index.entries.some(({ id }) => id === 'agile_at_microsoft')).toBe(false)
  expect(JSON.stringify(index)).not.toContain('status')
})

test('post HTML advertises its agent-readable resources', async ({ page }) => {
  await page.goto('/posts/my_journey_with_productivity_tools')

  await expect(page.locator('link[rel="describedby"]')).toHaveAttribute('href', '/llms.txt')
  await expect(page.locator('link[rel="alternate"][type="text/markdown"]')).toHaveAttribute(
    'href',
    '/posts/my_journey_with_productivity_tools.md',
  )
})

test('articles suggest two other published entries to read next', async ({ page }) => {
  await page.goto('/posts/my_journey_with_productivity_tools')

  const nextReads = page.getByRole('complementary', { name: 'Next reads' })
  const links = nextReads.getByRole('link')

  await expect(nextReads).toBeVisible()
  await expect(links).toHaveCount(2)
  expect(await links.evaluateAll((elements) => elements.map((link) => link.getAttribute('href'))))
    .not.toContain('/posts/my_journey_with_productivity_tools')
})

test('content-relative images are bundled into the static article', async ({ page }) => {
  await page.goto('/posts/fixture-essay')

  const image = page.getByRole('img', {
    name: 'A deterministic inline content fixture',
  })
  await expect(image).toBeVisible()
  await expect.poll(() => image.evaluate(
    element => (element as HTMLImageElement).naturalWidth,
  )).toBeGreaterThan(0)
  await expect(image).toHaveAttribute('src', /\/_astro\//u)
})

test.describe('core layout', () => {
  routes.forEach((route) => {
    test(`${route} renders without horizontal overflow`, async ({ page }) => {
      await page.goto(route)
      await expect(page.locator('main')).toBeVisible()

      const hasOverflow = await page.evaluate(() => (
        document.documentElement.scrollWidth > window.innerWidth + 1
      ))
      expect(hasOverflow).toBe(false)
    })
  })

  test('keyboard users can bypass the header', async ({ page }, testInfo) => {
    test.skip(['mobile-webkit', 'tablet-webkit'].includes(testInfo.project.name))
    await page.goto('/')

    const skipLink = page.getByRole('link', { name: 'Skip to content' })
    if (testInfo.project.name === 'desktop-chromium') await page.keyboard.press('Tab')
    else await skipLink.focus()
    await expect(skipLink).toBeFocused()
    await expect(skipLink).toBeVisible()
    await page.keyboard.press('Enter')
    await expect(page.locator('main#content')).toBeFocused()
  })

  test('tablet navigation shrink-wraps its links', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'tablet-webkit')
    await page.goto('/')

    const measurements = await page.evaluate(() => {
      const list = document.querySelector('.site-nav ul')
      const actions = document.querySelector('.header-actions')
      const links = Array.from(document.querySelectorAll('.site-nav li'))
      const linksWidth = links.reduce((width, link) => width + link.getBoundingClientRect().width, 0)
      const listRect = list?.getBoundingClientRect()
      const actionsRect = actions?.getBoundingClientRect()
      const listGap = list ? Number.parseFloat(getComputedStyle(list).columnGap) || 0 : 0
      const occupiedWidth = linksWidth + listGap * Math.max(links.length - 1, 0)

      return {
        actionGap: (actionsRect?.left ?? 0) - (listRect?.right ?? 0),
        trailingSpace: (listRect?.width ?? 0) - occupiedWidth,
      }
    })

    expect(Math.abs(measurements.trailingSpace)).toBeLessThan(3)
    expect(measurements.actionGap).toBeLessThan(16)
  })

  test('tablet homepage does not reserve a missing portrait column', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'tablet-webkit')
    await page.goto('/')

    const layout = await page.locator('.hero-grid-no-portrait').evaluate((hero) => ({
      columns: getComputedStyle(hero).gridTemplateColumns.split(' ').length,
      copyRatio: (hero.querySelector('.hero-copy')?.getBoundingClientRect().width ?? 0)
        / hero.getBoundingClientRect().width,
    }))

    expect(layout.columns).toBe(1)
    expect(layout.copyRatio).toBeGreaterThan(0.9)
  })

  test('tablet notes keep search and filters on separate rows', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'tablet-webkit')
    await page.goto('/posts')

    const layout = await page.evaluate(() => {
      const section = document.querySelector<HTMLElement>('.search-section')
      const input = document.querySelector<HTMLInputElement>('.search-section input')
      const filters = document.querySelector<HTMLElement>('.post-filters')
      const sectionRect = section?.getBoundingClientRect()
      const inputRect = input?.getBoundingClientRect()
      const filtersRect = filters?.getBoundingClientRect()

      return {
        filtersFollowInput: (filtersRect?.top ?? 0) >= (inputRect?.bottom ?? 0),
        inputRatio: (inputRect?.width ?? 0) / (sectionRect?.width ?? 1),
      }
    })

    expect(layout.inputRatio).toBeGreaterThan(0.9)
    expect(layout.filtersFollowInput).toBe(true)
  })

  test('compact mobile navigation keeps every primary link visible', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-webkit')
    await page.setViewportSize({ height: 844, width: 320 })
    await page.goto('/')

    const measurements = await page.evaluate(() => {
      const navigation = document.querySelector<HTMLElement>('.site-nav')
      const links = Array.from(document.querySelectorAll<HTMLElement>('.site-nav a'))
      const navigationRect = navigation?.getBoundingClientRect()
      const activeLink = document.querySelector<HTMLElement>('.site-nav a[aria-current="page"]')
      const activeStyle = activeLink ? getComputedStyle(activeLink) : null

      return {
        activeLinkIsUnboxed: activeStyle?.backgroundColor === 'rgba(0, 0, 0, 0)',
        clientWidth: navigation?.clientWidth ?? 0,
        linksInsideNavigation: links.every((link) => {
          const linkRect = link.getBoundingClientRect()
          return linkRect.left >= (navigationRect?.left ?? 0) - 1
            && linkRect.right <= (navigationRect?.right ?? 0) + 1
        }),
        scrollWidth: navigation?.scrollWidth ?? 0,
      }
    })

    expect(measurements.activeLinkIsUnboxed).toBe(true)
    expect(measurements.scrollWidth).toBeLessThanOrEqual(measurements.clientWidth + 1)
    expect(measurements.linksInsideNavigation).toBe(true)
  })

  test('theme preference supports system, light, and dark modes', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('banner').getByRole('link', { name: 'Say hello' })).toHaveCount(0)
    const footer = page.getByRole('contentinfo')
    const themeToggle = footer.locator('[data-theme-toggle]')
    await expect(themeToggle).toHaveAccessibleName('Theme: System. Switch to Light')
    await expect(themeToggle).toContainText('System')
    expect(await page.evaluate(() => localStorage.getItem('amaral-theme'))).toBeNull()

    await themeToggle.click()
    await expect(themeToggle).toHaveAccessibleName('Theme: Light. Switch to Dark')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await expect.poll(async () => page.evaluate(() => (
      getComputedStyle(document.documentElement).getPropertyValue('--paper').trim()
    ))).toBe('#fff')
    expect(await page.evaluate(() => localStorage.getItem('amaral-theme'))).toBe('light')

    await themeToggle.click()
    await expect(themeToggle).toHaveAccessibleName('Theme: Dark. Switch to System')
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    expect(await page.evaluate(() => localStorage.getItem('amaral-theme'))).toBe('dark')

    await themeToggle.click()
    await expect(themeToggle).toHaveAccessibleName('Theme: System. Switch to Light')
    expect(await page.evaluate(() => localStorage.getItem('amaral-theme'))).toBeNull()
  })

  test('mobile browser chrome follows the footer at the document end', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-webkit')
    await page.goto('/posts/my_journey_with_productivity_tools')

    const root = page.locator('html')
    const themeColor = page.locator('meta[data-theme-color]')
    await expect(root).toHaveAttribute('data-browser-chrome-surface', 'page')
    await expect(themeColor).toHaveAttribute('content', '#ffffff')

    await page.getByRole('contentinfo').scrollIntoViewIfNeeded()
    await expect(root).toHaveAttribute('data-browser-chrome-surface', 'footer')
    await expect(themeColor).toHaveAttribute('content', '#111817')
    await expect.poll(() => root.evaluate((element) => (
      getComputedStyle(element).backgroundColor
    ))).toBe('rgb(17, 24, 23)')
    await expect.poll(() => page.locator('body').evaluate((element) => (
      getComputedStyle(element).backgroundColor
    ))).toBe('rgb(17, 24, 23)')
    const footerPaint = await page.getByRole('contentinfo').evaluate((element) => ({
      bottom: Math.round(element.getBoundingClientRect().bottom + window.scrollY),
      boxShadow: getComputedStyle(element).boxShadow,
      documentHeight: document.documentElement.scrollHeight,
    }))
    expect(footerPaint.boxShadow).toContain('rgb(17, 24, 23)')
    expect(Math.abs(footerPaint.documentHeight - footerPaint.bottom)).toBeLessThanOrEqual(1)

    await page.locator('main').evaluate(element => element.scrollIntoView())
    await expect(root).toHaveAttribute('data-browser-chrome-surface', 'page')
    await expect(themeColor).toHaveAttribute('content', '#ffffff')
    await expect.poll(() => page.locator('body').evaluate((element) => (
      getComputedStyle(element).backgroundColor
    ))).toBe('rgb(255, 255, 255)')
  })

  test('palette starts randomly and remains stable for the visit', async ({ page }) => {
    await page.addInitScript(() => {
      Math.random = () => 0
    })
    await page.goto('/')

    const footer = page.getByRole('contentinfo')
    const themeToggle = footer.locator('[data-theme-toggle]')
    const paletteToggle = footer.locator('[data-palette-toggle]')
    await expect(paletteToggle).toHaveAccessibleName('Palette: Ember. Switch to Cobalt')
    await expect(paletteToggle).toContainText('Ember')
    await expect(page.locator('html')).toHaveAttribute('data-palette', 'ember')
    await expect.poll(async () => page.evaluate(() => (
      getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
    ))).toBe('#ad4c38')
    expect(await page.evaluate(() => localStorage.getItem('amaral-palette'))).toBeNull()
    expect(await page.evaluate(() => sessionStorage.getItem('amaral-palette'))).toBe('ember')

    const themeBox = await themeToggle.boundingBox()
    const paletteBox = await paletteToggle.boundingBox()
    expect(themeBox).not.toBeNull()
    expect(paletteBox).not.toBeNull()
    if (!themeBox || !paletteBox) throw new Error('Appearance controls must be visible')
    expect(paletteBox.y).toBeGreaterThanOrEqual(themeBox.y + themeBox.height)

    await paletteToggle.click()
    await expect(paletteToggle).toHaveAccessibleName('Palette: Cobalt. Switch to Graphite')
    await expect(page.locator('html')).toHaveAttribute('data-palette', 'cobalt')
    await expect.poll(async () => page.evaluate(() => (
      getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
    ))).toBe('#3169ab')
    expect(await page.evaluate(() => sessionStorage.getItem('amaral-palette'))).toBe('cobalt')

    await page.reload()
    await expect(paletteToggle).toContainText('Cobalt')

    await paletteToggle.click()
    await expect(page.locator('html')).toHaveAttribute('data-palette', 'graphite')
    await expect.poll(async () => page.evaluate(() => ({
      noise: getComputedStyle(document.body, '::before').opacity,
      paper: getComputedStyle(document.documentElement).getPropertyValue('--paper').trim(),
      surface: getComputedStyle(document.documentElement).getPropertyValue('--paper-strong').trim(),
    }))).toEqual({
      noise: '0',
      paper: '#fff',
      surface: '#fff',
    })

    for (const palette of ['garnet', 'ochre', 'plum', 'lagoon']) {
      await paletteToggle.click()
      await expect(page.locator('html')).toHaveAttribute('data-palette', palette)
    }

    await paletteToggle.click()
    await expect(page.locator('html')).toHaveAttribute('data-palette', 'ember')
    expect(await page.evaluate(() => localStorage.getItem('amaral-palette'))).toBeNull()
    expect(await page.evaluate(() => sessionStorage.getItem('amaral-palette'))).toBe('ember')

    await expect.poll(async () => page.evaluate(() => {
      const root = document.documentElement
      const accent = getComputedStyle(root).getPropertyValue('--accent').trim()
      const selection = getComputedStyle(root, '::selection').backgroundColor
      return { accent, selection }
    })).toEqual({ accent: '#ad4c38', selection: 'rgb(173, 76, 56)' })
  })

  test('homepage rotates its headline collection without an immediate repeat', async ({ page }) => {
    await page.addInitScript(() => {
      Math.random = () => 0
    })
    await page.goto('/')

    const headline = page.locator('[data-rotating-headline]')
    const serializedVariants = await headline.getAttribute('data-headlines')
    const serializedEasterEggs = await headline.getAttribute('data-easter-egg-headlines')
    const variants = JSON.parse(serializedVariants ?? '[]') as {
      emphasis: string
      lead: string
    }[]
    const easterEggs = JSON.parse(serializedEasterEggs ?? '[]') as {
      emphasis: string
      lead: string
    }[]
    const normalize = (value: string) => value.replace(/\s+/g, ' ').trim()
    const copy = variants.map(({ emphasis, lead }) => normalize(`${lead}${emphasis}`))
    const first = normalize(await headline.textContent() ?? '')
    const animatedWords = headline.locator('[data-headline-emphasis] .headline-word')

    expect(await animatedWords.count()).toBeGreaterThan(0)
    await expect(animatedWords.first()).toHaveCSS('animation-name', 'headline-word-arrival')
    await page.reload()
    const second = normalize(await headline.textContent() ?? '')

    expect(variants).toHaveLength(25)
    expect(easterEggs).toEqual([{ emphasis: 'For those who come after.', lead: '' }])
    expect(copy).toContain(first)
    expect(copy).toContain(second)
    expect(second).not.toBe(first)
  })

  test('homepage can surface its rare easter egg headline', async ({ page }) => {
    await page.addInitScript(() => {
      Math.random = () => 0.99
    })
    await page.goto('/')

    const headline = page.locator('[data-rotating-headline]')
    await expect(headline).toHaveText('For those who come after.')
    await expect(headline.locator('[data-headline-emphasis] .headline-word')).toHaveCount(5)
  })

  test('homepage headline remains static when reduced motion is requested', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto('/')

    const firstWord = page.locator('[data-headline-emphasis] .headline-word').first()
    await expect(firstWord).toBeVisible()
    await expect(firstWord).toHaveCSS('animation-name', 'none')
    await expect(firstWord).toHaveCSS('opacity', '1')
  })

  test('featured project images keep their intrinsic aspect ratios', async ({ page }) => {
    await page.goto('/projects')

    const images = page.locator('.project-case .project-visual img')
    expect(await images.count()).toBeGreaterThan(0)

    for (const image of await images.all()) {
      await image.scrollIntoViewIfNeeded()
      await expect.poll(() => image.evaluate(
        (element) => (element as HTMLImageElement).naturalWidth,
      )).toBeGreaterThan(0)

      const ratios = await image.evaluate((element) => ({
        intrinsic: (element as HTMLImageElement).naturalWidth
          / (element as HTMLImageElement).naturalHeight,
        rendered: element.getBoundingClientRect().width / element.getBoundingClientRect().height,
      }))
      expect(Math.abs(ratios.intrinsic - ratios.rendered)).toBeLessThan(0.02)
    }
  })

  test('primary links use resilient document navigation', async ({ page }) => {
    await page.goto('/')
    const navigation = page.getByRole('navigation', { name: 'Primary navigation' })
    await expect(navigation.getByRole('link', { name: 'Notes' })).toHaveAttribute('href', '/posts')
    await expect(navigation.getByRole('link', { name: 'Posts' })).toHaveCount(0)
    await page.evaluate(() => {
      Object.assign(window, { __navigationSentinel: true })
    })

    await page.getByRole('banner').getByRole('link', { name: 'About' }).click()
    await expect(page).toHaveURL(/\/about\/?$/)

    const sentinelSurvived = await page.evaluate(() => (
      '__navigationSentinel' in window
    ))
    expect(sentinelSurvived).toBe(false)
  })

  test('work context stays on the homepage rather than the projects page', async ({ page }) => {
    await page.goto('/projects')
    await expect(page.locator('#work-history')).toHaveCount(0)
    await expect(page.locator('.company-history')).toHaveCount(0)

    await page.goto('/')

    const layout = await page.evaluate(() => {
      const section = document.querySelector<HTMLElement>('.work-context')
      const companyHistory = document.querySelector<HTMLElement>('.company-history')
      return {
        companyHistory: companyHistory?.getBoundingClientRect().width ?? 0,
        section: section?.getBoundingClientRect().width ?? 0,
      }
    })

    expect(layout.companyHistory).toBeGreaterThan(0)
    expect(Math.abs(layout.companyHistory - layout.section)).toBeLessThan(2)
  })

  test('search filters align with the search field', async ({ page }) => {
    await page.goto('/search')

    const alignment = await page.evaluate(() => {
      const field = document.querySelector<HTMLElement>('.search-field')
      const filters = document.querySelector<HTMLElement>('.search-filter-options')
      return Math.abs(
        (field?.getBoundingClientRect().left ?? 0)
          - (filters?.getBoundingClientRect().left ?? 0),
      )
    })

    expect(alignment).toBeLessThan(2)
  })

  test('article prose keeps a readable measure', async ({ page }) => {
    await page.goto('/posts/my_journey_with_productivity_tools')

    const width = await page.locator('.content').evaluate(
      (content) => content.getBoundingClientRect().width,
    )

    expect(width).toBeLessThanOrEqual(700)
  })

  test('homepage includes work context without a detached spacer', async ({ page }) => {
    await page.goto('/')

    const section = page.getByRole('region', { name: 'Teams and products I’ve worked with.' })
    await expect(section).toBeVisible()
    await expect(section.locator('.company-history')).toBeVisible()
    await expect(section.locator('.companies a')).toHaveCount(16)
    await expect(section.getByRole('link', { name: 'See projects' })).toHaveAttribute(
      'href',
      '/projects',
    )

    const sectionGap = await page.evaluate(() => {
      const workContext = document.querySelector<HTMLElement>('.work-context')
      const closing = document.querySelector<HTMLElement>('.closing')
      return (closing?.getBoundingClientRect().top ?? 0)
        - (workContext?.getBoundingClientRect().bottom ?? 0)
    })
    expect(Math.abs(sectionGap)).toBeLessThan(2)
  })

  test('about portrait responds to a fine pointer and settles on exit', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chromium')
    await page.goto('/about')

    const portrait = page.locator('.about-hero [data-portrait-motion]')
    await expect(portrait).toHaveAttribute('data-pointer-motion', 'ready')
    const bounds = await portrait.boundingBox()
    expect(bounds).not.toBeNull()
    if (!bounds) return

    await page.mouse.move(bounds.x + bounds.width - 2, bounds.y + bounds.height - 2)
    const shifted = await portrait.evaluate((element) => ({
      x: element.style.getPropertyValue('--portrait-x'),
      y: element.style.getPropertyValue('--portrait-y'),
    }))
    expect(shifted.x).not.toBe('0px')
    expect(shifted.y).not.toBe('0px')

    await page.mouse.move(0, 0)
    await expect.poll(() => portrait.evaluate((element) => ({
      x: element.style.getPropertyValue('--portrait-x') || '0px',
      y: element.style.getPropertyValue('--portrait-y') || '0px',
    }))).toEqual({ x: '0px', y: '0px' })
  })
})

test('mobile search supports fast keyboard navigation', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('desktop'))
  await page.goto('/')
  await page.getByRole('button', { name: 'Search' }).click()

  const input = page.getByRole('combobox', { name: 'Search the site' })
  await expect(input).toBeFocused()
  await input.fill('productivity')
  await expect(input).toHaveAttribute('aria-expanded', 'true')

  const options = page.getByRole('option')
  await expect(options.first()).toBeVisible()
  expect(await options.count()).toBeLessThanOrEqual(6)

  await input.press('ArrowDown')
  await expect(options.first()).toHaveAttribute('aria-selected', 'true')
  await expect(input).toHaveAttribute('aria-activedescendant', await options.first().getAttribute('id') ?? '')

  const closeButton = page.getByRole('button', { name: 'Close search' })
  await closeButton.focus()
  await expect(closeButton).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.locator('[data-header-search]')).toHaveAttribute('aria-hidden', 'true')
  await expect(page.getByRole('button', { name: 'Search' })).toBeFocused()
})

test('mobile search retries after its initial index request fails', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-webkit')
  await page.addInitScript(() => {
    const runtimeWindow = window as typeof window & { searchIndexRequests: number }
    const browserFetch = window.fetch.bind(window)
    runtimeWindow.searchIndexRequests = 0
    window.fetch = async (input, init) => {
      const requestUrl = new URL(input instanceof Request ? input.url : input.toString(), window.location.href)
      if (requestUrl.pathname === '/search-index.json') {
        runtimeWindow.searchIndexRequests += 1
        if (runtimeWindow.searchIndexRequests === 1) {
          return new Response('temporarily unavailable', { status: 503 })
        }
      }
      return browserFetch(input, init)
    }
  })

  await page.goto('/')
  const preloadFailure = page.waitForEvent('console', {
    predicate: (message) => message.text().includes('Search preload failed.'),
  })
  await page.getByRole('button', { name: 'Search' }).click()
  await preloadFailure

  const input = page.getByRole('combobox', { name: 'Search the site' })
  await input.fill('productivity')

  await expect(page.getByRole('option').first()).toBeVisible()
  expect(await page.evaluate(() => (
    window as typeof window & { searchIndexRequests: number }
  ).searchIndexRequests)).toBe(2)
})

test('search page retries after its initial index request fails', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop-chromium')
  let searchIndexRequests = 0
  await page.route('**/search-index.json', async (route) => {
    searchIndexRequests += 1
    if (searchIndexRequests === 1) {
      await route.fulfill({ status: 503, body: 'temporarily unavailable' })
      return
    }
    await route.continue()
  })

  await page.goto('/search')
  const input = page.getByRole('searchbox', { name: 'Search the site' })
  await input.fill('productivity')
  await expect(page.locator('[data-search-status]')).toHaveText('Search could not load. Please try again.')

  await input.fill('productivity tools')

  await expect(page.locator('[data-search-status]')).toContainText('for “productivity tools”.')
  expect(searchIndexRequests).toBe(2)
})

test('desktop search entry points focus without scrolling or hijacking text fields', async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith('desktop'))

  await page.goto('/posts/my_journey_with_productivity_tools/')
  await page.getByRole('banner').getByRole('link', { name: 'Search' }).click()
  await expect(page).toHaveURL(/\/search\/?$/)
  await expect(page.getByRole('searchbox', { name: 'Search the site' })).toBeFocused()
  expect(await page.evaluate(() => window.scrollY)).toBe(0)

  for (const shortcut of ['Meta+K', 'Meta+P', 'Control+K', 'Control+P']) {
    await page.goto('/')
    await page.keyboard.press(shortcut)
    await expect(page).toHaveURL(/\/search\/?$/)
    const searchInput = page.getByRole('searchbox', { name: 'Search the site' })
    await expect(searchInput).toBeFocused()
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
    await page.keyboard.type('systems')
    await expect(searchInput).toHaveValue('systems')
    await expect(page).toHaveURL(/\/search\/?\?query=systems$/)
  }

  await page.goto('/contact')
  const nameInput = page.getByRole('textbox', { name: 'Name' })
  await nameInput.focus()
  await page.keyboard.press('Meta+K')
  await expect(page).toHaveURL(/\/contact\/?$/)
  await expect(nameInput).toBeFocused()
})

test('post filters represent content types only', async ({ page }) => {
  await page.goto('/posts?featured=true')

  const filters = page.getByRole('group', { name: 'Browse the shelves' })
  await expect(filters.getByRole('button', { name: /Selected/ })).toHaveCount(0)
  await expect(filters.getByRole('button', { name: /All/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(page).toHaveURL(/\/posts\/?$/)
})

test('note formats pair their label with a compact type icon', async ({ page }) => {
  await page.goto('/posts')

  for (const category of ['essay', 'link', 'note', 'podcast', 'review', 'talk']) {
    const type = page.locator(`.post[data-category="${category}"] .post-type`).first()
    await expect(type).toContainText(category)
    await expect(type.locator('svg[aria-hidden="true"]')).toHaveCount(1)
  }
})

test('note results end with a clear completion marker', async ({ page }) => {
  await page.goto('/posts?category=review')

  const endState = page.locator('[data-end-state]')
  await expect(endState).toBeVisible()
  await expect(endState).toContainText('That’s all for now.')

  await page.getByRole('searchbox', { name: 'Search the library' }).fill('no result can match this')
  await expect(endState).toBeHidden()
  await expect(page.locator('.empty-state')).toBeVisible()

  await page.getByRole('button', { name: 'Clear note search' }).click()
  await expect(page.getByRole('searchbox', { name: 'Search the library' })).toHaveValue('')
  await expect(page).toHaveURL(/\/posts\/?\?category=review$/)
  await expect(endState).toBeVisible()
})

test('touch header hides and returns without changing page width', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name.startsWith('desktop'))
  await page.goto('/')

  const header = page.locator('.site-header')
  const initialWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  await page.evaluate(() => window.scrollTo({ top: 1_000 }))
  await expect(header).toHaveAttribute('data-scroll-visibility', /hidden|detached/)

  await page.evaluate(() => window.scrollBy({ top: -80 }))
  await expect(header).toHaveAttribute('data-scroll-visibility', 'visible')
  await expect(header).toHaveAttribute('data-scroll-following', 'true')
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(initialWidth)
})

test('mobile article components do not stack adjacent dividers', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-webkit')
  await page.goto('/posts/lambda3-113-cafe/')

  const borders = await page.evaluate(() => {
    const header = document.querySelector<HTMLElement>('.article > header')
    const podcast = document.querySelector<HTMLElement>('.podcast-player')

    return {
      headerBottom: header ? getComputedStyle(header).borderBottomWidth : null,
      podcastTop: podcast ? getComputedStyle(podcast).borderTopWidth : null,
    }
  })

  expect(
    Number.parseFloat(borders.headerBottom ?? '0') > 0
      && Number.parseFloat(borders.podcastTop ?? '0') > 0,
  ).toBe(false)

  await page.goto('/posts/nativescript-vs-ionic/')
  const talkTop = await page.evaluate(() => {
    const talk = document.querySelector<HTMLElement>('.talk-details')
    return talk ? getComputedStyle(talk).borderTopWidth : null
  })
  expect(talkTop).toBe('0px')
})

test('articles expose article-specific metadata', async ({ page }) => {
  await page.goto('/posts/my_journey_with_productivity_tools/')

  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article')
  await expect(page.locator('meta[property="article:published_time"]')).toHaveAttribute('content', /2022-/)

  const articleData = await page.locator('script[type="application/ld+json"]').textContent()
  const parsedData = JSON.parse(articleData ?? '{}') as Record<string, unknown>
  expect(parsedData['@type']).toBe('BlogPosting')
  expect(parsedData.headline).toBe('What my productivity tools taught me')
})

test('RSS has readable entry points and valid dedicated feeds', async ({ page, request }) => {
  await page.goto('/')

  const footer = page.getByRole('contentinfo')
  const exploreLinks = footer.getByRole('region', { name: 'Explore' })
  await expect(exploreLinks.getByRole('link', { name: 'Podcasts' })).toHaveAttribute(
    'href',
    '/posts?category=podcast',
  )
  await expect(exploreLinks.getByRole('link', { name: 'Talks' })).toHaveAttribute(
    'href',
    '/posts?category=talk',
  )

  const rssLinks = footer.getByRole('region', { name: 'RSS' })
  const footerFeeds = [
    ['All content feed', '/rss#everything'],
    ['Reviews feed', '/rss#reviews'],
    ['Podcast feed', '/rss#podcasts'],
    ['Talk feed', '/rss#talks'],
  ] as const

  for (const [name, href] of footerFeeds) {
    await expect(rssLinks.getByRole('link', { name })).toHaveAttribute('href', href)
  }

  await rssLinks.getByRole('link', { name: 'All content feed' }).click()

  await expect(page).toHaveURL(/\/rss\/?#everything$/)
  await expect(page.getByRole('heading', { name: 'Follow what interests you.' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'View raw feed' })).toHaveCount(4)
  await expect(page.locator('link[rel="alternate"][type="application/rss+xml"]')).toHaveAttribute('href', '/rss.xml')

  const feedRoutes = [
    ['/rss.xml', '<title>Caio Amaral</title>'],
    ['/feeds/reviews.xml', '<title>Reviews · Caio Amaral</title>'],
    ['/feeds/podcasts.xml', '<title>Podcasts · Caio Amaral</title>'],
    ['/feeds/talks.xml', '<title>Talks · Caio Amaral</title>'],
  ] as const

  for (const [route, title] of feedRoutes) {
    const feedResponse = await request.get(route)
    expect(feedResponse.ok()).toBe(true)
    expect(feedResponse.headers()['content-type']).toContain('xml')

    const feedXml = await feedResponse.text()
    expect(feedXml).toContain('<?xml-stylesheet type="text/xsl" href="/rss.xsl"?>')
    expect(feedXml).toContain('<rss version="2.0">')
    expect(feedXml).toContain(title)
  }

  const reviewFeed = await (await request.get('/feeds/reviews.xml')).text()
  expect(reviewFeed).toContain('<title>My favorite apps for traveling abroad</title>')
  expect(reviewFeed).not.toContain('<title>What my productivity tools taught me</title>')

  const podcastFeed = await (await request.get('/feeds/podcasts.xml')).text()
  expect(podcastFeed).toContain('<title>RebuildCast 9 - Ferramentas de linha de comando</title>')
  expect(podcastFeed).toContain('https://cast.rocks/hosting/28261/CLIs.mp3')
  expect(podcastFeed).not.toContain('<title>My favorite apps for traveling abroad</title>')

  const talkFeed = await (await request.get('/feeds/talks.xml')).text()
  expect(talkFeed).toContain('<title>Functional programming with React</title>')
  expect(talkFeed).not.toContain('<title>RebuildCast 9 - Ferramentas de linha de comando</title>')
})

test('talk entries use external canonical materials and local previews', async ({ page, request }) => {
  await page.goto('/posts/functional-programming-with-react/')

  await expect(page.getByRole('heading', { name: 'Functional programming with React' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'All talks' })).toHaveAttribute(
    'href',
    '/posts?category=talk',
  )
  await expect(page.getByText('Talk · XP Inc. · English')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Download the original deck Keynote' })).toHaveAttribute(
    'href',
    'https://assets.amaral.codes/talks/functional-programming-with-react/slides.key',
  )

  const reactPreview = page.getByRole('region', { name: 'Open the slides preview' })
  await expect(reactPreview).toHaveAttribute(
    'data-pdf-url',
    'https://assets.amaral.codes/talks/functional-programming-with-react/slides.pdf',
  )
  await expect(reactPreview.getByAltText('First slide from open the slides')).toHaveAttribute(
    'src',
    '/talks/functional-programming-with-react/preview.webp',
  )

  await page.goto('/posts/nativescript-vs-ionic/')
  const preview = page.getByRole('region', { name: 'Open the slides preview' })

  await expect(preview.getByAltText('First slide from open the slides')).toHaveAttribute(
    'src',
    '/talks/nativescript-vs-ionic/preview.webp',
  )
  await expect(preview.getByRole('link', { name: 'Open full screen' })).toHaveAttribute(
    'href',
    'https://assets.amaral.codes/talks/nativescript-vs-ionic/slides.pdf',
  )
  await expect(preview.getByRole('link', { name: 'Download PDF' })).toHaveAttribute(
    'href',
    'https://assets.amaral.codes/talks/nativescript-vs-ionic/slides.pdf',
  )
  await expect(preview.locator('[data-preview-canvas]')).toBeHidden()
  await expect(preview.locator('[data-preview-toggle]')).toHaveAccessibleName('Preview slides')

  for (const posterPath of [
    '/talks/functional-programming-with-react/preview.webp',
    '/talks/nativescript-vs-ionic/preview.webp',
  ]) {
    const posterResponse = await request.get(posterPath)
    expect(posterResponse.ok()).toBe(true)
    expect(posterResponse.headers()['content-type']).toContain('image/webp')
    expect((await posterResponse.body()).byteLength).toBeGreaterThan(10_000)
  }
})

test('podcast entries expose useful local and publisher playback paths', async ({ page }) => {
  await page.goto('/posts/rebuildcast-9-cli-tools/')

  await expect(page.getByRole('heading', {
    name: 'RebuildCast 9 - Ferramentas de linha de comando',
  })).toBeVisible()
  await expect(page.locator('time[datetime="2021-01-26"]')).toHaveText('January 26, 2021')
  await expect(page.locator('audio')).toHaveAttribute('preload', 'none')
  await expect(page.locator('audio')).toHaveAttribute(
    'src',
    'https://cast.rocks/hosting/28261/CLIs.mp3',
  )
  await expect(page.getByText('No transcript is available on this site.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Episode notes' })).toHaveAttribute(
    'href',
    'https://lucasteles.dev/rebuildcast-9-ferramentas-de-linha-de-comando',
  )
  const playerLinks = [
    ['Listen on Apple Podcasts', 'https://podcasts.apple.com/us/podcast/rebuildcast/id1533558833'],
    ['Listen on Spotify', 'https://open.spotify.com/episode/1kC8BlO7gogyIOJkvT8phi'],
    [
      'Listen on Pocket Casts',
      'https://pocketcasts.com/podcast/rebuildcast/8549d6d0-e982-0138-e7eb-0acc26574db2',
    ],
    ['Listen on Overcast', 'https://overcast.fm/itunes1533558833'],
  ] as const

  for (const [name, href] of playerLinks) {
    await expect(page.getByRole('link', { name })).toHaveAttribute('href', href)
  }
  const episodeData = await page.locator('script[type="application/ld+json"]').textContent()
  const parsedEpisodeData = JSON.parse(episodeData ?? '{}') as Record<string, unknown>
  expect(parsedEpisodeData['@type']).toBe('PodcastEpisode')

  await page.goto('/posts/lambda3-118-ios-macos/')
  await expect(page.locator('audio')).toHaveCount(0)
  await expect(page.getByText('No transcript is available on this site.')).toHaveCount(0)
  await expect(page.getByText('Listen through the original publisher.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Listen on Pocket Casts' })).toHaveAttribute(
    'href',
    'https://pocketcasts.com/podcast/lambda3-podcast/2c13caf0-f08d-0133-9c6b-59d98c6b72b8',
  )
})
