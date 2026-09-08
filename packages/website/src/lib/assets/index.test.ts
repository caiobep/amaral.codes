import { describe, expect, it } from 'vitest'
import { PUBLIC_ASSET_ORIGIN, resolvePublicAssetUrl } from '.'

describe('resolvePublicAssetUrl', () => {
  it('resolves hosted podcast paths against the public asset origin', () => {
    expect(resolvePublicAssetUrl('/podcasts/episode.mp3'))
      .toBe(`${PUBLIC_ASSET_ORIGIN}/podcasts/episode.mp3`)
  })

  it('keeps publisher-hosted audio URLs unchanged', () => {
    const url = 'https://publisher.example/episode.mp3'

    expect(resolvePublicAssetUrl(url)).toBe(url)
  })

  it('keeps bundled site assets local', () => {
    expect(resolvePublicAssetUrl('/talks/example/preview.webp'))
      .toBe('/talks/example/preview.webp')
  })
})
