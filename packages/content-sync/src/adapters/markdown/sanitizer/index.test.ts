import assert from 'node:assert/strict'
import { test } from 'vitest'
import { sanitizePublicMarkdown } from './index.ts'

test.each([
  { label: 'empty Markdown', markdown: '' },
  { label: 'inline generics', markdown: '`Array<T>`' },
  { label: 'backtick fences', markdown: '```html\n<button>Run</button>\n```' },
  { label: 'tilde fences', markdown: '~~~js\nleft && right && value < limit\n~~~' },
  { label: 'indented code', markdown: '    <button>Run</button> && Array<T>\n' },
  { label: 'prose and entities', markdown: 'left && right &copy; &#38; 1 < 2' },
  { label: 'escaped markup', markdown: '\\<button>Run\\</button>' },
  { label: 'autolinks', markdown: '<https://example.com/?a=1&b=2>' },
  { label: 'marker collisions', markdown: 'AMARALMARKDOWNTEXTX0X `Array<T>` && text' },
])('preserves $label with and without raw HTML', ({ markdown }) => {
  assert.equal(sanitizePublicMarkdown(markdown), markdown)
  assert.equal(sanitizePublicMarkdown(`${markdown}\n\n<br>`), `${markdown}\n\n<br />`)
})

test('allows required structural HTML while removing executable markup', () => {
  const source = [
    '<script>alert("private")</script>',
    '<details class="private" open onclick="alert(1)">',
    '<summary>Details</summary>',
    '<table style="color:red"><tr><th scope="col" colspan="2">Name</th></tr></table>',
    '</details>',
  ].join('\n')

  const result = sanitizePublicMarkdown(source)

  assert.doesNotMatch(result, /script|private|onclick|style/)
  assert.match(result, /<details open>/)
  assert.match(result, /<summary>Details<\/summary>/)
  assert.match(result, /<table><tr><th scope="col" colspan="2">Name<\/th><\/tr><\/table>/)
})

test.each(['scope="invalid"', 'scope="col row"', 'scope=""', 'scope', ''])(
  'omits unsupported or absent table header scopes: %s',
  scope => {
    const source = `<table><tr><th ${scope} colspan="2">Name</th></tr></table>`
    assert.equal(
      sanitizePublicMarkdown(source),
      '<table><tr><th colspan="2">Name</th></tr></table>',
    )
  },
)

test.each(['', '="false"', '="true"', '="open"'])(
  'normalizes present boolean attributes without changing their meaning: %s',
  value => {
    assert.equal(sanitizePublicMarkdown(`<details open${value}>Details</details>`),
      '<details open>Details</details>')
    assert.equal(sanitizePublicMarkdown(`<track src="/captions.vtt" default${value}>`),
      '<track src="/captions.vtt" default></track>')
  },
)

test('does not add absent boolean attributes or retain tracks with unsafe URLs', () => {
  assert.equal(sanitizePublicMarkdown('<details>Details</details>'), '<details>Details</details>')
  assert.equal(sanitizePublicMarkdown('<track src="/captions.vtt">'),
    '<track src="/captions.vtt"></track>')
  assert.equal(sanitizePublicMarkdown('<track src="javascript:alert(1)" default>'), '')
})

test.each(['0', '00', '0640', '-1', '12px'])(
  'removes dimensions the publication checker cannot accept: %s',
  value => {
    const result = sanitizePublicMarkdown(`<img src="/image.webp" width="${value}" height="${value}">`)
    assert.doesNotMatch(result, /width=|height=/)
    assert.match(result, /src="\/image.webp"/)
  },
)

test('forces safe iframe attributes and drops unsafe embed URLs', () => {
  const source = [
    '<iframe src="https://video.example.com/embed/42" title="Demo"',
    '  onload="alert(1)" referrerpolicy="unsafe-url" sandbox="allow-top-navigation"',
    '  allow="camera; autoplay; picture-in-picture *"></iframe>',
    '<iframe src="https://user:secret@video.example.com/embed/7"></iframe>',
    '<iframe src="//attacker.example/embed/8"></iframe>',
  ].join('\n')

  const result = sanitizePublicMarkdown(source)

  assert.match(result, /src="https:\/\/video\.example\.com\/embed\/42"/)
  assert.match(result, /title="Demo"/)
  assert.match(result, /loading="lazy"/)
  assert.match(result, /referrerpolicy="no-referrer"/)
  assert.match(result, /sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"/)
  assert.match(result, /allow="autoplay"/)
  assert.doesNotMatch(result, /onload|unsafe-url|top-navigation|camera|picture-in-picture \*/)
  assert.doesNotMatch(result, /secret|attacker/)
  assert.equal((result.match(/<iframe/g) ?? []).length, 1)
})

test('preserves Markdown and code while sanitizing media HTML', () => {
  const source = [
    '# Heading',
    '',
    '`<script>inline example</script>`',
    '',
    '```html',
    '<iframe src="http://documentation.example.com"></iframe>',
    '```',
    '',
    '<img src="/images/example.png" alt="Example" width="640" onerror="alert(1)">',
    '<audio src="./assets/episode.mp3" autoplay>Episode</audio>',
  ].join('\n')

  const result = sanitizePublicMarkdown(source)

  assert.match(result, /`<script>inline example<\/script>`/)
  assert.match(result, /```html\n<iframe src="http:\/\/documentation\.example\.com"><\/iframe>\n```/)
  assert.match(result, /<img src="\/images\/example\.png" alt="Example" loading="lazy" decoding="async" referrerpolicy="no-referrer" width="640" \/>/)
  assert.match(result, /<audio src="\.\/assets\/episode\.mp3" controls preload="metadata">Episode<\/audio>/)
  assert.doesNotMatch(result, /onerror|autoplay/)
})

test('rejects unsafe Markdown destinations without disclosing URL details', () => {
  const unsafeUrl = 'https://user:private@example.com/report'
  assert.throws(
    () => sanitizePublicMarkdown(`[Report](${unsafeUrl})`),
    error => error instanceof Error
      && error.message.includes('HTTPS')
      && !error.message.includes('private'),
  )
  assert.throws(
    () => sanitizePublicMarkdown('[Report](//attacker.example/report)'),
    /HTTPS/,
  )
  assert.throws(
    () => sanitizePublicMarkdown('[Report](http://example.com/report)'),
    /HTTPS/,
  )
})

test.each([
  '<http://example.com/report>',
  '<https://user:private@example.com/report>',
  '<https://example.com/report?token=private>',
])('rejects unsafe autolinks even without raw HTML: %s', markdown => {
  assert.throws(
    () => sanitizePublicMarkdown(markdown),
    error => error instanceof Error
      && error.message.includes('HTTPS')
      && !error.message.includes('private'),
  )
})
