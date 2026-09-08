import { getQueryParameter } from '../query-parameters'

const SHORTCUT_PROTOCOL = 'shortcuts:'
const SHORTCUT_HOST = 'run-shortcut'
const WEB_PROTOCOLS = new Set(['http:', 'https:'])

const hasCredentials = (url: URL) => url.username !== '' || url.password !== ''
const isSameOriginWebUrl = (url: URL, currentOrigin: string) => (
  WEB_PROTOCOLS.has(url.protocol) && url.origin === currentOrigin
)
const isShortcutUrl = (url: URL) => (
  url.protocol === SHORTCUT_PROTOCOL && url.hostname === SHORTCUT_HOST
)

const parseUrl = (value: string, currentOrigin: string) => {
  try {
    return new URL(value, currentOrigin)
  } catch {
    return null
  }
}

export const createShortcutRedirect = (name: string) => {
  const shortcutUrl = new URL(`${SHORTCUT_PROTOCOL}//${SHORTCUT_HOST}`)
  shortcutUrl.searchParams.set('name', name)
  return shortcutUrl.href
}

export const getSafeRedirect = (value: string | null, currentOrigin: string) => {
  if (!value) return null
  const target = parseUrl(value, currentOrigin)
  if (!target || hasCredentials(target)) return null
  return isSameOriginWebUrl(target, currentOrigin) || isShortcutUrl(target) ? target.href : null
}

export const getDeeplinkRedirect = (
  searchParams: URLSearchParams,
  currentOrigin: string,
) => getSafeRedirect(getQueryParameter(searchParams, 'url'), currentOrigin)

export const getShortcutRedirect = (searchParams: URLSearchParams) => {
  const name = getQueryParameter(searchParams, 'name')
  return name ? createShortcutRedirect(name) : null
}

export const getDeeplinkOrShortcutRedirect = (
  searchParams: URLSearchParams,
  currentOrigin: string,
) => {
  const deeplink = getDeeplinkRedirect(searchParams, currentOrigin)
  if (deeplink) return deeplink

  const shortcut = getQueryParameter(searchParams, 'shortcut')
  return shortcut ? createShortcutRedirect(shortcut) : null
}
