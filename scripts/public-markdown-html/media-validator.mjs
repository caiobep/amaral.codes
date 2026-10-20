import {
  isPublicHttpsUrl,
  isPublicUrl,
} from '@amaral.codes/content-contract/public-url'
import {
  hasTextAttribute,
  normalizedAttribute,
  splitTokens,
  validateAllowedAttributes,
  validateBooleanAttributes,
  validateDimensions,
  validateEnumAttribute,
} from './attributes.mjs'

export const MEDIA_ELEMENTS = new Set(['audio', 'iframe', 'img', 'source', 'track', 'video'])

const AUDIO_ATTRIBUTES = new Set(['controls', 'loop', 'muted', 'preload', 'src'])
const IFRAME_ATTRIBUTES = new Set([
  'allow', 'allowfullscreen', 'height', 'loading', 'referrerpolicy', 'sandbox',
  'src', 'title', 'width',
])
const IFRAME_SANDBOX_TOKENS = new Set([
  'allow-popups', 'allow-presentation', 'allow-same-origin', 'allow-scripts',
])
const IFRAME_FEATURES = new Set([
  'accelerometer', 'autoplay', 'clipboard-write', 'encrypted-media', 'fullscreen', 'gyroscope',
  'picture-in-picture', 'web-share',
])
const IMAGE_ATTRIBUTES = new Set([
  'alt', 'decoding', 'fetchpriority', 'height', 'loading', 'referrerpolicy', 'sizes',
  'src', 'srcset', 'width',
])
const VIDEO_ATTRIBUTES = new Set([
  'controls', 'height', 'loop', 'muted', 'playsinline', 'poster', 'preload', 'src',
  'width',
])
const SOURCE_ATTRIBUTES = new Set(['media', 'src', 'type'])
const TRACK_ATTRIBUTES = new Set(['default', 'kind', 'label', 'src', 'srclang'])

export function validateMediaTag(file, name, attributes) {
  if (name === 'iframe') return validateIframe(file, attributes)
  if (name === 'img') return validateImage(file, attributes)
  if (name === 'audio') return validateAudio(file, attributes)
  if (name === 'video') return validateVideo(file, attributes)
  if (name === 'track') {
    return [
      ...validateSource(file, attributes, name, TRACK_ATTRIBUTES),
      ...validateBooleanAttributes(file, attributes, ['default']),
    ]
  }
  return validateSource(file, attributes)
}

function validateIframe(file, attributes) {
  const violations = validateAllowedAttributes(file, 'iframe', attributes, IFRAME_ATTRIBUTES)
  const src = normalizedAttribute(attributes, 'src')
  if (src === null || !isPublicHttpsUrl(src)) {
    violations.push({ file, reason: '<iframe> src must be a credential-free HTTPS URL' })
  }
  if (!hasTextAttribute(attributes, 'title')) {
    violations.push({ file, reason: '<iframe> requires a non-empty title' })
  }
  if (attributes.get('loading') !== 'lazy') {
    violations.push({ file, reason: '<iframe> loading must be lazy' })
  }
  if (attributes.get('referrerpolicy') !== 'no-referrer') {
    violations.push({ file, reason: '<iframe> referrerpolicy must be no-referrer' })
  }
  violations.push(...validateIframeSandbox(file, attributes))
  violations.push(...validateIframeFeatures(file, attributes))
  violations.push(...validateDimensions(file, 'iframe', attributes))
  violations.push(...validateBooleanAttributes(file, attributes, ['allowfullscreen']))
  return violations
}

function validateIframeSandbox(file, attributes) {
  const sandbox = attributes.get('sandbox')
  if (sandbox === undefined || sandbox === null) {
    return [{ file, reason: '<iframe> requires a sandbox attribute' }]
  }
  return splitTokens(sandbox).every(token => IFRAME_SANDBOX_TOKENS.has(token))
    ? []
    : [{ file, reason: '<iframe> uses an unsafe sandbox permission' }]
}

function validateIframeFeatures(file, attributes) {
  const allow = attributes.get('allow')
  if (allow === undefined) return []
  if (allow === null) return [{ file, reason: '<iframe> allow must list approved features' }]
  const features = allow.split(';').map(value => value.trim()).filter(Boolean)
  return features.length > 0 && features.every(feature => IFRAME_FEATURES.has(feature))
    ? []
    : [{ file, reason: '<iframe> allow contains an unapproved feature' }]
}

function validateImage(file, attributes) {
  const violations = validateAllowedAttributes(file, 'img', attributes, IMAGE_ATTRIBUTES)
  const src = normalizedAttribute(attributes, 'src')
  if (src === null || !isPublicUrl(src)) {
    violations.push({ file, reason: '<img> src must be a credential-free HTTPS or local URL' })
  }
  if (!attributes.has('alt') || attributes.get('alt') === null) {
    violations.push({ file, reason: '<img> requires alt text' })
  }
  violations.push(...validateImageSrcset(file, attributes))
  violations.push(...validateEnumAttribute(file, 'img', attributes, 'loading', ['eager', 'lazy']))
  violations.push(...validateEnumAttribute(file, 'img', attributes, 'decoding', ['async', 'auto', 'sync']))
  violations.push(...validateEnumAttribute(file, 'img', attributes, 'fetchpriority', ['auto', 'high', 'low']))
  violations.push(...validateEnumAttribute(file, 'img', attributes, 'referrerpolicy', ['no-referrer']))
  violations.push(...validateDimensions(file, 'img', attributes))
  return violations
}

function validateImageSrcset(file, attributes) {
  const srcset = normalizedAttribute(attributes, 'srcset')
  if (srcset === undefined) return []
  if (srcset !== null && srcset.split(',').every(isSafeSrcsetCandidate)) return []
  return [{ file, reason: '<img> srcset contains an unsafe URL or descriptor' }]
}

function isSafeSrcsetCandidate(candidate) {
  const parts = candidate.trim().split(/\s+/)
  if (parts.length < 1 || parts.length > 2 || !isPublicUrl(parts[0] ?? '')) return false
  const descriptor = parts[1]
  return descriptor === undefined || /^\d+w$/.test(descriptor) || /^\d+(?:\.\d+)?x$/.test(descriptor)
}

function validateVideo(file, attributes) {
  const violations = validateAllowedAttributes(file, 'video', attributes, VIDEO_ATTRIBUTES)
  const src = normalizedAttribute(attributes, 'src')
  const poster = normalizedAttribute(attributes, 'poster')
  if (src !== undefined && (src === null || !isPublicUrl(src))) {
    violations.push({ file, reason: '<video> src must be a credential-free HTTPS or local URL' })
  }
  if (poster !== undefined && (poster === null || !isPublicUrl(poster))) {
    violations.push({ file, reason: '<video> poster must be a credential-free HTTPS or local URL' })
  }
  violations.push(...validateEnumAttribute(file, 'video', attributes, 'preload', ['auto', 'metadata', 'none']))
  violations.push(...validateDimensions(file, 'video', attributes))
  violations.push(...validateBooleanAttributes(
    file,
    attributes,
    ['controls', 'loop', 'muted', 'playsinline'],
  ))
  return violations
}

function validateAudio(file, attributes) {
  const violations = validateAllowedAttributes(file, 'audio', attributes, AUDIO_ATTRIBUTES)
  const src = normalizedAttribute(attributes, 'src')
  if (src !== undefined && (src === null || !isPublicUrl(src))) {
    violations.push({ file, reason: '<audio> src must be a credential-free HTTPS or local URL' })
  }
  violations.push(...validateEnumAttribute(file, 'audio', attributes, 'preload', ['auto', 'metadata', 'none']))
  violations.push(...validateBooleanAttributes(file, attributes, ['controls', 'loop', 'muted']))
  return violations
}

function validateSource(file, attributes, name = 'source', allowed = SOURCE_ATTRIBUTES) {
  const violations = validateAllowedAttributes(file, name, attributes, allowed)
  const src = normalizedAttribute(attributes, 'src')
  if (typeof src !== 'string' || !isPublicUrl(src)) {
    violations.push({ file, reason: `<${name}> src must be a credential-free HTTPS or local URL` })
  }
  return violations
}
