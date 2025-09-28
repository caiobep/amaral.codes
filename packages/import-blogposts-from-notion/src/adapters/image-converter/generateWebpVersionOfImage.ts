import sharp from 'sharp'

export async function generateWebpOptimizedVersionOfImage(rawImagePath: string) {
  if (!sharp) return null

  const output = rawImagePath.replace(/\.png$/i, '.webp')
  return sharp(rawImagePath).toFormat('webp').toFile(output)
}
