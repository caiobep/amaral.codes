interface TouchOrigin { x: number, y: number }
type SpatialDocument = Document & { immersiveEnabled?: boolean }

const shouldManageTouchFocus = () => {
  const spatialDocument = document as SpatialDocument
  return window.matchMedia('(hover: none) and (pointer: coarse)').matches && !spatialDocument.immersiveEnabled
}

export const initializeTouchFocus = () => {
  const root = document.documentElement
  if (!shouldManageTouchFocus() || root.dataset.touchFocus === 'ready') return

  let touchOrigin: TouchOrigin | undefined
  root.dataset.touchFocus = 'ready'

  document.addEventListener('touchstart', (event) => {
    const touch = event.touches[0]
    if (!touch) return
    touchOrigin = { x: touch.clientX, y: touch.clientY }
  }, { passive: true })

  document.addEventListener('touchmove', (event) => {
    const touch = event.touches[0]
    if (!touch || !touchOrigin) return
    const distance = Math.hypot(touch.clientX - touchOrigin.x, touch.clientY - touchOrigin.y)
    if (distance < 8) return

    const activeElement = document.activeElement
    if (activeElement instanceof HTMLElement && activeElement.matches('a, button, [tabindex]')) {
      activeElement.blur()
    }
  }, { passive: true })

  const clearTouchOrigin = () => { touchOrigin = undefined }
  document.addEventListener('touchend', clearTouchOrigin, { passive: true })
  document.addEventListener('touchcancel', clearTouchOrigin, { passive: true })
}
