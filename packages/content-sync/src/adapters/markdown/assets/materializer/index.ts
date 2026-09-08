import {
  downloadAndWriteAsset,
  type AssetByteBudget,
  type WrittenAsset,
} from '../downloader/index.ts'
import {
  findMarkdownAssetReferences,
  type MarkdownAssetReference,
  rewriteMarkdownAssets,
} from '../references/index.ts'
import { renderExternalAsset, renderYoutubeEmbed } from '../rendering/index.ts'
import {
  createMarkdownAssetMaterializationSession,
  type DownloadScheduler,
  type MarkdownAssetMaterializationSession,
} from '../session/index.ts'

interface MaterializerOptions {
  fetcher?: typeof fetch
  isTrustedSource?: (source: string) => boolean
  resolveSource?: (source: string) => Promise<string>
  session?: MarkdownAssetMaterializationSession
}

interface MaterializationContext {
  byteBudget: AssetByteBudget
  cache: Map<string, Promise<WrittenAsset>>
  downloads: DownloadScheduler
  fetcher: typeof fetch
  isTrustedSource: (source: string) => boolean
  outputDirectory: string
  resolveSource: (source: string) => Promise<string>
}

const MAX_ASSET_REFERENCES = 100

export function createMarkdownAssetMaterializer(
  outputDirectory: string,
  {
    fetcher = fetch,
    isTrustedSource = () => false,
    resolveSource = source => Promise.resolve(source),
    session = createMarkdownAssetMaterializationSession(),
  }: MaterializerOptions,
) {
  const context: MaterializationContext = {
    byteBudget: session.byteBudget,
    cache: new Map(),
    downloads: session.downloads,
    fetcher,
    isTrustedSource,
    outputDirectory,
    resolveSource,
  }

  return async (markdown: string) => {
    assertAssetReferenceCount(markdown)
    return await rewriteMarkdownAssets(
      markdown,
      reference => materializeReference(reference, context),
    )
  }
}

async function materializeReference(
  reference: MarkdownAssetReference,
  context: MaterializationContext,
): Promise<string> {
  const youtubeEmbed = renderYoutubeEmbed(reference)
  if (youtubeEmbed) return youtubeEmbed

  const source = await context.resolveSource(reference.source)
  if (!context.isTrustedSource(source)) return renderExternalAsset(reference, source)
  assertDownloadableAsset(reference)

  const cacheKey = `${reference.kind}:${source}`
  const pendingAsset = context.cache.get(cacheKey) ?? context.downloads.run(
    () => downloadAndWriteAsset({ source }, context),
  )
  context.cache.set(cacheKey, pendingAsset)

  return (await pendingAsset).path
}

function assertAssetReferenceCount(markdown: string): void {
  if (findMarkdownAssetReferences(markdown).length <= MAX_ASSET_REFERENCES) return
  throw new Error(`Markdown contains more than ${String(MAX_ASSET_REFERENCES)} asset references`)
}

function assertDownloadableAsset(
  reference: MarkdownAssetReference,
): asserts reference is MarkdownAssetReference & { kind: 'image' } {
  if (reference.kind === 'image') return
  throw new Error(
    `Transient Notion ${reference.kind} assets require a stable public HTTPS URL`,
  )
}
