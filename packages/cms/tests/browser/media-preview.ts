import { readFile } from 'node:fs/promises'
import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test'
import { createTwoPagePdf } from '../../../website/tests/browser/fixtures/two-page-pdf'
import type { Entry } from '../../src/payload-types'
import { cmsOrigin, previewOrigin } from './origins'

const headers = { Origin: cmsOrigin }

export async function checkMediaPreviews(
  page: Page, api: APIRequestContext, anonymous: APIRequestContext, sourceId: string,
) {
  const source = await api.get(`/api/entries/${sourceId}?draft=true&depth=0`, { headers })
  expect(source.ok()).toBe(true)
  const { body } = await source.json() as Entry
  const pdf = createTwoPagePdf()
  const mediaId = await uploadMedia(api,
    { name: 'private-two-page.pdf', mimeType: 'application/pdf', buffer: pdf },
    'Two colored slides for authenticated preview testing',
  )
  const talkId = await createDraft(api, {
    title: 'A private slide preview', slug: 'private-slide-preview', category: 'talk', body,
    talk: {
      format: 'talk', event: 'Preview test', recordingUrl: 'https://example.com/recording',
      materials: [{ label: 'Test slides', source: 'upload', file: mediaId }],
    },
  })
  await checkTalk(page, api, anonymous, { id: talkId, pdf })
  const audioId = await uploadMedia(api,
    { name: 'tone.mp3', mimeType: 'audio/mpeg', buffer: await readFile(new URL('./tone.mp3', import.meta.url)) },
    'A synthetic one-second tone for authenticated playback testing',
  )
  const podcastId = await createDraft(api, {
    title: 'A private podcast preview', slug: 'private-podcast-preview', category: 'podcast', body,
    podcast: {
      show: 'Preview podcast', episode: '1', sourceUrl: 'https://example.com/episode', audio: audioId,
      players: [
        { service: 'spotify', url: 'https://open.spotify.com/episode/example' },
        { service: 'overcast', url: 'https://overcast.fm/example' },
      ],
    },
  })
  await checkPodcast(page, api, anonymous, podcastId)
}

async function uploadMedia(api: APIRequestContext, file: { name: string; mimeType: string; buffer: Buffer }, alt: string) {
  const response = await api.post('/api/media', {
    headers,
    multipart: {
      _payload: JSON.stringify({ alt }),
      file,
    },
  })
  expect(response.ok()).toBe(true)
  const result = await response.json() as { doc: { id: number } }
  return result.doc.id
}

async function createDraft(api: APIRequestContext, data: Partial<Entry>) {
  const response = await api.post('/api/entries?draft=true', {
    headers, data: { ...data, date: '2026-09-01T12:00:00.000Z', language: 'en', _status: 'draft' },
  })
  expect(response.ok()).toBe(true)
  const result = await response.json() as { doc: { id: number } }
  return result.doc.id
}

async function openFormatPreview(page: Page, id: number, category: 'talk' | 'podcast') {
  await page.goto(`/admin/collections/entries/${String(id)}`)
  await expect(page.locator(`#field-${category}`)).toBeVisible()
  const other = category === 'talk' ? 'podcast' : 'talk'
  await expect(page.locator(`#field-${other}`)).toBeHidden()
  const previewEvent = page.waitForEvent('popup')
  await page.getByRole('link', { name: 'Preview', exact: true }).click()
  const preview = await previewEvent
  await expect(preview).toHaveURL(`${previewOrigin}/cms-preview/${String(id)}`)
  await expect(preview.getByText('Saved draft', { exact: true })).toBeVisible()
  return preview
}

async function checkTalk(
  page: Page, api: APIRequestContext, anonymous: APIRequestContext, { id, pdf }: { id: number; pdf: Buffer },
) {
  const preview = await openFormatPreview(page, id, 'talk')
  try {
    await expect(preview.getByRole('heading', { level: 1 })).toHaveText('A private slide preview')
    await expect(preview.getByRole('link', { name: 'Watch the recording' })).toHaveAttribute('href', 'https://example.com/recording')
    const viewer = preview.locator('[data-talk-material-preview]')
    const href = await viewer.getByRole('link', { name: 'Download PDF' }).getAttribute('href')
    if (!href) throw new Error('Missing uploaded PDF URL.')
    expect(href).toMatch(/^\/talks\/cms-preview\//)
    await checkPdfAccess(api, anonymous, new URL(href, previewOrigin).href, pdf)
    await expect(viewer.getByRole('link', { name: 'Open full screen' })).toHaveAttribute('href', href)
    const loaded = preview.waitForResponse(response => response.url() === new URL(href, previewOrigin).href)
    await viewer.getByRole('button', { name: 'Preview slides', exact: true }).click()
    expect((await loaded).status()).toBe(200)
    await expect(viewer.locator('[data-preview-total]')).toHaveText('2')
    await expectSlide(viewer, 'red')
    await expect(viewer.getByRole('button', { name: 'Previous slide' })).toBeDisabled()
    await viewer.getByRole('button', { name: 'Next slide' }).click()
    await expect(viewer.locator('[data-preview-page]')).toHaveText('2')
    await expectSlide(viewer, 'blue')
    await expect(viewer.getByRole('button', { name: 'Next slide' })).toBeDisabled()
    await viewer.screenshot({ path: test.info().outputPath('uploaded-pdf-second-slide.png') })
    await viewer.getByRole('button', { name: 'Hide preview' }).click()
    await expect(viewer.locator('[data-preview-canvas]')).toBeHidden()
    await viewer.getByRole('button', { name: 'Preview slides', exact: true }).click()
    await expectSlide(viewer, 'blue')
  } finally {
    await preview.close()
  }
}

async function checkPdfAccess(api: APIRequestContext, anonymous: APIRequestContext, url: string, pdf: Buffer) {
  const response = await api.get(url, { headers })
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toContain('application/pdf')
  expect(response.headers()['cache-control']).toBe('private, no-store')
  expect(await response.body()).toEqual(pdf)
  const range = await api.get(url, { headers: { ...headers, Range: 'bytes=0-31' } })
  expect(range.status()).toBe(206)
  expect(range.headers()['content-range']).toBe(`bytes 0-31/${String(pdf.length)}`)
  expect(range.headers()['cache-control']).toBe('private, no-store')
  expect(await range.body()).toEqual(pdf.subarray(0, 32))
  const denied = await anonymous.get(url)
  expect(denied.status()).toBe(403)
  expect(denied.headers()['cache-control']).toBe('private, no-store')
}

async function expectSlide(viewer: Locator, color: 'red' | 'blue') {
  const canvas = viewer.locator('[data-preview-canvas]')
  await expect(canvas).toBeVisible()
  await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement, expected) => {
    const context = element.getContext('2d')
    if (!context || element.width < 2 || element.height < 2) return false
    const [red, , blue, alpha] = context.getImageData(1, 1, 1, 1).data
    return alpha === 255 && (expected === 'red' ? red > blue : blue > red)
  }, color)).toBe(true)
}

async function checkPodcast(page: Page, api: APIRequestContext, anonymous: APIRequestContext, id: number) {
  const preview = await openFormatPreview(page, id, 'podcast')
  try {
    await expect(page.locator('#field-podcast__sourceUrl')).toHaveValue('https://example.com/episode')
    await expect(preview.getByRole('heading', { level: 1 })).toHaveText('A private podcast preview')
    const player = preview.getByRole('region', { name: 'Listen to this podcast episode' })
    await expect(player).toContainText('Preview podcast')
    await checkAudio(player.locator('audio'), api, anonymous)
    await expect(player.getByRole('link', { name: 'Episode notes' })).toHaveAttribute('href', 'https://example.com/episode')
    await expect(player.getByRole('link', { name: 'Listen on Spotify' })).toHaveAttribute('href', 'https://open.spotify.com/episode/example')
    await expect(player.getByRole('link', { name: 'Listen on Overcast' })).toHaveAttribute('href', 'https://overcast.fm/example')
    await expect(preview.locator('[data-talk-material-preview]')).toHaveCount(0)
    await player.screenshot({ path: test.info().outputPath('podcast-audio-preview.png') })
  } finally {
    await preview.close()
  }
}

async function checkAudio(audio: Locator, api: APIRequestContext, anonymous: APIRequestContext) {
  await expect(audio).toBeVisible()
  await expect(audio).toHaveAttribute('controls', '')
  const src = await audio.getAttribute('src')
  if (!src) throw new Error('Missing uploaded podcast audio URL.')
  expect(src).toMatch(/^\/podcasts\/cms-preview\//)
  const url = new URL(src, previewOrigin).href
  expect(await audio.evaluate((element: HTMLAudioElement) => new URL(element.currentSrc || element.src).origin)).toBe(previewOrigin)
  const response = await api.get(url, { headers })
  expect(response.status()).toBe(200)
  expect(response.headers()['content-type']).toContain('audio/mpeg')
  expect(response.headers()['cache-control']).toBe('private, no-store')
  expect(await response.body()).toEqual(await readFile(new URL('./tone.mp3', import.meta.url)))
  const denied = await anonymous.get(url)
  expect(denied.status()).toBe(403)
  expect(denied.headers()['cache-control']).toBe('private, no-store')
  const playback = await audio.evaluate(async (element: HTMLAudioElement) => {
    element.muted = true
    await element.play()
    return { paused: element.paused, duration: element.duration, error: element.error }
  })
  expect(playback.paused).toBe(false)
  expect(playback.duration).toBeGreaterThan(0)
  expect(playback.error).toBeNull()
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime)).toBeGreaterThan(0)
  await audio.evaluate((element: HTMLAudioElement) => { element.pause() })
  expect(await audio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(true)
}
