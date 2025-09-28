import https from 'node:https'
import fs from 'node:fs'
import path from 'node:path'
type ImageMetadata = {
  name: string
  url: string
}

export async function downloadImageToFilesystem(
  directory: string,
  image: ImageMetadata,
): Promise<ImageMetadata & { path: string }> {
  const destinationPath = path.join(directory, image.name + '.png')
  const fileStream = fs.createWriteStream(destinationPath)

  return new Promise((resolve, reject) => {
    https
      .get(image.url, response => {
        response.pipe(fileStream)
        fileStream.on('finish', () => {
          console.log('Downloaded image: ', image)
          fileStream.close()
          resolve({ ...image, path: destinationPath })
        })
      })
      .on('error', err => {
        fs.unlink(destinationPath, () => {})
        reject(err)
      })
  })
}
