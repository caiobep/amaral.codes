import type { HeaderSearchElements } from './model'

const DESKTOP_SHORTCUT_MEDIA = '(min-width: 921px) and (hover: hover) and (pointer: fine)'

function isEditableTarget(target: EventTarget | null) {
  return target instanceof Element
    && target.closest('input, textarea, select, [contenteditable="true"]') !== null
}

function hasSearchShortcutModifier(event: KeyboardEvent) {
  return (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey
}

function hasSearchShortcutKey(event: KeyboardEvent) {
  const key = event.key.toLowerCase()
  return key === 'k' || key === 'p'
}

function isDesktopSearchShortcut(event: KeyboardEvent) {
  return window.matchMedia(DESKTOP_SHORTCUT_MEDIA).matches
    && !event.repeat
    && hasSearchShortcutKey(event)
    && hasSearchShortcutModifier(event)
}

function focusDesktopSearch() {
  document.querySelector<HTMLInputElement>('[data-search-input]')
    ?.focus({ preventScroll: true })
}

export function handleDesktopSearchShortcut(
  event: KeyboardEvent,
  elements: HeaderSearchElements,
) {
  if (!isDesktopSearchShortcut(event) || isEditableTarget(event.target)) return

  event.preventDefault()
  if (window.location.pathname.startsWith('/search')) {
    focusDesktopSearch()
    return
  }
  elements.desktopLink.click()
}
