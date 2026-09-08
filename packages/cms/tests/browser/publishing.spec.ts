import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { test, expect, webkit, type Page, type APIRequestContext, type BrowserContext } from '@playwright/test'
import { checkLivePreview, checkVersionRestore } from './live-preview'
import { checkMediaPreviews } from './media-preview'
import { cmsOrigin, previewOrigin } from './origins'

const apiHeaders = { Origin: cmsOrigin }
const firstRevision = 'This is the first saved revision.'
const draftRevision = 'This unpublished change must stay private.'

test('private writing, uploads, preview, and published revisions', async ({ page, context, request }) => {
  const password = await registerEditor(page)
  await createDraft(page)
  const id = documentID(page)
  await checkLivePreview(page, firstRevision)
  await checkVersionRestore(page, id, firstRevision)
  const preview = await openPreview(page, context)
  await verifyRevisions({ page, preview, api: context.request, id })
  const imageURL = await uploadImage(page, context.request, request)
  await insertImage(page, id)
  await preview.reload()
  const image = preview.locator('.content img')
  await expect(image).toBeVisible()
  expect(await image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0)
  await checkPrivacy(request, id)
  await preview.screenshot({ path: test.info().outputPath('article-desktop.png'), fullPage: true })
  await checkMobile(context, id)
  await checkMediaPreviews(page, context.request, request, id)
  await checkUnpublish(context.request, id)
  await checkLogout({ page, preview, api: context.request, imageURL, password })
  await checkIncompleteDraft(context.request, preview)
})

function documentID(page: Page) {
  const id = new URL(page.url()).pathname.split('/').at(-1)
  if (!id) throw new Error('Missing document ID.')
  return id
}

async function registerEditor(page: Page) {
  await page.goto('/admin/create-first-user')
  await expect(page.getByText('To begin, create your first user.')).toBeVisible()
  await page.locator('#field-email').pressSequentially('preview-test@example.invalid', { delay: 15 })
  const password = randomBytes(24).toString('hex')
  await page.locator('#field-password').pressSequentially(password, { delay: 15 })
  await page.locator('#field-confirm-password').pressSequentially(password, { delay: 15 })
  await page.locator('#field-confirm-password').blur()
  await page.getByRole('button', { name: 'Create', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Notes', exact: true }).first()).toBeVisible()
  return password
}

async function createDraft(page: Page) {
  await page.goto('/admin/collections/entries/create')
  await page.locator('#field-title').fill('A private publishing trial')
  await page.locator('#field-slug').fill('private-publishing-trial')
  await page.locator('#field-summary').fill('Testing the editor against the real article layout.')
  await page.locator('[contenteditable="true"]').fill('/')
  await expect(page.getByText('Upload', { exact: true })).toBeVisible()
  await expect(page.getByText('Relationship', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Heading 1', { exact: true })).toHaveCount(0)
  await page.locator('[contenteditable="true"]').press('Escape')
  await page.locator('[contenteditable="true"]').fill(firstRevision)
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click()
  await expect(page).toHaveURL(/entries\/\d+/)
}

async function openPreview(page: Page, context: BrowserContext) {
  const popupEvent = context.waitForEvent('page')
  await page.getByRole('link', { name: 'Preview', exact: true }).click()
  const preview = await popupEvent
  await expect(preview.getByRole('heading', { level: 1 })).toHaveText('A private publishing trial')
  await expect(preview.locator('.content')).toContainText(firstRevision)
  await expect(preview.getByText('Saved draft', { exact: true })).toBeVisible()
  await expect(preview.getByRole('button', { name: 'Share', exact: true })).toHaveCount(0)
  return preview
}

interface RevisionContext { page: Page; preview: Page; api: APIRequestContext; id: string }

async function verifyRevisions({ page, preview, api, id }: RevisionContext) {
  expect((await api.get(`${previewOrigin}/cms-preview/${id}?revision=published`, { headers: apiHeaders })).status()).toBe(404)
  await page.getByRole('button', { name: 'Publish changes', exact: true }).click()
  await expect(page.getByText('Status: Published', { exact: false })).toBeVisible()
  await page.locator('[contenteditable="true"]').fill(draftRevision)
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click()
  await expect.poll(async () => (await api.get(`/api/entries/${id}/preview`, { headers: apiHeaders })).text()).toContain(draftRevision)
  const published = await api.get(`/api/entries/${id}/preview?revision=published`, { headers: apiHeaders })
  expect(await published.text()).toContain(firstRevision)
  await preview.reload()
  await expect(preview.locator('.content')).toContainText(draftRevision)
}

async function uploadImage(page: Page, api: APIRequestContext, anonymous: APIRequestContext) {
  await page.goto('/admin/collections/media/create')
  await page.locator('input[type="file"]').setInputFiles(path.resolve('../website/public/social/article-default.jpg'))
  await page.locator('#field-alt').fill('An editorial card used to test image uploads')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page).toHaveURL(/media\/\d+/)
  const imageURL = await page.getByAltText('article-default.jpg', { exact: true }).getAttribute('src')
  if (!imageURL) throw new Error('The uploaded image did not render.')
  const media = await api.get(imageURL, { headers: apiHeaders })
  expect(media.status()).toBe(200)
  expect(media.headers()['cache-control']).toBe('private, no-store')
  expect((await anonymous.get(imageURL)).status()).toBe(403)
  const partial = await api.get(imageURL, { headers: { ...apiHeaders, Range: 'bytes=0-99' } })
  expect(partial.status()).toBe(206)
  expect(partial.headers()['cache-control']).toBe('private, no-store')
  return imageURL
}

async function insertImage(page: Page, id: string) {
  await page.goto(`/admin/collections/entries/${id}`)
  const editor = page.locator('[contenteditable="true"]')
  await editor.click()
  await editor.press('ControlOrMeta+End')
  await editor.press('Enter')
  await editor.pressSequentially('/upload')
  await page.getByText('Upload', { exact: true }).click()
  await page.getByText('article-default.jpg', { exact: true }).click()
  await expect(editor.locator('img')).toBeVisible()
  const save = page.waitForResponse(response => response.request().method() === 'PATCH' && response.url().includes(`/api/entries/${id}`))
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click()
  expect((await save).ok()).toBe(true)
}

async function checkPrivacy(request: APIRequestContext, id: string) {
  const preview = await request.get(`${previewOrigin}/cms-preview/${id}`)
  expect(preview.status()).toBe(401)
  expect(preview.headers()['cache-control']).toBe('private, no-store')
  expect(preview.headers()['x-robots-tag']).toContain('noindex')
  expect((await request.get(`/api/entries/${id}?draft=true`)).status()).toBe(403)
  expect((await request.get('/api/entries/versions')).status()).toBe(403)
  expect((await request.post('/api/users/first-register', { data: { email: 'second@example.invalid', password: randomBytes(24).toString('hex') } })).ok()).toBe(false)
  for (const file of ['.local/secret', '.local/test/cms.db', '.local/test/uploads/article-default.jpg']) {
    expect((await request.get(`${previewOrigin}/@fs/${path.resolve(file)}`)).status()).toBe(403)
  }
  const optimizedImage = await request.get(`${previewOrigin}/_image`, {
    params: { href: `/@fs/${path.resolve('.local/test/uploads/article-default.jpg')}`, w: '100', f: 'webp' },
  })
  expect(optimizedImage.ok()).toBe(false)
  expect(optimizedImage.headers()['content-type']).not.toContain('image/')
}

async function checkUnpublish(api: APIRequestContext, id: string) {
  const response = await api.patch(`/api/entries/${id}`, { headers: apiHeaders, data: { _status: 'draft' } })
  expect(response.ok()).toBe(true)
  const published = await api.get(`/api/entries/${id}/preview?revision=published`, { headers: apiHeaders })
  expect(published.status()).toBe(404)
  expect(published.headers()['cache-control']).toBe('private, no-store')
}

interface LogoutContext { page: Page; preview: Page; api: APIRequestContext; imageURL: string; password: string }

async function checkLogout({ page, preview, api, imageURL, password }: LogoutContext) {
  expect((await api.post('/api/users/logout', { headers: apiHeaders })).ok()).toBe(true)
  await preview.reload()
  await expect(preview.getByRole('heading', { name: 'Sign in to preview' })).toBeVisible()
  expect((await api.get(imageURL)).status()).toBe(403)
  await page.goto('/admin/login')
  await page.locator('#field-email').fill('preview-test@example.invalid')
  await page.locator('#field-password').fill(password)
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Notes', exact: true }).first()).toBeVisible()
  await preview.reload()
  await expect(preview.locator('.content')).toContainText(draftRevision)
}

async function checkIncompleteDraft(api: APIRequestContext, preview: Page) {
  const created = await api.post('/api/entries?draft=true', { headers: apiHeaders, data: { title: 'An unfinished note' } })
  expect(created.ok()).toBe(true)
  const result = await created.json() as { doc: { id: number } }
  const response = await preview.goto(`${previewOrigin}/cms-preview/${String(result.doc.id)}`)
  expect(response?.status()).toBe(422)
  expect(response?.headers()['cache-control']).toBe('private, no-store')
  await expect(preview.getByRole('heading', { name: 'Finish this draft to preview' })).toBeVisible()
}

async function checkMobile(desktop: BrowserContext, id: string) {
  const browser = await webkit.launch()
  try {
    const context = await browser.newContext({
      storageState: await desktop.storageState(),
      ignoreHTTPSErrors: Boolean(process.env.CMS_TRIAL_HOST),
      viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    })
    const page = await context.newPage()
    await page.goto(`${cmsOrigin}/admin/collections/entries/${id}`)
    await expect(page.locator('#field-title')).toBeVisible()
    await expect(page.locator('#field-title')).toBeEditable()
    const editorImage = page.locator('[contenteditable="true"] img')
    await expect(editorImage).toBeVisible()
    await expect.poll(() => editorImage.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0)
    await page.locator('#field-title').focus()
    expect(await page.locator('#field-title').evaluate(element => parseFloat(getComputedStyle(element).fontSize))).toBeGreaterThanOrEqual(16)
    expect(await page.evaluate(() => window.visualViewport?.scale)).toBe(1)
    await page.screenshot({ path: test.info().outputPath('editor-mobile-webkit.png'), fullPage: true })
    expect(await editorImage.evaluate(element => element.getBoundingClientRect().right <= innerWidth)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.goto(`${previewOrigin}/cms-preview/${id}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('A private publishing trial')
    await expect(page.locator('.content img')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: test.info().outputPath('article-mobile-webkit.png'), fullPage: true })
  } finally {
    await browser.close()
  }
}
