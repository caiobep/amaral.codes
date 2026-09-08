import type { AssetByteBudget } from '../downloader/index.ts'

export interface DownloadScheduler {
  run: <T>(operation: () => Promise<T>) => Promise<T>
}

export interface MarkdownAssetMaterializationSession {
  byteBudget: AssetByteBudget
  downloads: DownloadScheduler
}

const MAX_CONCURRENT_DOWNLOADS = 4
const MAX_TOTAL_ASSET_BYTES = 200 * 1024 * 1024

export function createMarkdownAssetMaterializationSession(): MarkdownAssetMaterializationSession {
  return {
    byteBudget: createByteBudget(MAX_TOTAL_ASSET_BYTES),
    downloads: createDownloadScheduler(MAX_CONCURRENT_DOWNLOADS),
  }
}

function createByteBudget(maxBytes: number): AssetByteBudget {
  let consumedBytes = 0
  return {
    consume: byteLength => {
      if (consumedBytes + byteLength > maxBytes) {
        throw new Error('Assets exceed the 200 MiB aggregate sync limit')
      }
      consumedBytes += byteLength
    },
  }
}

function createDownloadScheduler(concurrency: number): DownloadScheduler {
  let activeDownloads = 0
  const waiting: (() => void)[] = []

  return {
    run: async operation => {
      if (activeDownloads >= concurrency) {
        await new Promise<void>(resolve => waiting.push(resolve))
      }
      activeDownloads += 1
      try {
        return await operation()
      } finally {
        activeDownloads -= 1
        waiting.shift()?.()
      }
    },
  }
}
