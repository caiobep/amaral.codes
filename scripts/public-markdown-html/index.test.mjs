import assert from 'node:assert/strict'
import { test } from 'node:test'
import { sanitizePublicMarkdown } from '../../packages/content-sync/src/adapters/markdown/sanitizer/index.ts'
import { findRawHtmlTags } from './html-parser/index.mjs'
import { checkPublicMarkdownHtml } from './index.mjs'

test('accepts the complete structural and media HTML output of the sanitizer', () => {
  const source = [
    '<details open="false" onclick="alert(1)"><summary>Examples</summary>',
    '<hr style="color:red"><br class="private">',
    '<figure><img src="/image.webp" alt="Example" width="0" height="120">',
    '<figcaption>Caption</figcaption></figure>',
    '<table><caption>Results</caption>',
    '<thead><tr><th scope="col" colspan="2">Group</th></tr></thead>',
    '<tbody><tr><th scope="row" rowspan="2">Name</th><td>1</td></tr>',
    '<tr><td>2</td></tr></tbody>',
    '<tfoot><tr><td colspan="2">Total</td></tr></tfoot></table>',
    '<audio src="/audio.mp3"><source src="/audio.ogg" type="audio/ogg"></audio>',
    '<video src="/video.mp4" poster="/poster.webp" width="640" height="360">',
    '<track src="/captions.vtt" default="false" kind="captions" label="English" srclang="en">',
    '</video>',
    '<iframe src="https://example.com/embed" allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; web-share"></iframe>',
    '</details>',
  ].join('\n')
  const sanitized = sanitizePublicMarkdown(source)
  const tags = findRawHtmlTags(sanitized)

  assert.deepEqual([...new Set(tags.map(tag => tag.name))].sort(), [
    'audio', 'br', 'caption', 'details', 'figcaption', 'figure', 'hr', 'iframe',
    'img', 'source', 'summary', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead',
    'tr', 'track', 'video',
  ])
  assert.doesNotMatch(sanitized, /onclick|style=|class=/)
  assert.deepEqual(checkPublicMarkdownHtml('complete.md', sanitized), [])
})

test('keeps newly supported structural and track attributes narrowly constrained', () => {
  for (const source of [
    '<hr onclick="alert(1)">', '<hr style="color:red">', '<hr width="12">',
    '<details open="false">', '<details name="shared">', '<details ontoggle="alert(1)">',
    '<track src="/captions.vtt" onload="alert(1)">',
    '<track src="/captions.vtt" default="false">',
    '<track src="/captions.vtt" style="color:red">',
    '<track src="javascript:alert(1)">', '<track>', '<track src>', '<source>',
    '<track src="https://example.com/captions.vtt?token=private">',
  ]) {
    assert.notEqual(checkPublicMarkdownHtml('unsafe.md', source).length, 0, source)
  }
})

test('accepts code-only Markdown preserved by the actual sanitizer', () => {
  for (const markdown of ['`Array<T>`', '```html\n<button>Run</button>\n```', 'left && right']) {
    const sanitized = sanitizePublicMarkdown(markdown)
    assert.equal(sanitized, markdown)
    assert.deepEqual(checkPublicMarkdownHtml('code.md', sanitized), [])
  }
})

test('accepts indented and nested code from the actual sanitizer without hiding adjacent HTML', () => {
  for (const markdown of [
    '    <button>Run</button>',
    '\t<button>Run</button>',
    'Example\n\n    <button>Run</button>\n    && Array<T>',
    '>     <button>Run</button>',
    '- Example\n\n      <button>Run</button>',
    '> ```html\n> <button>Run</button>\n> ```',
    '- Example\n\n  ```html\n  <button>Run</button>\n  ```',
  ]) {
    assert.equal(sanitizePublicMarkdown(markdown), markdown)
    assert.deepEqual(checkPublicMarkdownHtml('code.md', sanitizePublicMarkdown(markdown)), [])

    const mixed = `${markdown}\n\n<script>alert(1)</script>`
    assert.deepEqual(checkPublicMarkdownHtml('mixed.md', mixed), [{
      file: 'mixed.md', reason: 'disallowed raw HTML element <script>',
    }])
    const sanitized = sanitizePublicMarkdown(mixed)
    assert.equal(sanitized, `${markdown}\n\n`)
    assert.deepEqual(checkPublicMarkdownHtml('mixed.md', sanitized), [])
  }
})

test('does not let unmatched or escaped backticks hide executable HTML', () => {
  for (const markdown of [
    '<script>alert(1)</script>\n\nprose ending `',
    '<script>alert(1)</script>\n\n`unmatched\n\n``matched code``',
    '`example` and <script>alert(1)</script>\n\ntrailing ``',
    '\\`<script>alert(1)</script>\\`',
    '```js`invalid\n<script>alert(1)</script>\n```',
    '<script>\n```js\nalert(1)\n```\n</script>',
  ]) {
    assert.deepEqual(checkPublicMarkdownHtml('unsafe.md', markdown), [{
      file: 'unsafe.md', reason: 'disallowed raw HTML element <script>',
    }], markdown)
  }
})

test('does not treat backticks inside HTML attributes as Markdown code spans', () => {
  const markdown = '<figure title="`" onclick="alert(1)" data-end="`"></figure>'
  const reasons = checkPublicMarkdownHtml('unsafe.md', markdown).map(({ reason }) => reason)
  assert.ok(reasons.includes('event handler onclick is not allowed on <figure>'))
})

test('accepts safe tables produced by the actual Markdown sanitizer', () => {
  const source = [
    '<table class="private" style="color:red" onclick="alert(1)">',
    '<caption>Results</caption>',
    '<thead><tr><th scope="colgroup" colspan="2">Group</th></tr>',
    '<tr><th scope="col">Name</th><th scope="col">Count</th></tr></thead>',
    '<tbody><tr><th scope="rowgroup" rowspan="2">Examples</th>',
    '<td colspan="2" rowspan="2" style="color:red" onmouseover="alert(1)">2</td></tr>',
    '<tr><th scope="row" scope-extra="private">Item</th></tr></tbody>',
    '<tfoot><tr><th scope="invalid">Total</th><td>2</td></tr></tfoot>',
    '</table>',
  ].join('\n')
  const expected = [
    '<table>',
    '<caption>Results</caption>',
    '<thead><tr><th scope="colgroup" colspan="2">Group</th></tr>',
    '<tr><th scope="col">Name</th><th scope="col">Count</th></tr></thead>',
    '<tbody><tr><th scope="rowgroup" rowspan="2">Examples</th>',
    '<td colspan="2" rowspan="2">2</td></tr>',
    '<tr><th scope="row">Item</th></tr></tbody>',
    '<tfoot><tr><th>Total</th><td>2</td></tr></tfoot>',
    '</table>',
  ].join('\n')

  const sanitized = sanitizePublicMarkdown(source)

  assert.equal(sanitized, expected)
  assert.deepEqual(checkPublicMarkdownHtml('table.md', sanitized), [])
})

test('rejects unsafe and unsupported table attributes', () => {
  for (const name of ['table', 'caption', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td']) {
    for (const attribute of [
      'onclick="alert(1)"', 'style="color:red"', 'class="private"', 'src="javascript:alert(1)"',
    ]) {
      assert.notEqual(
        checkPublicMarkdownHtml('table.md', `<${name} ${attribute}>`).length,
        0,
        `${name} must reject ${attribute}`,
      )
    }
  }
  for (const markup of [
    '<table colspan="2">', '<tr rowspan="2">', '<td scope="col">',
    '<th scope="invalid">', '<th scope>', '<th scope="col" scope="row">',
    '</th scope="col">',
  ]) {
    assert.notEqual(checkPublicMarkdownHtml('table.md', markup).length, 0, markup)
  }
})

test('allows the safe raw HTML constructs used by public content', () => {
  const markdown = [
    '<figure>',
    '  <img src="/images/profile.webp" alt="Profile" loading="lazy" decoding="async" referrerpolicy="no-referrer" width="800" height="600" />',
    '  <figcaption>A profile photo</figcaption>',
    '</figure>',
    '<br />',
    '<iframe src="https://www.youtube-nocookie.com/embed/example" title="Video" loading="lazy" referrerpolicy="no-referrer" sandbox="allow-scripts allow-same-origin allow-popups allow-presentation" allowfullscreen allow="accelerometer; autoplay; encrypted-media; picture-in-picture"></iframe>',
    '<audio src="./assets/example.mp3" controls preload="metadata">Example</audio>',
    '<video src="./assets/example.mp4" controls preload="metadata">Example</video>',
  ].join('\n')

  assert.deepEqual(checkPublicMarkdownHtml('safe.md', markdown), [])
})

test('ignores HTML examples inside code spans and fenced code blocks', () => {
  const markdown = [
    'Use `<script>alert(1)</script>` only as an example.',
    '````html',
    '<img src="javascript:alert(1)" onerror="alert(1)">',
    '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
    '````',
    '~~~html',
    '<object data="https://example.com"></object>',
    '~~~',
  ].join('\n')

  assert.deepEqual(checkPublicMarkdownHtml('examples.md', markdown), [])
})

test('rejects executable and disallowed raw HTML', () => {
  const markdown = [
    '<script src="https://example.com/code.js"></script>',
    '<svg onload="alert(1)"></svg>',
    '<figure onclick="alert(1)"></figure>',
    '<!doctype html>',
  ].join('\n')
  const reasons = checkPublicMarkdownHtml('unsafe.md', markdown).map(({ reason }) => reason)

  assert.ok(reasons.includes('disallowed raw HTML element <script>'))
  assert.ok(reasons.includes('disallowed raw HTML element <svg>'))
  assert.ok(reasons.includes('event handler onclick is not allowed on <figure>'))
  assert.ok(reasons.includes('HTML declarations are not allowed'))
  assert.deepEqual(checkPublicMarkdownHtml('comment.md', '<!-- never closed'), [{
    file: 'comment.md',
    reason: 'HTML declarations are not allowed',
  }])
})

test('rejects unsafe iframe attributes and nested URL credentials', () => {
  const nestedUrl = 'https://embed.example.com/?url=https%253A%252F%252Ffiles.example.com'
    + '%252Fembed%253Ftoken%253Dsecret'
  const markdown = `<iframe src="${nestedUrl}" title="Embed" loading="eager" `
    + 'referrerpolicy="origin" sandbox="allow-top-navigation" allow="camera" '
    + 'srcdoc="<p>Unsafe</p>"></iframe>'
  const reasons = checkPublicMarkdownHtml('iframe.md', markdown).map(({ reason }) => reason)

  assert.ok(reasons.includes('srcdoc is not allowed on <iframe>'))
  assert.ok(reasons.includes('<iframe> src must be a credential-free HTTPS URL'))
  assert.ok(reasons.includes('<iframe> loading must be lazy'))
  assert.ok(reasons.includes('<iframe> referrerpolicy must be no-referrer'))
  assert.ok(reasons.includes('<iframe> uses an unsafe sandbox permission'))
  assert.ok(reasons.includes('<iframe> allow contains an unapproved feature'))
})

test('rejects unsafe image URLs, attributes, and srcset candidates', () => {
  const markdown = '<img src="/image.webp?token=secret" alt="Example" '
    + 'srcset="/image.webp 1x, https://example.com/image.webp?api_key=secret 2x" '
    + 'loading="instant" onerror="alert(1)">'
  const reasons = checkPublicMarkdownHtml('image.md', markdown).map(({ reason }) => reason)

  assert.ok(reasons.includes('event handler onerror is not allowed on <img>'))
  assert.ok(reasons.includes('<img> src must be a credential-free HTTPS or local URL'))
  assert.ok(reasons.includes('<img> srcset contains an unsafe URL or descriptor'))
  assert.ok(reasons.includes('<img> loading has an unsafe value'))
  assert.equal(JSON.stringify(reasons).includes('secret'), false)
  assert.deepEqual(
    checkPublicMarkdownHtml('encoded.md', '<img src="javascript&#58alert(1)" alt="">'),
    [{
      file: 'encoded.md',
      reason: '<img> src must be a credential-free HTTPS or local URL',
    }],
  )
})

test('does not mistake Markdown autolinks or escaped examples for raw HTML', () => {
  const markdown = '<https://example.com> <author@example.com> \\<script>alert(1)\\</script>'
  assert.deepEqual(checkPublicMarkdownHtml('links.md', markdown), [])
})
