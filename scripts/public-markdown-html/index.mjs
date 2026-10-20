import {
  validateAllowedAttributes,
  validateBooleanAttributes,
  validateEnumAttribute,
} from './attributes.mjs'
import { findRawHtmlTags } from './html-parser.mjs'
import { maskMarkdownCode } from './markdown-code.mjs'
import { MEDIA_ELEMENTS, validateMediaTag } from './media-validator.mjs'

const SAFE_TEXT_ELEMENTS = new Set([
  'abbr', 'br', 'caption', 'cite', 'details', 'figcaption', 'figure', 'hr', 'kbd', 'mark',
  'picture', 'small', 'sub', 'summary', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th',
  'thead', 'tr',
])
const DETAILS_ATTRIBUTES = new Set(['open'])
const TABLE_CELL_ATTRIBUTES = new Set(['colspan', 'rowspan'])
const TABLE_HEADER_ATTRIBUTES = new Set([...TABLE_CELL_ATTRIBUTES, 'scope'])

export function checkPublicMarkdownHtml(file, markdown) {
  const tags = findRawHtmlTags(maskMarkdownCode(markdown))
  return deduplicateViolations(tags.flatMap(tag => validateTag(file, tag)))
}

function validateTag(file, tag) {
  if (tag.kind === 'declaration') {
    return [{ file, reason: 'HTML declarations are not allowed' }]
  }
  if (!SAFE_TEXT_ELEMENTS.has(tag.name) && !MEDIA_ELEMENTS.has(tag.name)) {
    return [{ file, reason: `disallowed raw HTML element <${tag.name}>` }]
  }
  if (tag.closing) return validateClosingTag(file, tag)
  if (tag.attributes === null) {
    return [{ file, reason: `malformed attributes on <${tag.name}>` }]
  }

  const violations = []
  const eventAttribute = [...tag.attributes.keys()].find(name => name.startsWith('on'))
  if (eventAttribute) {
    violations.push({
      file,
      reason: `event handler ${eventAttribute} is not allowed on <${tag.name}>`,
    })
  }
  return MEDIA_ELEMENTS.has(tag.name)
    ? [...violations, ...validateMediaTag(file, tag.name, tag.attributes)]
    : [...violations, ...validateTextAttributes(file, tag.name, tag.attributes)]
}

function validateClosingTag(file, tag) {
  if (tag.attributes?.size === 0) return []
  return [{ file, reason: `closing <${tag.name}> must not have attributes` }]
}

function validateTextAttributes(file, name, attributes) {
  if (name === 'details') {
    return [
      ...validateAllowedAttributes(file, name, attributes, DETAILS_ATTRIBUTES),
      ...validateBooleanAttributes(file, attributes, ['open']),
    ]
  }
  if (name === 'td') {
    return validateAllowedAttributes(file, name, attributes, TABLE_CELL_ATTRIBUTES)
  }
  if (name === 'th') {
    return [
      ...validateAllowedAttributes(file, name, attributes, TABLE_HEADER_ATTRIBUTES),
      ...validateEnumAttribute(file, name, attributes, 'scope', ['col', 'colgroup', 'row', 'rowgroup']),
    ]
  }
  if (attributes.size === 0) return []
  return [{ file, reason: `<${name}> does not allow attributes` }]
}

function deduplicateViolations(violations) {
  return violations.filter((violation, index) =>
    violations.findIndex(candidate => candidate.reason === violation.reason) === index,
  )
}
