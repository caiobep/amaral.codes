export type ShareResult = 'cancelled' | 'copied' | 'failed' | 'shared'
type NativeShareResult = 'cancelled' | 'shared' | 'unavailable'

export interface ShareDependencies {
  readonly copy?: (text: string) => Promise<void>
  readonly share?: (data: ShareData) => Promise<void>
}

export interface CopyDependencies {
  readonly clipboard?: (text: string) => Promise<void>
  readonly legacyCopy: (text: string) => boolean
}

const isAbortError = (error: unknown) => error instanceof Error && error.name === 'AbortError'

const tryNativeShare = async (data: ShareData, share?: ShareDependencies['share']): Promise<NativeShareResult> => {
  if (!share) return 'unavailable'
  try {
    await share(data)
    return 'shared'
  } catch (error) {
    return isAbortError(error) ? 'cancelled' : 'unavailable'
  }
}

const tryCopy = async (url: string, copy?: ShareDependencies['copy']): Promise<ShareResult> => {
  if (!copy) return 'failed'
  try {
    await copy(url)
    return 'copied'
  } catch {
    return 'failed'
  }
}

export const copyWithFallback = async (text: string, dependencies: CopyDependencies): Promise<void> => {
  if (dependencies.clipboard) {
    try {
      await dependencies.clipboard(text)
      return
    } catch {
      // Selection-based copying still works on insecure LAN previews.
    }
  }

  if (!dependencies.legacyCopy(text)) throw new Error('Copy unavailable')
}

export const shareOrCopy = async (data: ShareData, dependencies: ShareDependencies): Promise<ShareResult> => {
  const nativeResult = await tryNativeShare(data, dependencies.share)
  if (nativeResult !== 'unavailable') return nativeResult
  return tryCopy(data.url ?? '', dependencies.copy)
}
