import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'vitest'

const isTrustedTestAsset = (source: string) => {
  try {
    const url = new URL(source)
    return url.protocol === 'https:'
      && !url.username
      && !url.password
      && (url.hostname.endsWith('.notion.so') || url.hostname.endsWith('.amazonaws.com'))
  } catch {
    return false
  }
}

test('finds and rewrites standard images and enhanced media', async () => {
  const { rewriteMarkdownAssets } = await import('./index.ts')
  const source = [
    '![Desk](https://example.com/desk.png)',
    '<file src="https://example.com/notes.pdf">Notes</file>',
  ].join('\n')

  const result = await rewriteMarkdownAssets(
    source,
    reference => Promise.resolve(reference.kind === 'image'
      ? './images/desk.webp'
      : '[Notes](./assets/notes.pdf)'),
  )

  assert.equal(
    result,
    '![Desk](./images/desk.webp)\n[Notes](./assets/notes.pdf)',
  )
})

test('downloads Notion images to content-hashed WebP files', async ({ onTestFinished }) => {
  const outputDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'notion-assets-'))
  onTestFinished(() => fs.rm(outputDirectory, { recursive: true, force: true }))
  const onePixelPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  )
  const fetcher = () => Promise.resolve(new Response(onePixelPng, {
    status: 200,
    headers: {
      'content-length': String(onePixelPng.byteLength),
      'content-type': 'image/png',
    },
  }))
  const { createMarkdownAssetMaterializer } = await import('./index.ts')
  const materialize = createMarkdownAssetMaterializer(outputDirectory, {
    fetcher: fetcher,
    isTrustedSource: isTrustedTestAsset,
  })

  const result = await materialize('![Pixel](https://files.notion.so/pixel.png)')
  const localPath = (/\.\/images\/([a-f\d]+\.webp)/.exec(result))?.[1]

  assert.ok(localPath)
  assert.ok((await fs.stat(path.join(outputDirectory, 'images', localPath))).size > 0)
})

test('does not rewrite image syntax inside code fences', async () => {
  const { rewriteMarkdownAssets } = await import('./index.ts')
  const source = '```md\n![Example](https://example.com/image.png)\n```'
  let rewrites = 0

  const result = await rewriteMarkdownAssets(source, () => {
    rewrites += 1
    return Promise.resolve('./images/replaced.webp')
  })

  assert.equal(result, source)
  assert.equal(rewrites, 0)
})

test('does not rewrite enhanced media inside code fences', async () => {
  const { rewriteMarkdownAssets } = await import('./index.ts')
  const source = '```html\n<audio src="https://files.notion.so/audio">Example</audio>\n```'
  let rewrites = 0

  const result = await rewriteMarkdownAssets(source, () => {
    rewrites += 1
    return Promise.resolve('replaced')
  })

  assert.equal(result, source)
  assert.equal(rewrites, 0)
})

test('does not rewrite enhanced media inside inline code', async () => {
  const { rewriteMarkdownAssets } = await import('./index.ts')
  const source = 'Use `<audio src="file://private">Example</audio>` in imported markup.'
  let rewrites = 0

  const result = await rewriteMarkdownAssets(source, () => {
    rewrites += 1
    return Promise.resolve('replaced')
  })

  assert.equal(result, source)
  assert.equal(rewrites, 0)
})

test('renders stable public HTTPS media without downloading it', async () => {
  const { createMarkdownAssetMaterializer } = await import('./index.ts')
  let fetches = 0
  const materialize = createMarkdownAssetMaterializer('/unused', {
    fetcher: () => {
      fetches += 1
      return Promise.resolve(new Response())
    },
  })

  const result = await materialize([
    '<file src="https://example.com/report.pdf">[Report]</file>',
    '<audio src="https://example.com/episode.mp3">Episode & notes</audio>',
    '<video src="https://example.com/demo.mp4">Local preview</video>',
  ].join('\n'))

  assert.equal(result, [
    '[\\[Report\\]](https://example.com/report.pdf)',
    '<audio src="https://example.com/episode.mp3" controls preload="metadata">Episode &amp; notes</audio>',
    '<video src="https://example.com/demo.mp4" controls preload="metadata">Local preview</video>',
  ].join('\n'))
  assert.equal(fetches, 0)
})

test('labels public file links from their URL or media kind', async () => {
  const { createMarkdownAssetMaterializer } = await import('./index.ts')
  const materialize = createMarkdownAssetMaterializer('/unused', {})

  const result = await materialize([
    '<file src="https://example.com/report.pdf"></file>',
    '<file src="https://example.com/"></file>',
    '<pdf src="https://example.com/"></pdf>',
  ].join('\n'))

  assert.equal(result, [
    '[report.pdf](https://example.com/report.pdf)',
    '[Download file](https://example.com/)',
    '[pdf](https://example.com/)',
  ].join('\n'))
})

test('rejects local non-image media because Astro does not deploy it', async () => {
  const { createMarkdownAssetMaterializer } = await import('./index.ts')
  const materialize = createMarkdownAssetMaterializer('/unused', {})

  await assert.rejects(
    materialize('<audio src="./assets/episode.mp3">Episode</audio>'),
    /public HTTPS URL/,
  )
})

test('rejects insecure remote images without downloading them', async () => {
  const { createMarkdownAssetMaterializer } = await import('./index.ts')
  let fetches = 0
  const materialize = createMarkdownAssetMaterializer('/unused', {
    fetcher: () => {
      fetches += 1
      return Promise.resolve(new Response())
    },
  })

  await assert.rejects(
    materialize('![Remote](http://127.0.0.1/private.png)'),
    /HTTPS/,
  )
  assert.equal(fetches, 0)
})

test('rejects redirects from trusted storage to an untrusted host', async () => {
  const { createMarkdownAssetMaterializer } = await import('./index.ts')
  const materialize = createMarkdownAssetMaterializer('/unused', {
    fetcher: () => Promise.resolve(new Response(null, {
      status: 302,
      headers: { location: 'http://127.0.0.1/private.png' },
    })),
    isTrustedSource: isTrustedTestAsset,
  })

  await assert.rejects(
    materialize('![Remote](https://files.notion.so/image.png)'),
    /untrusted asset URL/,
  )
})

test('renders YouTube videos with a privacy-preserving embed', async () => {
  const { createMarkdownAssetMaterializer } = await import('./index.ts')
  const materialize = createMarkdownAssetMaterializer('/unused', {})

  const result = await materialize(
    '<video src="https://youtu.be/video-id">Demo &amp; discussion</video>',
  )

  assert.match(result, /youtube-nocookie\.com\/embed\/video-id/)
  assert.match(result, /title="Demo &amp;amp; discussion"/)
  assert.match(result, /referrerpolicy="no-referrer"/)
  assert.match(result, /sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"/)

  const standardUrl = await materialize(
    '<video src="https://www.youtube.com/watch?v=second-id"></video>',
  )
  assert.match(standardUrl, /youtube-nocookie\.com\/embed\/second-id/)
})

test('rejects transient non-image assets without downloading them', async ({ onTestFinished }) => {
  const outputDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'notion-media-'))
  onTestFinished(() => fs.rm(outputDirectory, { recursive: true, force: true }))
  let fetches = 0
  const materialize = (await import('./index.ts')).createMarkdownAssetMaterializer(
    outputDirectory,
    {
      fetcher: () => {
        fetches += 1
        return Promise.resolve(new Response('media'))
      },
      isTrustedSource: isTrustedTestAsset,
    },
  )

  const references = [
    '<audio src="https://files.notion.so/audio">Episode</audio>',
    '<video src="https://s3.amazonaws.com/video">Demo</video>',
    '<file src="https://files.notion.so/slides.deck"></file>',
    '<pdf src="https://files.notion.so/slides.pdf">Slides PDF</pdf>',
  ]

  for (const reference of references) {
    await assert.rejects(materialize(reference), /stable public HTTPS URL/)
  }
  assert.equal(fetches, 0)
  await assert.rejects(fs.access(path.join(outputDirectory, 'assets')))
})

test('resolves Notion file references before rejecting transient files', async () => {
  const source = `file://${encodeURIComponent(JSON.stringify({
    permissionRecord: { id: 'block-1' },
  }))}`
  let fetches = 0
  const materialize = (await import('./index.ts')).createMarkdownAssetMaterializer(
    '/unused',
    {
      fetcher: () => {
        fetches += 1
        return Promise.resolve(new Response('slides'))
      },
      isTrustedSource: isTrustedTestAsset,
      resolveSource: value => Promise.resolve(value === source
        ? 'https://files.notion.so/slides'
        : value),
    },
  )

  await assert.rejects(
    materialize(`<file src="${source}">Slides</file>`),
    /stable public HTTPS URL/,
  )
  assert.equal(fetches, 0)
})

test('rejects failed and oversized asset downloads', async () => {
  const { createMarkdownAssetMaterializer } = await import('./index.ts')
  const materializeWith = (response: Response) => createMarkdownAssetMaterializer(
    '/unused',
    {
      fetcher: () => Promise.resolve(response),
      isTrustedSource: isTrustedTestAsset,
    },
  )

  await assert.rejects(
    materializeWith(new Response('', { status: 503 }))(
      '![Unavailable](https://files.notion.so/unavailable.png)',
    ),
    /HTTP 503/,
  )
  await assert.rejects(
    materializeWith(new Response('', {
      headers: { 'content-length': String(51 * 1024 * 1024) },
    }))('![Large](https://files.notion.so/large.png)'),
    /exceeds the 50 MiB sync limit/,
  )
})

test('rejects protocol-relative media and redacts signed URLs from failures', async () => {
  const { createMarkdownAssetMaterializer } = await import('./index.ts')
  const materialize = createMarkdownAssetMaterializer('/unused', {
    fetcher: () => Promise.resolve(new Response('', { status: 503 })),
    isTrustedSource: isTrustedTestAsset,
  })

  await assert.rejects(
    materialize('<video src="//attacker.example/video.mp4">Demo</video>'),
    /HTTPS/,
  )

  const signedUrl = 'https://files.notion.so/private.png?X-Amz-Signature=private-value'
  await assert.rejects(
    materialize(`![Private](${signedUrl})`),
    error => error instanceof Error
      && error.message.includes('HTTP 503')
      && !error.message.includes('private-value')
      && !error.message.includes('X-Amz'),
  )
})

test('rejects excessive asset references before resolving their sources', async () => {
  const { createMarkdownAssetMaterializer } = await import('./index.ts')
  let resolutions = 0
  const materialize = createMarkdownAssetMaterializer('/unused', {
    resolveSource: (source) => {
      resolutions += 1
      return Promise.resolve(source)
    },
  })
  const markdown = Array.from(
    { length: 101 },
    (_, index) => `![Asset ${String(index)}](https://example.com/${String(index)}.png)`,
  ).join('\n')

  await assert.rejects(materialize(markdown), /more than 100 asset references/)
  assert.equal(resolutions, 0)
})

test('limits concurrent asset downloads', async ({ onTestFinished }) => {
  const outputDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'asset-concurrency-'))
  onTestFinished(() => fs.rm(outputDirectory, { recursive: true, force: true }))
  let activeDownloads = 0
  let maximumActiveDownloads = 0
  const onePixelPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  )
  const fetcher = async () => {
    activeDownloads += 1
    maximumActiveDownloads = Math.max(maximumActiveDownloads, activeDownloads)
    await new Promise(resolve => setTimeout(resolve, 20))
    activeDownloads -= 1
    return new Response(onePixelPng, { headers: { 'content-type': 'image/png' } })
  }
  const materialize = (await import('./index.ts')).createMarkdownAssetMaterializer(
    outputDirectory,
    {
      fetcher: fetcher,
      isTrustedSource: isTrustedTestAsset,
    },
  )
  const markdown = Array.from(
    { length: 8 },
    (_, index) => `![Asset](https://files.notion.so/${String(index)}.png)`,
  ).join('\n')

  await materialize(markdown)

  assert.equal(maximumActiveDownloads, 4)
})

test('shares the download limit across concurrently exported documents', async ({
  onTestFinished,
}) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'asset-session-concurrency-'))
  onTestFinished(() => fs.rm(root, { recursive: true, force: true }))
  let activeDownloads = 0
  let maximumActiveDownloads = 0
  const onePixelPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  )
  const fetcher = async () => {
    activeDownloads += 1
    maximumActiveDownloads = Math.max(maximumActiveDownloads, activeDownloads)
    await new Promise(resolve => setTimeout(resolve, 20))
    activeDownloads -= 1
    return new Response(onePixelPng, { headers: { 'content-type': 'image/png' } })
  }
  const assets = await import('./index.ts')
  const session = assets.createMarkdownAssetMaterializationSession()
  const materializers = ['first', 'second'].map(document => (
    assets.createMarkdownAssetMaterializer(path.join(root, document), {
      fetcher,
      isTrustedSource: isTrustedTestAsset,
      session,
    })
  ))

  await Promise.all(materializers.map((materialize, document) => materialize(
    Array.from(
      { length: 4 },
      (_, index) => `![Asset](https://files.notion.so/${String(document)}-${String(index)}.png)`,
    ).join('\n'),
  )))

  assert.equal(maximumActiveDownloads, 4)
})

test('rejects downloads exceeding the aggregate byte budget', async ({ onTestFinished }) => {
  const outputDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'asset-budget-'))
  onTestFinished(() => fs.rm(outputDirectory, { recursive: true, force: true }))
  const onePixelPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  )
  const materialize = (await import('./index.ts')).createMarkdownAssetMaterializer(
    outputDirectory,
    {
      fetcher: () => Promise.resolve(new Response(onePixelPng, {
        headers: {
          'content-length': String(41 * 1024 * 1024),
          'content-type': 'image/png',
        },
      })),
      isTrustedSource: isTrustedTestAsset,
    },
  )
  const markdown = Array.from(
    { length: 5 },
    (_, index) => `![Asset](https://files.notion.so/${String(index)}.png)`,
  ).join('\n')

  await assert.rejects(materialize(markdown), /200 MiB aggregate sync limit/)
})

test('shares the byte budget across exported documents', async ({ onTestFinished }) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'asset-session-budget-'))
  onTestFinished(() => fs.rm(root, { recursive: true, force: true }))
  const onePixelPng = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  )
  const assets = await import('./index.ts')
  const session = assets.createMarkdownAssetMaterializationSession()
  const createMaterializer = (document: string) => assets.createMarkdownAssetMaterializer(
    path.join(root, document),
    {
      fetcher: () => Promise.resolve(new Response(onePixelPng, {
        headers: {
          'content-length': String(41 * 1024 * 1024),
          'content-type': 'image/png',
        },
      })),
      isTrustedSource: isTrustedTestAsset,
      session,
    },
  )

  await createMaterializer('first')([
    '![One](https://files.notion.so/one.png)',
    '![Two](https://files.notion.so/two.png)',
    '![Three](https://files.notion.so/three.png)',
  ].join('\n'))

  await assert.rejects(createMaterializer('second')([
    '![Four](https://files.notion.so/four.png)',
    '![Five](https://files.notion.so/five.png)',
  ].join('\n')), /200 MiB aggregate sync limit/)
})
