import { defineConfig } from 'astro/config'
import path from 'node:path'
import publishingEditor from '../../experiments/sveltia/integration.mjs'

import sitemap from '@astrojs/sitemap'
import { shouldIncludeInSitemap } from './scripts/sitemap-filter/index.mjs'
import { contemporaryEditorialCodeTheme } from './scripts/code-theme.mjs'
import richLinkCards from './scripts/link-cards/plugin.mjs'
import { satteri } from '@astrojs/markdown-satteri'

const cmsPreviewEnabled = process.env.AMARAL_CMS_PREVIEW === '1'
const cmsTrialEnabled = process.env.AMARAL_CMS_TRIAL === '1' || cmsPreviewEnabled

async function createCmsRuntime() {
  const [{ default: cloudflare }, { default: react }, { d1, r2 }, { default: emdash }] = await Promise.all([
    import('@astrojs/cloudflare'),
    import('@astrojs/react'),
    import('@emdash-cms/cloudflare'),
    import('emdash/astro'),
  ])
  return {
    output: 'server',
    devToolbar: { enabled: false },
    adapter: cloudflare({
      configPath: cmsPreviewEnabled ? 'wrangler.emdash-preview.jsonc' : 'wrangler.emdash-trial.jsonc',
      imageService: cmsPreviewEnabled ? 'compile' : 'cloudflare-binding',
      remoteBindings: false,
    }),
    integrations: [
      react(),
      emdash({
        database: d1({ binding: 'DB', session: 'disabled' }),
        storage: r2({ binding: 'MEDIA' }),
        plugins: [{
          id: 'amaral-publishing',
          version: '1.0.0',
          entrypoint: new URL('./src/lib/cms/publishing/plugin.ts', import.meta.url).pathname,
        }],
      }),
    ],
  }
}

const cmsRuntime = cmsTrialEnabled ? await createCmsRuntime() : { integrations: [] }

const setUsdzMimeType = (request, response, next) => {
  const pathname = request.url?.split('?', 1)[0]
  if (pathname?.endsWith('.usdz')) {
    response.setHeader('Content-Type', 'model/vnd.usdz+zip')
  }
  next()
}

const usdzMimeTypePlugin = {
  name: 'usdz-mime-type',
  configureServer(server) {
    server.middlewares.use(setUsdzMimeType)
  },
  configurePreviewServer(server) {
    server.middlewares.use(setUsdzMimeType)
  },
}

export default defineConfig({
  site: process.env.AMARAL_PUBLISHING_SITE ?? 'https://amaral.codes',
  ...(process.env.AMARAL_PUBLISHING_DIR ? {
    publicDir: path.join(process.env.AMARAL_PUBLISHING_DIR, 'public'),
    outDir: path.join(process.env.AMARAL_PUBLISHING_DIR, 'dist'),
  } : {}),
  ...cmsRuntime,
  image: cmsTrialEnabled ? { layout: 'constrained', responsiveStyles: true } : {
    service: { entrypoint: './scripts/images/intrinsic-size-service.mjs' },
  },
  integrations: [
    sitemap({ filter: shouldIncludeInSitemap }),
    ...cmsRuntime.integrations,
    ...(process.env.AMARAL_PUBLISHING_DIR ? [publishingEditor()] : []),
  ],
  vite: {
    define: {
      'import.meta.env.AMARAL_PUBLISHING': JSON.stringify(process.env.AMARAL_PUBLISHING_DIR ? '1' : '0'),
      'import.meta.env.AMARAL_CMS_TRIAL': JSON.stringify(cmsTrialEnabled ? '1' : '0'),
      'import.meta.env.AMARAL_CMS_OWNS_ENTRIES': JSON.stringify(
        cmsTrialEnabled && process.env.AMARAL_CONTENT_SOURCE === 'production' ? '1' : '0',
      ),
    },
    server: {
      fs: {
        deny: ['.env', '.env.*', '*.{crt,pem,key,p12,pfx,cer,der}', '.npmrc', '.yarnrc.yml', '**/.git/**', '**/.local/**', '**/.next/**', '**/.trial/**', '**/.wrangler/**', '**/.emdash/**'],
      },
    },
    optimizeDeps: {
      include: ['pdfjs-dist'],
    },
    plugins: [usdzMimeTypePlugin],
  },
  markdown: {
    processor: satteri({ hastPlugins: [richLinkCards()] }),
    shikiConfig: {
      theme: contemporaryEditorialCodeTheme,
    },
  },
})
