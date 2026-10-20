// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { initializeRedirect } from './redirect.client'

afterEach(() => vi.restoreAllMocks())

describe('redirect page runtime', () => {
  it.each([
    ['deeplink-or-shortcut', '?url=/about&shortcut=Capture', 'https://amaral.codes/about'],
    ['deeplink-or-shortcut', '?s=Capture', 'shortcuts://run-shortcut?name=Capture'],
    ['deeplink', '?l=/projects', 'https://amaral.codes/projects'],
    ['shortcut', '?a=Capture', 'shortcuts://run-shortcut?name=Capture'],
  ])('resolves the %s route policy', (mode, query, expected) => {
    window.location.href = `https://amaral.codes/deeplink${query}`
    document.body.dataset.redirectMode = mode
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => undefined)

    initializeRedirect()

    expect(assign).toHaveBeenCalledWith(expected)
  })

  it.each([
    ['deeplink-or-shortcut', '?url=javascript:alert(1)'],
    ['deeplink', '?url=https://example.com&shortcut=Capture'],
    ['shortcut', ''],
  ])('shows the invalid state for a rejected %s destination', (mode, query) => {
    window.location.href = `https://amaral.codes/deeplink${query}`
    document.title = 'Redirecting...'
    document.body.dataset.redirectMode = mode
    document.body.dataset.redirectState = 'redirecting'
    document.body.innerHTML = '<h1 data-redirect-status>Redirecting...</h1><p data-redirect-detail hidden>Invalid destination</p>'
    const assign = vi.spyOn(window.location, 'assign').mockImplementation(() => undefined)

    initializeRedirect()

    expect(assign).not.toHaveBeenCalled()
    expect(document.title).toBe('Invalid link')
    expect(document.body.dataset.redirectState).toBe('invalid')
    expect(document.querySelector('[data-redirect-status]')?.textContent).toBe('This link is invalid.')
    expect(document.querySelector('[data-redirect-detail]')?.hasAttribute('hidden')).toBe(false)
  })
})
