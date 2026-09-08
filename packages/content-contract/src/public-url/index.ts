const LOCAL_URL_BASE = new URL('https://local.invalid/base/')
const URL_SCHEME_PATTERN = /^[a-z][a-z\d+.-]*:/i
const NETWORK_PATH_PATTERN = /^[\\/]{2}/
const SENSITIVE_QUERY_PARAMETER = /^(?:access[-_]?token|api[-_]?key|auth(?:orization)?|client[-_]?secret|credential|googleaccessid|jwt|key[-_]?pair[-_]?id|password|policy|secret|security[-_]?token|sig|signature|token|x-amz-.+|x-goog-.+)$/i

export function isPublicHttpsUrl(value: string): boolean {
  const url = parseSecureHttpsUrl(value)
  return url !== null && !hasSensitiveUrlDetails(url)
}

export function parseSecureHttpsUrl(value: string): URL | null {
  const url = parseUrl(value)
  if (url?.protocol !== 'https:' || url.username || url.password) return null
  return url
}

export function isPublicLocalUrl(value: string): boolean {
  const url = parseLocalUrl(value)
  return url !== null && !hasSensitiveUrlDetails(url)
}

export function isRootRelativePublicUrl(value: string): boolean {
  return value.startsWith('/') && isPublicLocalUrl(value)
}

export function isPublicUrl(value: string): boolean {
  return isPublicLocalUrl(value) || isPublicHttpsUrl(value)
}

export function requirePublicHttpsUrl(value: string, label: string): string {
  const url = parseSecureHttpsUrl(value)
  if (url && !hasSensitiveUrlDetails(url)) return url.href
  throw new Error(`${label} must be a public HTTPS URL without credentials`)
}

export function requirePublicUrl(value: string, label: string): string {
  if (isPublicUrl(value)) return value
  throw new Error(`${label} must be a public HTTPS or local URL without credentials`)
}

export function hasSensitiveUrlDetails(url: URL): boolean {
  if (url.username || url.password) return true
  return [...url.searchParams].some(hasSensitiveQueryEntry)
}

function parseLocalUrl(value: string): URL | null {
  if (!isLocalUrlSyntax(value)) return null
  const url = parseUrl(value, LOCAL_URL_BASE)
  return url?.origin === LOCAL_URL_BASE.origin ? url : null
}

function parseUrl(value: string, base?: URL): URL | null {
  try {
    return new URL(value, base)
  } catch {
    return null
  }
}

function isLocalUrlSyntax(value: string): boolean {
  return value.length > 0
    && value.trim() === value
    && !NETWORK_PATH_PATTERN.test(value)
    && !URL_SCHEME_PATTERN.test(value)
}

function hasSensitiveQueryEntry([name, value]: [string, string]): boolean {
  return decodedValues(name).some(candidate => SENSITIVE_QUERY_PARAMETER.test(candidate))
    || decodedValues(value).some(hasSensitiveNestedUrl)
}

function hasSensitiveNestedUrl(value: string): boolean {
  const nestedUrl = parseNestedUrl(value)
  return nestedUrl !== null && hasSensitiveUrlDetails(nestedUrl)
}

function parseNestedUrl(value: string): URL | null {
  return parseUrl(value, LOCAL_URL_BASE)
}

function decodedValues(value: string): string[] {
  const values = [value]
  let current = value
  let decoded = decodeValue(current)

  while (decoded !== null && decoded !== current) {
    values.push(decoded)
    current = decoded
    decoded = decodeValue(current)
  }
  return values
}

function decodeValue(value: string): string | null {
  try {
    return decodeURIComponent(value)
  } catch {
    return null
  }
}
