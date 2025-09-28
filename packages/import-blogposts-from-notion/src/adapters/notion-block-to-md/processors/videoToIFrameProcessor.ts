import type { BlockTransformer } from '../types.ts'

export const videoToIFrameProcessor: BlockTransformer = async block => {
  const url = block?.video?.external?.url ?? block?.video?.file?.url

  if (!url) return ''

  if (url.includes('youtube')) {
    const embedUrl = url.replace('watch?v=', 'embed/')
    return `<iframe src="${embedUrl}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`
  }

  return ''
}
