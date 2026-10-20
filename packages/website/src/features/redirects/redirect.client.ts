import {
  getDeeplinkOrShortcutRedirect,
  getDeeplinkRedirect,
  getShortcutRedirect,
} from '../../lib/redirects'

type RedirectMode = 'deeplink-or-shortcut' | 'deeplink' | 'shortcut'

const getTarget = (mode: RedirectMode, searchParams: URLSearchParams, origin: string) => {
  switch (mode) {
    case 'deeplink-or-shortcut': return getDeeplinkOrShortcutRedirect(searchParams, origin)
    case 'deeplink': return getDeeplinkRedirect(searchParams, origin)
    case 'shortcut': return getShortcutRedirect(searchParams)
  }
}

export const initializeRedirect = () => {
  const searchParams = new URLSearchParams(window.location.search)
  const target = getTarget(document.body.dataset.redirectMode as RedirectMode, searchParams, window.location.origin)
  if (target) {
    window.location.assign(target)
  } else {
    document.title = 'Invalid link'
    document.body.dataset.redirectState = 'invalid'
    document.querySelector('[data-redirect-status]')?.replaceChildren('This link is invalid.')
    document.querySelector('[data-redirect-detail]')?.removeAttribute('hidden')
  }
}
