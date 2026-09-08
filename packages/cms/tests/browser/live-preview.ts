import { expect, test, type Page } from '@playwright/test'
import { cmsOrigin } from './origins'

export async function checkLivePreview(page: Page, original: string) {
  await page.getByRole('button', { name: 'Live Preview', exact: true }).click()
  const frame = page.frameLocator('#live-preview-iframe')
  await expect(frame.locator('.content')).toContainText(original)
  const changed = 'Autosave updates the real article without pressing Save.'
  await page.locator('[contenteditable="true"]').fill(changed)
  await expect(frame.locator('.content')).toContainText(changed, { timeout: 15000 })
  await page.getByRole('button', { name: 'Responsive', exact: true }).click()
  await page.getByRole('button', { name: 'Phone', exact: true }).click()
  await expect.poll(() => frame.locator('html').evaluate(() => innerWidth)).toBe(390)
  await page.screenshot({ path: test.info().outputPath('live-preview-desktop.png'), fullPage: true })
  await page.locator('[contenteditable="true"]').fill(original)
  await expect(frame.locator('.content')).toContainText(original)
  await page.getByRole('button', { name: 'Exit Live Preview', exact: true }).click()
}

export async function checkVersionRestore(page: Page, id: string, original: string) {
  const response = await page.request.get(`/api/entries/versions?where[parent][equals]=${id}&sort=createdAt&limit=30`, {
    headers: { Origin: cmsOrigin },
  })
  expect(response.status()).toBe(200)
  const { docs } = await response.json() as { docs: { id: number; version: { body: unknown } }[] }
  const version = docs.find(doc => JSON.stringify(doc.version.body).includes(original))
  if (!version) throw new Error('No saved original version found')
  await page.locator('[contenteditable="true"]').fill('An edit to restore through native version history.')
  await page.getByRole('button', { name: 'Save Draft', exact: true }).click()
  await page.goto(`/admin/collections/entries/${id}/versions/${String(version.id)}`)
  await page.getByRole('button', { name: 'Restore this version', exact: true }).click()
  await page.getByRole('button', { name: 'Confirm', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/entries/${id}$`))
  await expect(page.locator('[contenteditable="true"]')).toHaveText(original)
}
