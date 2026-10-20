import { describe, expect, it, vi } from 'vitest'
import { copyWithFallback, shareOrCopy } from './share'

const payload = {
  title: 'A page',
  text: 'A short description.',
  url: 'https://amaral.codes/posts/a-page',
}

describe('shareOrCopy', () => {
  it('uses native sharing when it is available', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const copy = vi.fn().mockResolvedValue(undefined)

    await expect(shareOrCopy(payload, { copy, share })).resolves.toBe('shared')
    expect(share).toHaveBeenCalledWith(payload)
    expect(copy).not.toHaveBeenCalled()
  })

  it('copies the canonical URL when native sharing is unavailable', async () => {
    const copy = vi.fn().mockResolvedValue(undefined)

    await expect(shareOrCopy(payload, { copy })).resolves.toBe('copied')
    expect(copy).toHaveBeenCalledWith(payload.url)
  })

  it('falls back to copying when native sharing fails', async () => {
    const share = vi.fn().mockRejectedValue(new Error('Not supported'))
    const copy = vi.fn().mockResolvedValue(undefined)

    await expect(shareOrCopy(payload, { copy, share })).resolves.toBe('copied')
  })

  it('does not copy after the user cancels native sharing', async () => {
    const cancellation = new Error('Cancelled')
    cancellation.name = 'AbortError'
    const share = vi.fn().mockRejectedValue(cancellation)
    const copy = vi.fn().mockResolvedValue(undefined)

    await expect(shareOrCopy(payload, { copy, share })).resolves.toBe('cancelled')
    expect(copy).not.toHaveBeenCalled()
  })

  it('reports failure when neither route can share the URL', async () => {
    const copy = vi.fn().mockRejectedValue(new Error('Blocked'))

    await expect(shareOrCopy(payload, { copy })).resolves.toBe('failed')
    await expect(shareOrCopy(payload, {})).resolves.toBe('failed')
  })
})

describe('copyWithFallback', () => {
  it('uses selection copying when the Clipboard API is unavailable', async () => {
    const legacyCopy = vi.fn().mockReturnValue(true)

    await expect(copyWithFallback(payload.url, { legacyCopy })).resolves.toBeUndefined()
    expect(legacyCopy).toHaveBeenCalledWith(payload.url)
  })

  it('uses selection copying when Clipboard API access is blocked', async () => {
    const clipboard = vi.fn().mockRejectedValue(new Error('Insecure context'))
    const legacyCopy = vi.fn().mockReturnValue(true)

    await expect(copyWithFallback(payload.url, { clipboard, legacyCopy })).resolves.toBeUndefined()
    expect(legacyCopy).toHaveBeenCalledWith(payload.url)
  })

  it('fails only when both copy routes fail', async () => {
    const clipboard = vi.fn().mockRejectedValue(new Error('Blocked'))
    const legacyCopy = vi.fn().mockReturnValue(false)

    await expect(copyWithFallback(payload.url, { clipboard, legacyCopy })).rejects.toThrow('Copy unavailable')
  })
})
