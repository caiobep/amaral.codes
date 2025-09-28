import type { BlockTransformer } from '../types.ts'
import { randomUUID } from 'node:crypto'
import { downloadImageToFilesystem } from '../../filesystem/use-cases/downloadImageToFilesystem.ts'
import { generateWebpOptimizedVersionOfImage } from '../../image-converter/generateWebpVersionOfImage.ts'

export type ImageMetadata = {
  name: string
  url: string
}
export type ImageProcessor = (
  onAddImage: (i: ImageMetadata) => unknown,
) => BlockTransformer
export const imageToDownloadedWebpProcessor = (dir: string) => async (block, n2m) => {
  const { image } = block as any
  const url = image?.file?.url ?? image?.external?.url

  if (!url) return ''

  const name = randomUUID()
  const imageOnFs = await downloadImageToFilesystem(dir, { name, url })
  await generateWebpOptimizedVersionOfImage(imageOnFs.path)

  const imageCaption = await n2m.blockToMarkdown(image?.caption)

  return `![${imageCaption}](./images/${name}.webp)`
}

export const imageProcessor: ImageProcessor =
  imageProcessor => async (block, n2m) => {
    const { image } = block as any
    const url = image?.file?.url ?? image?.external?.url

    if (!url) return ''

    const name = randomUUID()
    if (imageProcessor) imageProcessor({ name, url })

    const imageCaption = await n2m.blockToMarkdown(image?.caption)

    return `![${imageCaption}](./images/${name}.webp)`
  }

export const imageUrlProcessor: BlockTransformer = async (block, n2m) => {
  const { image } = block as any
  const url = image?.file?.url ?? image?.external?.url

  if (!url) return ''

  const imageCaption = await n2m.blockToMarkdown(image?.caption)

  return `![${imageCaption}](${url})`
}
