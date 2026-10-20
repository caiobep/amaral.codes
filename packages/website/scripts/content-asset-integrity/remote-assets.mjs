import path from 'node:path'

const REMOTE_CHECK_TIMEOUT_MS = 10_000

export async function checkRemoteMaterial(reference, options) {
  const {
    fetcher,
    fileExists,
    formatPath = value => value,
    stagingRoot,
  } = options
  const remoteUrl = parseHttpsUrl(reference.url)
  if (!remoteUrl) return violation(reference, 'material URL must be public HTTPS')

  const remoteFailure = await checkRemoteAsset(remoteUrl.href, fetcher)
  if (!remoteFailure) return undefined

  const stagedPath = resolveStagedPath(remoteUrl, stagingRoot)
  const hasStagedSource = stagedPath ? await fileExists(stagedPath) : false
  const hint = hasStagedSource
    ? `staged source exists at ${formatPath(stagedPath)}; upload it and make the public URL reachable`
    : 'no staged source exists at the expected canonical path'
  return violation(reference, `${remoteFailure}; ${hint}`)
}

export function resolveContainedPath(root, relativePath) {
  const absoluteRoot = path.resolve(root)
  const candidate = path.resolve(absoluteRoot, relativePath)
  return candidate === absoluteRoot || candidate.startsWith(`${absoluteRoot}${path.sep}`)
    ? candidate
    : undefined
}

export function violation(reference, message) {
  return { ...reference, message }
}

async function checkRemoteAsset(url, fetcher) {
  let response
  try {
    response = await fetcher(url, {
      headers: { range: 'bytes=0-0' },
      redirect: 'follow',
      signal: AbortSignal.timeout(REMOTE_CHECK_TIMEOUT_MS),
    })
    return response.ok ? undefined : `public material returned HTTP ${String(response.status)}`
  } catch (error) {
    return `public material could not be reached (${describeError(error)})`
  } finally {
    await response?.body?.cancel()
  }
}

function parseHttpsUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password ? url : undefined
  } catch {
    return undefined
  }
}

function resolveStagedPath(url, stagingRoot) {
  try {
    return resolveContainedPath(stagingRoot, decodeURIComponent(url.pathname).replace(/^\/+/, ''))
  } catch {
    return undefined
  }
}

function describeError(error) {
  if (!(error instanceof Error)) return 'unknown error'
  const causeCode = readErrorCode(error.cause)
  return causeCode ? `${error.message}: ${causeCode}` : error.message
}

function readErrorCode(cause) {
  if (!cause || typeof cause !== 'object' || !('code' in cause)) return undefined
  return typeof cause.code === 'string' ? cause.code : undefined
}
