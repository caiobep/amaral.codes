import { expect, it } from 'vitest'
import { serializeCmsBody } from './body'
import { cmsHtmlMediaUrls, sanitizeCmsHtml } from './body-html'

it('exports safe native static HTML and normalizes article headings without dropping text', () => {
  expect(
    serializeCmsBody([
      {
        _type: 'htmlBlock',
        html: '<h1 id="section">A heading</h1><p>Static <strong>HTML</strong></p>',
      },
    ]),
  ).toBe('<h2 id="section">A heading</h2><p>Static <strong>HTML</strong></p>')
  expect(
    sanitizeCmsHtml('<script>alert(1)</script><p onclick="unsafe()">Safe</p>'),
  ).toBe('<p>Safe</p>')
})

it.each([
  { isolated: true },
  { css: 'body { color: red; }' },
  { js: 'alert(1)' },
])('explicitly refuses executable or isolated HTML: %s', fields => {
  expect(() =>
    serializeCmsBody([{ _type: 'htmlBlock', html: '<p>Body</p>', ...fields }]),
  ).toThrow('Isolated HTML and executable CSS/JavaScript')
})

it.each([
  'https://example.com/pixel.png?X-Amz-Signature=private',
  '/_emdash/api/media/file/pixel.png?_preview=private',
  'javascript:alert(1)',
])('refuses unsafe or private HTML URLs without printing them: %s', url => {
  expect(() => sanitizeCmsHtml(`<img src="${url}">`)).toThrow(
    'CMS HTML contains an unsafe or private URL',
  )
  expect(cmsHtmlMediaUrls(`<img src="${url}">`)).toEqual([])
})

it('enumerates only retained HTML media sources and actual links', () => {
  const internal = '/_emdash/api/media/file/pixel.png'
  expect(
    cmsHtmlMediaUrls(
      `<p><img src="${internal}" alt="Photo"><a href="/files/handout.pdf">Handout</a></p>`,
    ),
  ).toEqual([internal, '/files/handout.pdf'])
  expect(
    cmsHtmlMediaUrls(
      `<iframe src="https://example.com${internal}"></iframe><script src="${internal}"></script>`,
    ),
  ).toEqual([])
})
