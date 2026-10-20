import type { EntryData } from '@amaral.codes/content-contract'

function generatedImageMetadata(image: string) {
  if (image.startsWith('/social/posts/') && image.endsWith('.png')) {
    return { imageWidth: 1200, imageHeight: 630, imageType: 'image/png' }
  }
  return {}
}

export function articleSharingImage(sharing: EntryData['sharing']) {
  if (sharing?.image) {
    return { image: sharing.image, imageAlt: sharing.imageAlt ?? '', ...generatedImageMetadata(sharing.image) }
  }
  return {
    image: '/social/article-default.jpg',
    imageAlt: "Editorial card for Caio Amaral's notes",
    imageHeight: 630,
    imageType: 'image/jpeg',
    imageWidth: 1200,
  }
}
