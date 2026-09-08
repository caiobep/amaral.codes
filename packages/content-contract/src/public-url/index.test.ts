import { describe, expect, it } from 'vitest'
import {
  hasSensitiveUrlDetails,
  isPublicHttpsUrl,
  isPublicLocalUrl,
  isPublicUrl,
  isRootRelativePublicUrl,
  requirePublicHttpsUrl,
  requirePublicUrl,
} from './index.ts'

describe('public URL policy', () => {
  it('accepts credential-free public HTTPS and local URLs', () => {
    expect(isPublicHttpsUrl('https://example.com/article?ref=home')).toBe(true)
    expect(isPublicLocalUrl('/images/photo.webp')).toBe(true)
    expect(isPublicLocalUrl('../images/photo.webp#large')).toBe(true)
    expect(isPublicLocalUrl('#details')).toBe(true)
    expect(isRootRelativePublicUrl('/images/photo.webp')).toBe(true)
    expect(isRootRelativePublicUrl('../images/photo.webp')).toBe(false)
    expect(isPublicUrl('/images/photo.webp')).toBe(true)
  })

  it('rejects insecure, protocol-relative, and userinfo URLs', () => {
    expect(isPublicHttpsUrl('http://example.com')).toBe(false)
    expect(isPublicHttpsUrl('https://user:secret@example.com')).toBe(false)
    expect(isPublicLocalUrl('//example.com/image.webp')).toBe(false)
    expect(isPublicLocalUrl('\\\\example.com/image.webp')).toBe(false)
    expect(isPublicLocalUrl('/\\example.com/image.webp')).toBe(false)
    expect(isPublicUrl('javascript:alert(1)')).toBe(false)
  })

  it('detects direct and percent-encoded nested credentials', () => {
    const nested = 'https://embed.example.com/?url=https%253A%252F%252Ffiles.example.com'
      + '%252Ffile%253Ftoken%253Dsecret'

    expect(isPublicHttpsUrl('https://example.com/file?X-Amz-Signature=secret')).toBe(false)
    expect(isPublicHttpsUrl(nested)).toBe(false)
    expect(isPublicHttpsUrl(
      'https://embed.example.com/?url=http%3A%2F%2Fexample.com%2Ffile%3Ftoken%3Dsecret',
    )).toBe(false)
    expect(isPublicHttpsUrl('https://example.com/?%2574oken=secret')).toBe(false)
    expect(hasSensitiveUrlDetails(new URL(nested))).toBe(true)
  })

  it('applies credential detection to local URLs and nested local values', () => {
    expect(isPublicLocalUrl('/image.webp?token=secret')).toBe(false)
    expect(isPublicLocalUrl('/embed?asset=%252Fimage.webp%253Fapi_key%253Dsecret')).toBe(false)
    expect(isRootRelativePublicUrl('/image.webp?signature=secret')).toBe(false)
  })

  it('throws sanitized errors from requirement helpers', () => {
    expect(requirePublicHttpsUrl('https://example.com', 'Source URL'))
      .toBe('https://example.com/')
    expect(requirePublicUrl('./image.webp', 'Image URL')).toBe('./image.webp')
    expect(() => requirePublicHttpsUrl(
      'https://example.com?token=secret',
      'Source URL',
    )).toThrow('Source URL must be a public HTTPS URL without credentials')
    expect(() => requirePublicUrl('/image.webp?token=secret', 'Image URL'))
      .toThrow('Image URL must be a public HTTPS or local URL without credentials')
  })
})
