import { expect, test } from '@playwright/test'

const scenarios = [
  { name: 'stored preferences override the system', storedTheme: 'light', storedPalette: 'plum', blocked: false, theme: 'light', palette: 'plum' },
  { name: 'a stored theme survives failure to remove a legacy palette', storedTheme: 'light', storedPalette: 'plum', blocked: false, removeBlocked: true, theme: 'light', palette: 'ember' },
  { name: 'system preference and a new palette work without storage values', storedTheme: null, storedPalette: null, blocked: false, theme: 'dark', palette: 'ember' },
  { name: 'invalid preferences use the system and a valid palette', storedTheme: 'invalid', storedPalette: 'invalid', blocked: false, theme: 'dark', palette: 'ember' },
  { name: 'blocked storage still permits initial appearance', storedTheme: null, storedPalette: null, blocked: true, theme: 'dark', palette: 'ember' },
] as const

for (const scenario of scenarios) {
  test(`before body parsing, ${scenario.name}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.addInitScript(options => {
      const { storedTheme, storedPalette, blocked } = options
      Math.random = () => 0
      if (storedTheme) localStorage.setItem('amaral-theme', storedTheme)
      if (storedPalette) sessionStorage.setItem('amaral-palette', storedPalette)
      if ('removeBlocked' in options) {
        Object.defineProperty(Storage.prototype, 'removeItem', {
          value() { throw new Error('Removing stored values is unavailable') },
        })
      }
      if (blocked) {
        for (const storage of ['localStorage', 'sessionStorage']) {
          Object.defineProperty(window, storage, {
            get() { throw new Error('Storage is unavailable') },
          })
        }
      }
    }, scenario)
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/_astro/*.js', route => route.abort())
    await page.route(url => url.pathname === '/', async route => {
      const response = await route.fetch()
      const html = await response.text()
      const probe = `<script>
        document.documentElement.dataset.startupTheme = document.documentElement.dataset.theme;
        document.documentElement.dataset.startupPalette = document.documentElement.dataset.palette;
        document.documentElement.dataset.startupColorScheme = document.documentElement.style.colorScheme;
        document.documentElement.dataset.startupThemeColor = document.querySelector('[data-theme-color]').content;
        document.documentElement.dataset.startupHadBody = String(Boolean(document.body));
      </script>`
      await route.fulfill({ response, body: html.replace('</head>', `${probe}</head>`) })
    })

    await page.goto('/')
    const root = page.locator('html')
    await expect(root).toHaveAttribute('data-startup-had-body', 'false')
    await expect(root).toHaveAttribute('data-startup-theme', scenario.theme)
    await expect(root).toHaveAttribute('data-startup-palette', scenario.palette)
    await expect(root).toHaveAttribute('data-startup-color-scheme', scenario.theme)
    await expect(root).toHaveAttribute('data-startup-theme-color', scenario.theme === 'light' ? '#ffffff' : '#0f1413')
    expect(errors).toEqual([])
  })
}

test('appearance controls work when storage access itself throws', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.addInitScript(() => {
    Math.random = () => 0
    for (const storage of ['localStorage', 'sessionStorage']) {
      Object.defineProperty(window, storage, {
        get() { throw new Error('Storage is unavailable') },
      })
    }
  })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  const theme = page.locator('[data-theme-toggle]')
  const palette = page.locator('[data-palette-toggle]')
  await expect(theme).toHaveAttribute('data-theme-toggle', 'ready')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await theme.click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(theme).toHaveAccessibleName('Theme: Light. Switch to Dark')
  await palette.click()
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'cobalt')
  await expect(palette).toHaveAccessibleName('Palette: Cobalt. Switch to Graphite')
  expect(errors).toEqual([])
})
