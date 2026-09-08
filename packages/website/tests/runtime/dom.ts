import { Window } from 'happy-dom'
import { vi } from 'vitest'

export function mount(markup = '', url = 'http://localhost/') {
  const browser = new Window({ url })
  const globals = {
    window: browser,
    document: browser.document,
    navigator: browser.navigator,
    localStorage: browser.localStorage,
    sessionStorage: browser.sessionStorage,
    HTMLElement: browser.HTMLElement,
    HTMLAnchorElement: browser.HTMLAnchorElement,
    HTMLInputElement: browser.HTMLInputElement,
    HTMLButtonElement: browser.HTMLButtonElement,
    HTMLFormElement: browser.HTMLFormElement,
    HTMLOListElement: browser.HTMLOListElement,
    Element: browser.Element,
    Node: browser.Node,
    Event: browser.Event,
    KeyboardEvent: browser.KeyboardEvent,
    PointerEvent: browser.PointerEvent,
    TouchEvent: browser.TouchEvent,
    Touch: browser.Touch,
    DOMRect: browser.DOMRect,
    getComputedStyle: browser.getComputedStyle.bind(browser),
    requestAnimationFrame: browser.requestAnimationFrame.bind(browser),
    cancelAnimationFrame: browser.cancelAnimationFrame.bind(browser),
  }
  Object.entries(globals).forEach(([key, value]) => vi.stubGlobal(key, value))
  document.body.innerHTML = markup
  document.addEventListener('click', event => event.preventDefault())
  return browser
}

export function element<T extends HTMLElement>(selector: string, type: new() => T): T
export function element(selector: string): HTMLElement
export function element(selector: string, type: typeof HTMLElement = HTMLElement) {
  const result = document.querySelector(selector)
  if (!(result instanceof type)) throw new Error(`Missing test element: ${selector}`)
  return result
}

export function input(selector: string, value: string) {
  const field = element(selector, HTMLInputElement)
  field.value = value
  field.dispatchEvent(new Event('input', { bubbles: true }))
}
