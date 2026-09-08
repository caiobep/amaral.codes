export interface AssetFetcher {
  fetch(request: Request): Promise<Response>
}

interface AgentMarkdownEnvironment {
  ASSETS: AssetFetcher
}

const MARKDOWN_CONTENT_TYPE = 'text/markdown; charset=utf-8'
const SUPPORTED_METHODS = new Set(['GET', 'HEAD'])
const LLMS_LINK = '</llms.txt>; rel="describedby"'

function getMediaQuality(accept: string, mediaType: string): number | undefined {
  const matchingItems = accept.split(',').filter((item) => (
    item.trim().toLowerCase().split(';', 1)[0] === mediaType
  ))
  if (matchingItems.length === 0) return undefined

  return Math.max(...matchingItems.map((item) => {
    const quality = /(?:^|;)\s*q=([01](?:\.\d+)?)/iu.exec(item)?.[1]
    return quality === undefined ? 1 : Number.parseFloat(quality)
  }))
}

export function prefersMarkdown(accept: string | null): boolean {
  if (!accept) return false
  const markdownQuality = getMediaQuality(accept, 'text/markdown')
  const htmlQuality = getMediaQuality(accept, 'text/html') ?? 0
  return markdownQuality !== undefined && markdownQuality > 0 && markdownQuality >= htmlQuality
}

export function getMarkdownAssetPath(pathname: string): string | undefined {
  const slug = /^\/posts\/([^/]+)\/?$/u.exec(pathname)?.[1]
  if (!slug || slug.endsWith('.md')) return undefined
  return `/posts/${slug}.md`
}

function appendVaryAccept(headers: Headers): void {
  const vary = headers.get('Vary')
  if (!vary) {
    headers.set('Vary', 'Accept')
    return
  }
  if (vary === '*' || vary.toLowerCase().split(',').some((value) => value.trim() === 'accept')) return
  headers.set('Vary', `${vary}, Accept`)
}

function appendLink(headers: Headers, value: string): void {
  const link = headers.get('Link')
  headers.set('Link', link ? `${link}, ${value}` : value)
}

function copyResponse(response: Response, updateHeaders: (headers: Headers) => void): Response {
  const headers = new Headers(response.headers)
  updateHeaders(headers)
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  })
}

function withHtmlDiscovery(response: Response, markdownPath: string): Response {
  if (!response.ok) return response

  return copyResponse(response, (headers) => {
    appendVaryAccept(headers)
    appendLink(headers, `<${markdownPath}>; rel="alternate"; type="text/markdown"`)
    appendLink(headers, LLMS_LINK)
  })
}

function asMarkdownResponse(response: Response, markdownPath: string): Response {
  if (!response.ok) return response

  return copyResponse(response, (headers) => {
    appendVaryAccept(headers)
    appendLink(headers, `<${markdownPath.replace(/\.md$/u, '')}>; rel="canonical"; type="text/html"`)
    appendLink(headers, LLMS_LINK)
    headers.set('Content-Location', markdownPath)
    headers.set('Content-Type', MARKDOWN_CONTENT_TYPE)
  })
}

function createAssetRequest(request: Request, pathname: string): Request {
  const url = new URL(request.url)
  url.pathname = pathname
  url.search = ''
  return new Request(url, {
    headers: request.headers,
    method: request.method,
  })
}

export async function handleAgentMarkdownRequest(
  request: Request,
  environment: AgentMarkdownEnvironment,
): Promise<Response> {
  const { pathname } = new URL(request.url)

  if (pathname.endsWith('.md')) {
    const response = await environment.ASSETS.fetch(request)
    return asMarkdownResponse(response, pathname)
  }

  const markdownPath = getMarkdownAssetPath(pathname)
  if (!markdownPath || !SUPPORTED_METHODS.has(request.method)) {
    return environment.ASSETS.fetch(request)
  }

  if (prefersMarkdown(request.headers.get('Accept'))) {
    const markdownRequest = createAssetRequest(request, markdownPath)
    const markdownResponse = await environment.ASSETS.fetch(markdownRequest)
    if (markdownResponse.ok) return asMarkdownResponse(markdownResponse, markdownPath)
  }

  return withHtmlDiscovery(await environment.ASSETS.fetch(request), markdownPath)
}
