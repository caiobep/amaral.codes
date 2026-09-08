import path from 'node:path'

export const MAX_TALK_PREVIEW_BYTES = 1024 * 1024
export const MAX_TRACKED_FILE_BYTES = 30 * 1024 * 1024

const PUBLIC_ROOT = 'packages/website/public/'
const TALK_ASSET_ROOT = `${PUBLIC_ROOT}talks/`
const CANONICAL_PRESENTATION_EXTENSIONS = new Set(['.key', '.pdf', '.ppt', '.pptx'])
const APPROVED_DEPLOYABLE_DOCUMENTS = new Set([
  `${PUBLIC_ROOT}resume/CV.pdf`,
])
const APPROVED_PREVIEW_EXTENSIONS = new Set(['.avif', '.webp'])

export function findPresentationAssetViolations(files) {
  return files.flatMap((file) => {
    const reason = getViolationReason(file)
    return reason ? [{ filePath: file.filePath, reason }] : []
  })
}

function getViolationReason(file) {
  const extension = path.posix.extname(file.filePath).toLowerCase()
  const isDeployable = file.filePath.startsWith(PUBLIC_ROOT)
  const isTalkAsset = file.filePath.startsWith(TALK_ASSET_ROOT)
  const isCanonicalPresentation = CANONICAL_PRESENTATION_EXTENSIONS.has(extension)

  if ((file.tracked || isDeployable)
    && isCanonicalPresentation
    && !APPROVED_DEPLOYABLE_DOCUMENTS.has(file.filePath)) {
    return 'canonical presentation files belong in object storage'
  }

  if (file.tracked && file.size > MAX_TRACKED_FILE_BYTES) {
    return `tracked file exceeds ${formatMiB(MAX_TRACKED_FILE_BYTES)}`
  }

  if (isTalkAsset && !isApprovedTalkPreview(file.filePath, extension)) {
    return 'deployable talk assets must be optimized preview.webp or preview.avif files'
  }

  if (isTalkAsset && file.size > MAX_TALK_PREVIEW_BYTES) {
    return `talk preview exceeds ${formatMiB(MAX_TALK_PREVIEW_BYTES)}`
  }

  return undefined
}

function isApprovedTalkPreview(filePath, extension) {
  return path.posix.parse(filePath).name === 'preview'
    && APPROVED_PREVIEW_EXTENSIONS.has(extension)
}

function formatMiB(bytes) {
  return `${bytes / (1024 * 1024)} MiB`
}
