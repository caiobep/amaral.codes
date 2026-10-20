import type { ImageValue } from 'emdash'
import { mediaPrefix, normalizeMediaKey } from './media/keys'

export interface CmsSocialImage {
  image: string
  imageAlt: string
  imageWidth?: number | undefined
  imageHeight?: number | undefined
  imageType?: string | undefined
}

export function getCmsSocialImage(image: ImageValue | undefined, preview: boolean): CmsSocialImage | undefined {
  if (preview || !image) return undefined
  return socialImageProperties(image)
}

function socialImageProperties(image: ImageValue): CmsSocialImage {
  return {
    image: `${mediaPrefix}${mediaKey(image)}`,
    imageAlt: image.alt ?? '',
    imageWidth: image.width,
    imageHeight: image.height,
    imageType: mimeType(image),
  }
}

function mediaKey(image: ImageValue): string {
  const key = image.meta?.storageKey
  if (typeof key !== 'string' || !normalizeMediaKey(key)) throw new Error('Social images require a durable CMS media key')
  return key
}

function mimeType(image: ImageValue): string | undefined {
  const value = image.meta?.mimeType
  return typeof value === 'string' ? value : undefined
}
