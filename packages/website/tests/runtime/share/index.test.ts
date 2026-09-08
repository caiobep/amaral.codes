import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { initializeShareControls } from '../../../src/scripts/share/runtime'
import { element, mount } from '../dom'

describe('share button runtime', () => {
  let browser: ReturnType<typeof mount>
  beforeEach(() => {
    browser = mount('<button data-share-button data-share-title="A note" data-share-text="Summary" data-share-url="https://amaral.codes/posts/example"><span data-share-label>Share</span></button>')
  })
  afterEach(async () => { await browser.happyDOM.close(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

  it('uses native sharing, disables concurrent clicks and resets feedback', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { share })
    const timers: (() => void)[] = []
    const setTimeout = globalThis.setTimeout
    vi.spyOn(window, 'setTimeout').mockImplementation(callback => { timers.push(callback); return setTimeout(() => undefined, 0) })
    initializeShareControls()
    initializeShareControls()
    const button = element('button', HTMLButtonElement)
    button.click()
    expect(button.disabled).toBe(true)
    await vi.waitFor(() => expect(button.disabled).toBe(false))
    expect(share).toHaveBeenCalledExactlyOnceWith({ title: 'A note', text: 'Summary', url: 'https://amaral.codes/posts/example' })
    expect(element('[data-share-label]').textContent).toBe('Shared')
    timers.forEach(timer => timer())
    expect(element('[data-share-label]').textContent).toBe('Share')
    expect(button.dataset.shareState).toBeUndefined()
  })

  it('copies with the clipboard API when native sharing is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const button = element('button', HTMLButtonElement)
    delete button.dataset.shareUrl
    delete button.dataset.shareTitle
    delete button.dataset.shareText
    initializeShareControls()
    button.click()
    await vi.waitFor(() => expect(button.dataset.shareState).toBe('copied'))
    expect(writeText).toHaveBeenCalledWith(window.location.href)
  })

  it('falls back to selected text, removes the temporary field and restores focus', async () => {
    vi.stubGlobal('navigator', {})
    const copy = vi.fn().mockReturnValue(true)
    Object.defineProperty(document, 'execCommand', { value: copy, configurable: true })
    initializeShareControls()
    const button = element('button', HTMLButtonElement)
    const previouslyFocused = document.createElement('input')
    document.body.append(previouslyFocused)
    previouslyFocused.focus()
    button.click()
    await vi.waitFor(() => expect(button.dataset.shareState).toBe('copied'))
    expect(copy).toHaveBeenCalledWith('copy')
    expect(document.querySelector('textarea')).toBeNull()
    expect(document.activeElement).toBe(previouslyFocused)
  })

  it('leaves cancellation quiet and displays failure only when copying also fails', async () => {
    const cancel = Object.assign(new Error('Cancelled'), { name: 'AbortError' })
    vi.stubGlobal('navigator', { share: vi.fn().mockRejectedValue(cancel) })
    initializeShareControls()
    element('button').click()
    await vi.waitFor(() => expect(element('button', HTMLButtonElement).disabled).toBe(false))
    expect(element('[data-share-label]').textContent).toBe('Share')
    vi.stubGlobal('navigator', {})
    Object.defineProperty(document, 'execCommand', { value: () => false, configurable: true })
    element('button').click()
    await vi.waitFor(() => expect(element('[data-share-label]').textContent).toBe('Copy failed'))
    document.body.innerHTML = '<button data-share-button>Unlabelled</button>'
    initializeShareControls()
    expect(element('button').dataset.shareReady).toBeUndefined()
  })
})
