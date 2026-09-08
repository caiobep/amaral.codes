import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist'

const ROOT_SELECTOR = '[data-talk-material-preview]'

interface PreviewElements {
  canvas: HTMLCanvasElement
  frameContainer: HTMLElement
  loading: HTMLElement
  navigation: HTMLElement
  next: HTMLButtonElement
  page: HTMLElement
  poster: HTMLElement | null
  previous: HTMLButtonElement
  spinner: HTMLElement
  status: HTMLElement
  toggle: HTMLButtonElement
  total: HTMLElement
  label: HTMLElement
}

interface PreviewState {
  currentPage: number
  elements: PreviewElements
  phase: 'closed' | 'loading' | 'ready' | 'error'
  isProcessing: boolean
  revision: number
  width: number
  height: number
  observer: ResizeObserver
  pdf?: PDFDocumentProxy
  pdfUrl: string
  renderTask?: RenderTask
}

function getPreviewElements(root: HTMLElement): PreviewElements | undefined {
  const requiredElements = {
    canvas: root.querySelector<HTMLCanvasElement>('[data-preview-canvas]'),
    frameContainer: root.querySelector<HTMLElement>('[data-preview-frame-container]'),
    loading: root.querySelector<HTMLElement>('[data-preview-loading]'),
    navigation: root.querySelector<HTMLElement>('[data-preview-navigation]'),
    next: root.querySelector<HTMLButtonElement>('[data-preview-next]'),
    page: root.querySelector<HTMLElement>('[data-preview-page]'),
    previous: root.querySelector<HTMLButtonElement>('[data-preview-previous]'),
    spinner: root.querySelector<HTMLElement>('[data-preview-spinner]'),
    status: root.querySelector<HTMLElement>('[data-preview-status]'),
    toggle: root.querySelector<HTMLButtonElement>('[data-preview-toggle]'),
    total: root.querySelector<HTMLElement>('[data-preview-total]'),
    label: root.querySelector<HTMLElement>('[data-preview-toggle-label]'),
  }
  const poster = root.querySelector<HTMLElement>('[data-preview-poster]')
  if (Object.values(requiredElements).some((element) => !element)) return
  return { ...requiredElements, poster } as PreviewElements
}

function updateNavigation(state: PreviewState) {
  const totalPages = state.pdf?.numPages ?? 0
  state.elements.page.textContent = String(state.currentPage)
  state.elements.total.textContent = totalPages ? String(totalPages) : '–'
  state.elements.previous.disabled = state.phase !== 'ready' || state.currentPage <= 1
  state.elements.next.disabled = state.phase !== 'ready' || state.currentPage >= totalPages
}

function updatePreview(state: PreviewState) {
  const { elements, phase } = state
  const isOpen = phase !== 'closed'
  elements.frameContainer.hidden = !isOpen
  if (elements.poster) elements.poster.hidden = isOpen
  elements.toggle.setAttribute('aria-expanded', String(isOpen))
  elements.label.textContent = isOpen ? 'Hide preview' : 'Preview slides'
  elements.canvas.hidden = phase !== 'ready'
  elements.navigation.hidden = phase !== 'ready'
  elements.loading.hidden = phase === 'closed' || phase === 'ready'
  elements.spinner.hidden = phase !== 'loading'
  elements.status.textContent = phase === 'error'
    ? 'Preview unavailable. Open the PDF instead.'
    : 'Loading slides...'
  updateNavigation(state)
}

async function loadPdf(state: PreviewState) {
  if (state.pdf) return state.pdf
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
  const loadingTask = pdfjs.getDocument({ url: state.pdfUrl })
  try {
    state.pdf = await loadingTask.promise
    return state.pdf
  } catch (error) {
    await loadingTask.destroy()
    throw error
  }
}

function getRenderScale(state: PreviewState, pageWidth: number, pageHeight: number) {
  const cssScale = Math.min(state.width / pageWidth, state.height / pageHeight)
  return {
    cssScale,
    pixelScale: cssScale * Math.min(window.devicePixelRatio || 1, 2),
  }
}

function renderCanvas(state: PreviewState, page: PDFPageProxy) {
  const baseViewport = page.getViewport({ scale: 1 })
  const { cssScale, pixelScale } = getRenderScale(state, baseViewport.width, baseViewport.height)
  const viewport = page.getViewport({ scale: pixelScale })
  const canvas = state.elements.canvas
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas is unavailable')
  canvas.width = Math.floor(viewport.width)
  canvas.height = Math.floor(viewport.height)
  canvas.style.width = `${String(Math.floor(baseViewport.width * cssScale))}px`
  canvas.style.height = `${String(Math.floor(baseViewport.height * cssScale))}px`
  return page.render({ canvas, canvasContext: context, viewport })
}

async function renderPage(state: PreviewState, revision: number) {
  try {
    const pdf = await loadPdf(state)
    if (state.revision !== revision) return
    const page = await pdf.getPage(state.currentPage)
    if (state.revision !== revision) return
    state.renderTask = renderCanvas(state, page)
    await state.renderTask.promise
    if (state.revision !== revision) return
    state.phase = 'ready'
    state.elements.canvas.setAttribute(
      'aria-label',
      `Slide ${String(state.currentPage)} of ${String(pdf.numPages)}`,
    )
    updatePreview(state)
  } catch (error) {
    if (state.revision !== revision) return
    console.error('Unable to render slide preview', error)
    state.phase = 'error'
    updatePreview(state)
  } finally {
    delete state.renderTask
  }
}

async function renderPending(state: PreviewState) {
  if (state.isProcessing) return
  state.isProcessing = true
  // One worker owns the canvas. Superseding requests wait for cancellation to settle.
  while (state.phase === 'loading' && state.width > 0 && state.height > 0) {
    await renderPage(state, state.revision)
  }
  state.isProcessing = false
}

function requestRender(state: PreviewState) {
  state.revision += 1
  state.phase = 'loading'
  state.renderTask?.cancel()
  state.width = state.elements.frameContainer.clientWidth
  state.height = state.elements.frameContainer.clientHeight
  updatePreview(state)
  void renderPending(state)
}

function resizePreview(state: PreviewState) {
  if (state.phase === 'closed' || state.phase === 'error') return
  const { clientWidth, clientHeight } = state.elements.frameContainer
  if (state.width === clientWidth && state.height === clientHeight) return
  requestRender(state)
}

function changePage(state: PreviewState, delta: number) {
  if (!state.pdf || state.phase !== 'ready') return
  const nextPage = Math.min(Math.max(state.currentPage + delta, 1), state.pdf.numPages)
  if (nextPage === state.currentPage) return
  state.currentPage = nextPage
  requestRender(state)
}

function setPreviewVisibility(state: PreviewState, isOpen: boolean) {
  state.revision += 1
  state.phase = isOpen ? 'loading' : 'closed'
  state.renderTask?.cancel()
  updatePreview(state)
  if (isOpen) {
    state.observer.observe(state.elements.frameContainer)
    requestRender(state)
    state.elements.frameContainer.focus({ preventScroll: true })
  } else {
    state.observer.disconnect()
  }
}

function bindNavigation(state: PreviewState) {
  state.elements.previous.addEventListener('click', () => changePage(state, -1))
  state.elements.next.addEventListener('click', () => changePage(state, 1))
  state.elements.frameContainer.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') changePage(state, -1)
    if (event.key === 'ArrowRight') changePage(state, 1)
  })
}

function initializePreview(root: HTMLElement) {
  if (root.dataset.previewReady === 'true') return
  const elements = getPreviewElements(root)
  const pdfUrl = root.dataset.pdfUrl
  if (!elements || !pdfUrl) return

  const state: PreviewState = {
    currentPage: 1,
    elements,
    phase: 'closed',
    isProcessing: false,
    revision: 0,
    width: 0,
    height: 0,
    observer: new ResizeObserver(() => resizePreview(state)),
    pdfUrl,
  }
  root.dataset.previewReady = 'true'
  elements.toggle.addEventListener('click', () => {
    setPreviewVisibility(state, state.phase === 'closed')
  })
  bindNavigation(state)
}

export function initializeTalkMaterialPreviews() {
  document.querySelectorAll<HTMLElement>(ROOT_SELECTOR).forEach(initializePreview)
}
