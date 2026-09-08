import fs from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'

const MIME_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.usdz', 'model/vnd.usdz+zip'],
  ['.webp', 'image/webp'],
  ['.woff2', 'font/woff2'],
  ['.xml', 'application/xml; charset=utf-8'],
])

function getFilePath(root, requestUrl = '/') {
  const pathname = decodeURIComponent(new URL(requestUrl, 'http://localhost').pathname)
  const hasExtension = path.extname(pathname) !== ''
  const relativePath = pathname.endsWith('/')
    ? `${pathname}index.html`
    : hasExtension ? pathname : `${pathname}/index.html`
  const filePath = path.resolve(root, `.${relativePath}`)
  return filePath.startsWith(`${root}${path.sep}`) ? filePath : null
}

function send(response, status, body, contentType = 'text/plain; charset=utf-8') {
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
    'Content-Type': contentType,
  })
  response.end(body)
}

async function serveRequest(root, request, response) {
  const filePath = getFilePath(root, request.url)
  if (filePath === null) return send(response, 400, 'Bad request')

  try {
    const body = await fs.readFile(filePath)
    const contentType = MIME_TYPES.get(path.extname(filePath)) ?? 'application/octet-stream'
    send(response, 200, body, contentType)
  } catch (error) {
    if (error?.code === 'ENOENT') return send(response, 404, 'Not found')
    send(response, 500, 'Internal server error')
  }
}

export async function startStaticServer(directory) {
  const root = path.resolve(directory)
  const server = http.createServer((request, response) => {
    void serveRequest(root, request, response)
  })

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })

  const address = server.address()
  if (address === null || typeof address === 'string') {
    throw new Error('Could not determine the performance server port.')
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve())
    }),
  }
}
