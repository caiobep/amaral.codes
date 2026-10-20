// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GlobalWorkerOptions } from 'pdfjs-dist'
import { initializeTalkMaterialPreviews } from './material-preview.client'

const { getDocument } = vi.hoisted(() => ({
  getDocument: vi.fn<(options: { url: string }) => { promise: Promise<unknown>; destroy: () => Promise<void> }>(),
}))

vi.mock('pdfjs-dist', () => ({
  getDocument,
  GlobalWorkerOptions: { workerSrc: '' },
}))

class PreviewResizeObserver {
  static instances: PreviewResizeObserver[] = []
  observe = vi.fn()
  disconnect = vi.fn()
  unobserve = vi.fn()
  constructor(private readonly callback: ResizeObserverCallback) {
    PreviewResizeObserver.instances.push(this)
  }
  notify() { this.callback([], this) }
}

const context = {} as CanvasRenderingContext2D
const render = vi.fn(() => ({ promise: Promise.resolve(), cancel: vi.fn() }))
const pdfPage = {
  getViewport: vi.fn(({ scale }: { scale: number }) => ({ width: 640 * scale, height: 480 * scale })),
  render,
}
const pdf = { numPages: 2, getPage: vi.fn<(number: number) => Promise<typeof pdfPage>>().mockResolvedValue(pdfPage) }

function required<T>(element: T | null): T {
  if (!element) throw new Error('Missing fixture element')
  return element
}

function mount(poster = true) {
  document.body.innerHTML = `<section data-talk-material-preview data-pdf-url="/slides.pdf">
    ${poster ? '<img data-preview-poster>' : ''}
    <div data-preview-frame-container tabindex="0" hidden>
      <canvas data-preview-canvas hidden></canvas>
      <div data-preview-loading><span data-preview-spinner></span><span data-preview-status></span></div>
    </div>
    <div data-preview-navigation hidden>
      <button data-preview-previous></button><span data-preview-page></span>
      <span data-preview-total></span><button data-preview-next></button>
    </div>
    <button data-preview-toggle aria-expanded="false"><span data-preview-toggle-label></span></button>
  </section>`
  const root = required(document.querySelector<HTMLElement>('section'))
  const element = (name: string) => required(root.querySelector<HTMLElement>(`[data-preview-${name}]`))
  let width = 737
  let height = 553
  Object.defineProperties(element('frame-container'), {
    clientWidth: { get: () => width },
    clientHeight: { get: () => height },
  })
  return {
    root, element,
    canvas: required(root.querySelector('canvas')),
    click: (name = 'toggle') => element(name).click(),
    key: (key: string) => element('frame-container').dispatchEvent(new KeyboardEvent('keydown', { key })),
    resize: (nextWidth: number, nextHeight = nextWidth * 3 / 4) => {
      width = nextWidth
      height = nextHeight
      PreviewResizeObserver.instances.forEach(observer => observer.notify())
    },
  }
}

async function settle() {
  await vi.dynamicImportSettled()
}

function holdRender() {
  const pending = Promise.withResolvers<undefined>()
  const task = { promise: pending.promise, cancel: vi.fn() }
  render.mockReturnValueOnce(task)
  return { ...pending, task }
}

function holdLoad() {
  const pending = Promise.withResolvers<typeof pdf>()
  const task = { promise: pending.promise, destroy: vi.fn<() => Promise<void>>().mockResolvedValue(undefined) }
  getDocument.mockReturnValueOnce(task)
  return { ...pending, task }
}

beforeEach(() => {
  vi.clearAllMocks()
  PreviewResizeObserver.instances = []
  vi.stubGlobal('ResizeObserver', PreviewResizeObserver)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 })
  pdf.getPage.mockResolvedValue(pdfPage)
  render.mockReturnValue({ promise: Promise.resolve(), cancel: vi.fn() })
  getDocument.mockReturnValue({ promise: Promise.resolve(pdf), destroy: vi.fn().mockResolvedValue(undefined) })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('preview initialization and navigation', () => {
  it('loads on demand, initializes once, and renders accessible page controls', async () => {
    const pending = holdLoad()
    const view = mount()
    initializeTalkMaterialPreviews()
    initializeTalkMaterialPreviews()
    expect(getDocument).not.toHaveBeenCalled()
    view.click()
    pending.resolve(pdf)
    await settle()
    expect(getDocument).toHaveBeenCalledExactlyOnceWith({ url: '/slides.pdf' })
    expect(pending.task.destroy).not.toHaveBeenCalled()
    expect(GlobalWorkerOptions.workerSrc).toContain('pdf.worker.min.mjs')
    expect(view.element('toggle').getAttribute('aria-expanded')).toBe('true')
    expect(view.element('toggle-label').textContent).toBe('Hide preview')
    expect(document.activeElement).toBe(view.element('frame-container'))
    expect(view.canvas.getAttribute('aria-label')).toBe('Slide 1 of 2')
    expect(view.element('page').textContent).toBe('1')
    expect(view.element('total').textContent).toBe('2')
    expect(view.element('previous')).toHaveProperty('disabled', true)
    expect(view.element('next')).toHaveProperty('disabled', false)
    expect(view.element('poster').hidden).toBe(true)
  })

  it.each(['url', 'canvas'])('ignores incomplete markup: missing %s', (missing) => {
    const view = mount()
    if (missing === 'url') delete view.root.dataset.pdfUrl
    else view.canvas.remove()
    initializeTalkMaterialPreviews()
    view.click()
    expect(view.root.dataset.previewReady).toBeUndefined()
    expect(getDocument).not.toHaveBeenCalled()
  })

  it('supports previews without posters and bounds button and keyboard navigation', async () => {
    const view = mount(false)
    initializeTalkMaterialPreviews()
    view.click('next')
    view.key('ArrowLeft')
    view.click()
    await settle()
    view.key('Escape')
    view.key('ArrowLeft')
    view.click('next')
    await settle()
    expect(view.canvas.getAttribute('aria-label')).toBe('Slide 2 of 2')
    expect(view.element('next')).toHaveProperty('disabled', true)
    view.key('ArrowRight')
    view.click('previous')
    await settle()
    view.key('ArrowRight')
    await settle()
    view.key('ArrowLeft')
    await settle()
    expect(pdf.getPage.mock.calls.map(([number]) => number)).toEqual([1, 2, 1, 2, 1])
  })
})

describe('preview sizing', () => {
  it('refits the current slide after a container-only resize', async () => {
    const view = mount()
    initializeTalkMaterialPreviews()
    view.click()
    await settle()
    expect(view.canvas.style.width).toBe('737px')
    view.resize(356)
    await settle()
    expect(view.canvas.style.width).toBe('356px')
    expect(view.canvas.width).toBe(356)
    expect(getDocument).toHaveBeenCalledTimes(1)
  })

  it.each([0, 1, 2, 3])('fits height-only changes and caps backing resolution at DPR %s', async (ratio) => {
    Object.defineProperty(window, 'devicePixelRatio', { value: ratio })
    const view = mount()
    initializeTalkMaterialPreviews()
    view.click()
    await settle()
    view.resize(737, 240)
    await settle()
    expect(view.canvas.style.width).toBe('320px')
    expect(view.canvas.style.height).toBe('240px')
    expect(view.canvas.width).toBe(320 * Math.min(ratio || 1, 2))
    expect(view.canvas.height).toBe(240 * Math.min(ratio || 1, 2))
    expect(render).toHaveBeenLastCalledWith(expect.objectContaining({ canvas: view.canvas, canvasContext: context }))
  })

  it('ignores unchanged observer notifications and waits for a nonzero frame', async () => {
    const view = mount()
    view.resize(0, 0)
    initializeTalkMaterialPreviews()
    view.click()
    await settle()
    expect(render).not.toHaveBeenCalled()
    view.resize(640, 0)
    await settle()
    expect(render).not.toHaveBeenCalled()
    view.resize(640)
    await settle()
    view.resize(640)
    await settle()
    expect(render).toHaveBeenCalledTimes(1)
  })
})

describe('preview visibility', () => {
  it('hides every interactive surface and reopens the selected page at its new size', async () => {
    const view = mount()
    initializeTalkMaterialPreviews()
    view.click()
    await settle()
    view.click('next')
    await settle()
    view.click()
    expect(view.element('navigation').hidden).toBe(true)
    expect(view.element('frame-container').hidden).toBe(true)
    expect(view.canvas.hidden).toBe(true)
    expect(view.element('poster').hidden).toBe(false)
    expect(view.element('toggle-label').textContent).toBe('Preview slides')
    expect(PreviewResizeObserver.instances[0]?.disconnect).toHaveBeenCalled()
    view.resize(356)
    view.key('ArrowLeft')
    await settle()
    expect(render).toHaveBeenCalledTimes(2)
    view.click()
    await settle()
    expect(view.canvas.style.width).toBe('356px')
    expect(view.canvas.getAttribute('aria-label')).toBe('Slide 2 of 2')
    expect(view.element('navigation').hidden).toBe(false)
    expect(getDocument).toHaveBeenCalledTimes(1)
  })

  it('does not render or reveal a document loaded after closing', async () => {
    const pending = holdLoad()
    const view = mount()
    initializeTalkMaterialPreviews()
    view.click()
    await settle()
    view.click()
    pending.resolve(pdf)
    await settle()
    expect(render).not.toHaveBeenCalled()
    expect(view.element('navigation').hidden).toBe(true)
    expect(view.canvas.hidden).toBe(true)
    view.click()
    await settle()
    expect(view.canvas.hidden).toBe(false)
  })

  it('shares a pending load across hide, resize, and reopen', async () => {
    const pending = holdLoad()
    const view = mount()
    initializeTalkMaterialPreviews()
    view.click()
    await settle()
    view.click()
    view.resize(356)
    view.click()
    pending.resolve(pdf)
    await settle()
    expect(render).toHaveBeenCalledTimes(1)
    expect(view.canvas.style.width).toBe('356px')
    expect(getDocument).toHaveBeenCalledTimes(1)
  })
})

describe('preview async rendering', () => {
  it('discards page lookup work superseded by a resize', async () => {
    const pending = Promise.withResolvers<typeof pdfPage>()
    pdf.getPage.mockReturnValueOnce(pending.promise)
    const view = mount()
    initializeTalkMaterialPreviews()
    view.click()
    await settle()
    view.resize(356)
    pending.resolve(pdfPage)
    await settle()
    expect(render).toHaveBeenCalledTimes(1)
    expect(view.canvas.style.width).toBe('356px')
  })

  it('cancels and serializes renders, coalescing resize requests to the latest dimensions', async () => {
    const pending = holdRender()
    const view = mount()
    initializeTalkMaterialPreviews()
    view.click()
    await settle()
    view.click('next')
    view.key('ArrowRight')
    view.resize(500)
    view.resize(356)
    expect(pending.task.cancel).toHaveBeenCalled()
    expect(render).toHaveBeenCalledTimes(1)
    pending.reject(new Error('Rendering cancelled'))
    await settle()
    expect(render).toHaveBeenCalledTimes(2)
    expect(view.canvas.style.width).toBe('356px')
    expect(view.canvas.getAttribute('aria-label')).toBe('Slide 1 of 2')
    expect(console.error).not.toHaveBeenCalled()
  })

  it.each(['resolve', 'reject'] as const)('keeps a closed preview hidden after late render %s', async (result) => {
    const pending = holdRender()
    const view = mount()
    initializeTalkMaterialPreviews()
    view.click()
    await settle()
    view.click()
    if (result === 'resolve') pending.resolve(undefined)
    else pending.reject(new Error('Cancelled'))
    await settle()
    expect(view.canvas.hidden).toBe(true)
    expect(view.element('navigation').hidden).toBe(true)
    expect(console.error).not.toHaveBeenCalled()
  })

  it('reopens after cancellation without overlapping canvas renders', async () => {
    const pending = holdRender()
    const view = mount()
    initializeTalkMaterialPreviews()
    view.click()
    await settle()
    view.click()
    view.resize(356)
    view.click()
    expect(render).toHaveBeenCalledTimes(1)
    pending.resolve(undefined)
    await settle()
    expect(render).toHaveBeenCalledTimes(2)
    expect(view.canvas.style.width).toBe('356px')
    expect(view.element('navigation').hidden).toBe(false)
  })
})

describe('preview failures', () => {
  it('destroys a failed load and retries only on explicit reopen, never resize', async () => {
    const pending = holdLoad()
    const view = mount()
    initializeTalkMaterialPreviews()
    view.click()
    await settle()
    pending.reject(new Error('Network unavailable'))
    await settle()
    expect(view.element('status').textContent).toBe('Preview unavailable. Open the PDF instead.')
    expect(view.element('spinner').hidden).toBe(true)
    expect(view.element('navigation').hidden).toBe(true)
    expect(pending.task.destroy).toHaveBeenCalledTimes(1)
    view.resize(356)
    await settle()
    expect(getDocument).toHaveBeenCalledTimes(1)
    expect(view.element('spinner').hidden).toBe(true)
    expect(view.element('status').textContent).toBe('Preview unavailable. Open the PDF instead.')
    view.click()
    view.click()
    await settle()
    expect(getDocument).toHaveBeenCalledTimes(2)
    expect(view.canvas.hidden).toBe(false)
  })

  it.each(['context', 'page', 'render'])('reports a current %s failure without revealing navigation', async (failure) => {
    const view = mount()
    if (failure === 'context') vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    if (failure === 'page') pdf.getPage.mockRejectedValueOnce(new Error('Page unavailable'))
    const pending = failure === 'render' ? holdRender() : undefined
    initializeTalkMaterialPreviews()
    view.click()
    await settle()
    pending?.reject(new Error('Render failed'))
    await settle()
    expect(view.element('status').textContent).toBe('Preview unavailable. Open the PDF instead.')
    expect(view.element('spinner').hidden).toBe(true)
    expect(view.canvas.hidden).toBe(true)
    expect(view.element('navigation').hidden).toBe(true)
    expect(console.error).toHaveBeenCalledTimes(1)
    view.resize(356)
    await settle()
    expect(pdf.getPage).toHaveBeenCalledTimes(1)
    expect(view.element('spinner').hidden).toBe(true)
  })

  it('ignores a load failure after hide and can load on the next open', async () => {
    const pending = holdLoad()
    const view = mount()
    initializeTalkMaterialPreviews()
    view.click()
    await settle()
    view.click()
    pending.reject(new Error('Late failure'))
    await settle()
    expect(pending.task.destroy).toHaveBeenCalledTimes(1)
    expect(console.error).not.toHaveBeenCalled()
    expect(view.element('navigation').hidden).toBe(true)
    view.click()
    await settle()
    expect(view.canvas.hidden).toBe(false)
  })
})

describe('preview loading task ownership', () => {
  it('destroys each failed task across repeated explicit opens', async () => {
    const view = mount()
    initializeTalkMaterialPreviews()
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const pending = holdLoad()
      view.click()
      await settle()
      pending.reject(new Error('PDF unavailable'))
      await settle()
      expect(pending.task.destroy).toHaveBeenCalledTimes(1)
      expect(getDocument).toHaveBeenCalledTimes(attempt + 1)
      view.click()
    }
  })

  it('waits for failed-task destruction before starting an explicitly reopened load', async () => {
    const pending = holdLoad()
    const cleanup = Promise.withResolvers<undefined>()
    pending.task.destroy.mockReturnValue(cleanup.promise)
    const view = mount()
    initializeTalkMaterialPreviews()
    view.click()
    await settle()
    pending.reject(new Error('PDF unavailable'))
    await settle()
    expect(pending.task.destroy).toHaveBeenCalledTimes(1)
    view.click()
    view.click()
    await settle()
    expect(getDocument).toHaveBeenCalledTimes(1)
    cleanup.resolve(undefined)
    await settle()
    expect(getDocument).toHaveBeenCalledTimes(2)
    expect(view.canvas.hidden).toBe(false)
    expect(console.error).not.toHaveBeenCalled()
  })
})
