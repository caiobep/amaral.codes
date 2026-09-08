import { convertLexicalToHTML } from '@payloadcms/richtext-lexical/html'
import { describe, expect, it } from 'vitest'
import type { Entry } from '../payload-types'
import { articleFeatures } from './index'

const text = { type: 'text', text: 'A concrete observation.', version: 1, format: 0, detail: 0, mode: 'normal', style: '' }
const element = { version: 1, direction: null, format: '', indent: 0 } as const

function render(children: Entry['body']['root']['children']) {
  return convertLexicalToHTML({ data: { root: { ...element, type: 'root', children } } })
}

describe('article editor features', () => {
  it('only offers content that the article renderer supports', () => {
    expect(articleFeatures.map(({ key }) => key)).toEqual([
      'bold', 'italic', 'underline', 'strikethrough', 'subscript', 'superscript', 'inlineCode',
      'paragraph', 'align', 'indent', 'unorderedList', 'orderedList', 'checklist', 'blockquote',
      'upload', 'horizontalRule', 'toolbarInline', 'heading', 'link',
    ])
    expect(articleFeatures.find(({ key }) => key === 'link')?.serverFeatureProps).toEqual({ enabledCollections: [] })
    expect(articleFeatures.find(({ key }) => key === 'heading')?.serverFeatureProps).toEqual({ enabledHeadingSizes: ['h2', 'h3', 'h4', 'h5', 'h6'] })
  })

  it('renders headings, formatted text, and ordinary URLs with the real converter', () => {
    const html = render([
      { ...element, type: 'heading', tag: 'h2', children: [text] },
      { ...element, type: 'paragraph', children: [
        { ...text, format: 1 },
        { ...element, type: 'link', fields: { linkType: 'custom', url: 'https://amaral.codes/posts', newTab: true }, children: [text] },
      ] },
    ])
    expect(html).toContain('<h2>A concrete observation.</h2>')
    expect(html).toContain('<strong>A concrete observation.</strong>')
    expect(html).toContain('href="https://amaral.codes/posts"')
    expect(html).toContain('target="_blank"')
    expect(html).not.toContain('unknown node')
  })

  it('preserves populated image alt text and authenticated upload URLs', () => {
    const html = render([{
      ...element, type: 'upload', relationTo: 'media', value: {
        id: 1, url: 'http://127.0.0.1:4010/api/media/file/example.png',
        filename: 'example.png', mimeType: 'image/png', width: 800, height: 600, alt: 'A sketch & its details',
      },
    }])
    expect(html).toContain('src="http://127.0.0.1:4010/api/media/file/example.png"')
    expect(html).toContain('alt="A sketch &amp; its details"')
    expect(html).toContain('width="800"')
    expect(html).toContain('height="600"')
  })

  it('escapes authored text instead of interpreting it as HTML', () => {
    expect(render([{ ...element, type: 'paragraph', children: [{ ...text, text: '<script>alert(1)</script>' }] }]))
      .toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })
})
