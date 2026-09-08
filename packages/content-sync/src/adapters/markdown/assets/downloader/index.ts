import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import sharp from 'sharp'

export interface AssetDownload {
  source: string
}

export interface AssetDownloaderContext {
  byteBudget: AssetByteBudget
  fetcher: typeof fetch
  isTrustedSource: (source: string) => boolean
  outputDirectory: string
}

export interface AssetByteBudget {
  consume: (byteLength: number) => void
}

export interface WrittenAsset {
  path: string
}

const MAX_ASSET_SIZE_BYTES = 50 * 1024 * 1024
const MAX_REDIRECTS = 5

export async function downloadAndWriteAsset(
  download: AssetDownload,
  context: AssetDownloaderContext,
): Promise<WrittenAsset> {
  const response = await fetchTrustedAsset(download.source, context)
  if (!response.ok) {
    throw new Error(`Could not download asset: HTTP ${String(response.status)}`)
  }

  const declaredByteLength = readDeclaredAssetSize(
    response.headers.get('content-length'),
  )
  context.byteBudget.consume(declaredByteLength)
  const input = await readResponseBytes(
    response,
    context.byteBudget,
    declaredByteLength,
  )
  const output = await sharp(input, { animated: true }).rotate().webp({ quality: 82 }).toBuffer()
  const hash = createHash('sha256').update(output).digest('hex').slice(0, 32)
  const fileName = `${hash}.webp`
  const directory = path.join(context.outputDirectory, 'images')

  await fs.mkdir(directory, { recursive: true })
  await fs.writeFile(path.join(directory, fileName), output)

  return {
    path: `./images/${fileName}`,
  }
}

async function fetchTrustedAsset(
  source: string,
  context: AssetDownloaderContext,
  redirects = 0,
): Promise<Response> {
  if (!context.isTrustedSource(source)) {
    throw new Error('Refusing to download an untrusted asset URL')
  }

  const response = await context.fetcher(source, {
    redirect: 'manual',
    signal: AbortSignal.timeout(30_000),
  })
  if (!isRedirect(response)) return response
  return followRedirect(response, source, context, redirects)
}

function isRedirect(response: Response): boolean {
  return response.status >= 300 && response.status < 400
}

function followRedirect(
  response: Response,
  source: string,
  context: AssetDownloaderContext,
  redirects: number,
): Promise<Response> {
  if (redirects >= MAX_REDIRECTS) throw new Error('Too many asset redirects')

  const location = response.headers.get('location')
  if (!location) throw new Error('Asset redirect did not include a location')
  return fetchTrustedAsset(new URL(location, source).href, context, redirects + 1)
}

async function readResponseBytes(
  response: Response,
  byteBudget: AssetByteBudget,
  reservedByteLength: number,
): Promise<Buffer> {
  const body = response.body
  if (body === null) return Buffer.alloc(0)

  const chunks: Buffer[] = []
  let byteLength = 0
  let remainingReservedBytes = reservedByteLength

  for await (const chunk of Readable.fromWeb(body)) {
    if (!(chunk instanceof Uint8Array)) {
      throw new Error('Asset stream returned an invalid chunk')
    }
    const buffer = Buffer.from(chunk)
    byteLength += buffer.byteLength
    assertAssetSize(String(byteLength))
    const reservedBytes = Math.min(remainingReservedBytes, buffer.byteLength)
    remainingReservedBytes -= reservedBytes
    byteBudget.consume(buffer.byteLength - reservedBytes)
    chunks.push(buffer)
  }

  return Buffer.concat(chunks, byteLength)
}

function readDeclaredAssetSize(contentLength: string | null): number {
  const size = Number(contentLength)
  if (!Number.isFinite(size) || size < 0) return 0
  assertAssetSize(contentLength)
  return size
}

function assertAssetSize(contentLength: string | null): void {
  const size = Number(contentLength)
  if (!Number.isFinite(size) || size <= MAX_ASSET_SIZE_BYTES) return
  throw new Error('Asset exceeds the 50 MiB sync limit')
}
