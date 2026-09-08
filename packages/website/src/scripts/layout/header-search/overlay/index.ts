import { getFocusWrapTarget } from '../index'
import type { HeaderSearchElements } from '../model'

function setBackgroundInert(open: boolean) {
  const background = document.querySelectorAll<HTMLElement>(
    '.skip-link, main, .footer-shell, .brand, .site-nav, .header-actions > :not([data-header-search])',
  )
  background.forEach((element) => { element.inert = open })
  document.documentElement.dataset.searchOverlayOpen = String(open)
}

function restoreSearchFocus(elements: HeaderSearchElements) {
  const target = window.matchMedia('(max-width: 920px)').matches
    ? elements.trigger
    : elements.desktopLink
  target.focus({ preventScroll: true })
}

export function setSearchOpen(
  elements: HeaderSearchElements,
  open: boolean,
  restoreFocus = true,
) {
  const { form, input, trigger } = elements

  form.dataset.open = String(open)
  form.setAttribute('aria-hidden', String(!open))
  trigger.setAttribute('aria-expanded', String(open))
  setBackgroundInert(open)

  if (open) {
    form.removeAttribute('inert')
    requestAnimationFrame(() => {
      if (form.dataset.open === 'true') input.focus({ preventScroll: true })
    })
    return
  }

  const activeElement = document.activeElement
  input.setAttribute('aria-expanded', 'false')
  input.removeAttribute('aria-activedescendant')
  if (activeElement instanceof HTMLElement && form.contains(activeElement)) activeElement.blur()
  form.setAttribute('inert', '')
  if (restoreFocus) restoreSearchFocus(elements)
}

function getOverlayFocusableElements(form: HTMLFormElement) {
  return Array.from(form.querySelectorAll<HTMLElement>(
    'a[href]:not([hidden]), button:not([disabled]):not([hidden]), input:not([disabled]):not([hidden]), [tabindex]:not([tabindex="-1"])',
  ))
}

function containOverlayFocus(event: KeyboardEvent, form: HTMLFormElement) {
  const focusable = getOverlayFocusableElements(form)
  const activeIndex = focusable.indexOf(document.activeElement as HTMLElement)
  const targetIndex = getFocusWrapTarget(activeIndex, focusable.length, event.shiftKey)
  if (targetIndex === undefined) return
  event.preventDefault()
  focusable[targetIndex]?.focus({ preventScroll: true })
}

export function handleOverlayKeydown(
  event: KeyboardEvent,
  elements: HeaderSearchElements,
) {
  if (event.key === 'Tab') {
    containOverlayFocus(event, elements.form)
    return
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    setSearchOpen(elements, false)
  }
}
