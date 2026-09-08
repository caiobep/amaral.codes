const HTML_ENTITY_PATTERN = /&(?:(?:amp|apos|colon|gt|lt|quot);|#\d+;?|#x[\da-f]+;?)/gi
const UNKNOWN_HTML_ENTITY_PATTERN = /&(?:[a-z][\da-z]+;|#\d+;?|#x[\da-f]+;?)/i

export function validateAllowedAttributes(file, name, attributes, allowed) {
  return [...attributes.keys()]
    .filter(attribute => !allowed.has(attribute))
    .map(attribute => ({ file, reason: `${attribute} is not allowed on <${name}>` }))
}

export function validateDimensions(file, name, attributes) {
  return ['width', 'height'].flatMap(attribute => {
    const value = attributes.get(attribute)
    if (value === undefined || (value !== null && /^[1-9]\d*$/.test(value))) return []
    return [{ file, reason: `<${name}> ${attribute} must be a positive integer` }]
  })
}

export function validateBooleanAttributes(file, attributes, names) {
  return names.flatMap(name => {
    const value = attributes.get(name)
    if (value === undefined || value === null || value === '' || value === name) return []
    return [{ file, reason: `${name} must be a boolean HTML attribute` }]
  })
}

export function validateEnumAttribute(file, element, attributes, name, allowed) {
  const value = attributes.get(name)
  if (value === undefined || (value !== null && allowed.includes(value))) return []
  return [{ file, reason: `<${element}> ${name} has an unsafe value` }]
}

export function normalizedAttribute(attributes, name) {
  const value = attributes.get(name)
  if (value === undefined || value === null) return value
  return decodeHtmlAttribute(value)
}

export function hasTextAttribute(attributes, name) {
  const value = attributes.get(name)
  return typeof value === 'string' && value.trim().length > 0
}

export function splitTokens(value) {
  return value.split(/\s+/).filter(Boolean)
}

function decodeHtmlAttribute(value) {
  let decoded = value
  while (true) {
    const next = decoded.replace(HTML_ENTITY_PATTERN, decodeHtmlEntity)
    if (next === decoded) break
    decoded = next
  }
  return UNKNOWN_HTML_ENTITY_PATTERN.test(decoded) ? null : decoded
}

function decodeHtmlEntity(entity) {
  const normalized = entity.toLowerCase()
  const named = {
    '&amp;': '&',
    '&apos;': "'",
    '&colon;': ':',
    '&gt;': '>',
    '&lt;': '<',
    '&quot;': '"',
  }[normalized]
  if (named !== undefined) return named
  const radix = normalized.startsWith('&#x') ? 16 : 10
  const end = normalized.endsWith(';') ? -1 : undefined
  const digits = normalized.slice(radix === 16 ? 3 : 2, end)
  const codePoint = Number.parseInt(digits, radix)
  return Number.isSafeInteger(codePoint) && codePoint <= 0x10ffff
    ? String.fromCodePoint(codePoint)
    : entity
}
