export function findRawHtmlTags(source) {
  const tags = []
  let cursor = 0
  while (cursor < source.length) {
    const start = source.indexOf('<', cursor)
    if (start === -1) break
    if (isEscaped(source, start)) {
      cursor = start + 1
      continue
    }
    if (source.startsWith('<!--', start)) {
      const commentEnd = source.indexOf('-->', start + 4)
      if (commentEnd === -1) tags.push({ kind: 'declaration' })
      cursor = commentEnd === -1 ? source.length : commentEnd + 3
      continue
    }
    const end = findTagEnd(source, start + 1)
    if (end === -1) break
    const tag = parseTag(source.slice(start + 1, end))
    if (tag !== null) tags.push(tag)
    cursor = end + 1
  }
  return tags
}

function findTagEnd(source, start) {
  let quote = null
  for (let index = start; index < source.length; index += 1) {
    const character = source[index]
    if (quote !== null && character === quote) quote = null
    else if (quote === null && (character === '"' || character === "'")) quote = character
    else if (quote === null && character === '>') return index
  }
  return -1
}

function parseTag(rawTag) {
  const trimmed = rawTag.trim()
  if (trimmed.startsWith('!') || trimmed.startsWith('?')) {
    return { kind: 'declaration' }
  }
  const match = /^(\/)?([a-z][\w-]*)(.*)$/is.exec(trimmed)
  if (!match) return null
  const remainder = match[3] ?? ''
  if (remainder !== '' && !/^[\s/]/.test(remainder)) return null
  const closing = match[1] === '/'
  return {
    kind: 'tag',
    name: (match[2] ?? '').toLowerCase(),
    closing,
    attributes: parseAttributes(remainder, closing),
  }
}

function parseAttributes(value, closing) {
  let source = value.trim()
  if (source.endsWith('/')) source = source.slice(0, -1).trimEnd()
  if (closing) return source === '' ? new Map() : null

  const attributes = new Map()
  const pattern = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gy
  let cursor = 0
  while (cursor < source.length) {
    while (/\s/.test(source[cursor] ?? '')) cursor += 1
    if (cursor >= source.length) break
    pattern.lastIndex = cursor
    const match = pattern.exec(source)
    if (!match) return null
    const name = (match[1] ?? '').toLowerCase()
    if (attributes.has(name)) return null
    attributes.set(name, match[2] ?? match[3] ?? match[4] ?? null)
    cursor = pattern.lastIndex
  }
  return attributes
}

function isEscaped(value, index) {
  let slashCount = 0
  for (let cursor = index - 1; cursor >= 0 && value[cursor] === '\\'; cursor -= 1) {
    slashCount += 1
  }
  return slashCount % 2 === 1
}
