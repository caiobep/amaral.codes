import { describe, expect, it, vi } from 'vitest'
import { connectLivePreview } from './index'

vi.mock('@payloadcms/live-preview', async (importOriginal) => ({
  ...await importOriginal<typeof import('@payloadcms/live-preview')>(),
  ready: vi.fn(),
}))

function previewWindow(search = '') {
  const events = new EventTarget()
  const parent = {} as Window
  const target = Object.assign(events, { parent, opener: null, location: { search } }) as unknown as Window
  return { target, parent }
}

function savedEvent(source: Window, origin = 'http://127.0.0.1:4010', type = 'payload-document-event') {
  const event = new MessageEvent('message', { origin, data: { type } })
  Object.defineProperty(event, 'source', { value: source })
  return event
}

describe('saved-draft live preview', () => {
  it('refreshes only for document saves from the editor window and origin', () => {
    const { target, parent } = previewWindow()
    const refresh = vi.fn()
    const disconnect = connectLivePreview(target, refresh)
    target.dispatchEvent(savedEvent(parent, 'https://other.example'))
    target.dispatchEvent(savedEvent({} as Window))
    target.dispatchEvent(savedEvent(parent, undefined, 'payload-live-preview'))
    expect(refresh).not.toHaveBeenCalled()
    target.dispatchEvent(savedEvent(parent))
    expect(refresh).toHaveBeenCalledOnce()
    disconnect()
    target.dispatchEvent(savedEvent(parent))
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('keeps a published revision stable while its draft changes', () => {
    const { target, parent } = previewWindow('?revision=published')
    const refresh = vi.fn()
    connectLivePreview(target, refresh)()
    target.dispatchEvent(savedEvent(parent))
    expect(refresh).not.toHaveBeenCalled()
  })

  it('does not subscribe when opened independently', () => {
    const { target } = previewWindow()
    Object.defineProperty(target, 'parent', { value: target })
    const refresh = vi.fn()
    connectLivePreview(target, refresh)()
    target.dispatchEvent(savedEvent(target))
    expect(refresh).not.toHaveBeenCalled()
  })

  it('also supports the separate preview window opened by the editor', () => {
    const { target, parent } = previewWindow()
    Object.assign(target, { opener: parent, parent: target })
    const refresh = vi.fn()
    connectLivePreview(target, refresh)
    target.dispatchEvent(savedEvent(parent))
    expect(refresh).toHaveBeenCalledOnce()
  })
})
