import { isDocumentEvent, ready } from '@payloadcms/live-preview'
import { CMS_ORIGIN } from '../cms-preview/origin'

export function connectLivePreview(target: Window, refresh: () => void) {
  const parent = (target.opener as Window | null) ?? target.parent
  if (parent === target || new URLSearchParams(target.location.search).get('revision') === 'published') return () => undefined

  const onMessage = (event: MessageEvent) => {
    if (event.source !== parent) return
    if (isDocumentEvent(event, CMS_ORIGIN)) refresh()
  }
  target.addEventListener('message', onMessage)
  ready({ serverURL: CMS_ORIGIN })
  return () => target.removeEventListener('message', onMessage)
}
