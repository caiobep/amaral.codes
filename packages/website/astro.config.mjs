import { defineConfig } from 'astro/config'

import sitemap from '@astrojs/sitemap'
import { shouldIncludeInSitemap } from './scripts/sitemap-filter/index.mjs'

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

const contemporaryEditorialCodeTheme = {
  name: 'contemporary-editorial',
  type: 'dark',
  colors: {
    'editor.background': '#151719',
    'editor.foreground': '#F2F5EF',
  },
  tokenColors: [
    {
      scope: ['comment', 'punctuation.definition.comment'],
      settings: {
        foreground: '#7D8780',
        fontStyle: 'italic',
      },
    },
    {
      scope: ['keyword', 'storage', 'storage.type', 'support.type'],
      settings: {
        foreground: '#FF7A63',
      },
    },
    {
      scope: ['string', 'constant.other.symbol'],
      settings: {
        foreground: '#82D9A4',
      },
    },
    {
      scope: ['constant.numeric', 'constant.language', 'variable.language'],
      settings: {
        foreground: '#AAB9FF',
      },
    },
    {
      scope: ['entity.name.function', 'support.function', 'variable.function'],
      settings: {
        foreground: '#90A7FF',
      },
    },
    {
      scope: ['entity.name.type', 'entity.name.class', 'support.class'],
      settings: {
        foreground: '#B6D5C1',
      },
    },
    {
      scope: ['entity.name.tag', 'punctuation.definition.tag'],
      settings: {
        foreground: '#FF7A63',
      },
    },
    {
      scope: ['entity.other.attribute-name', 'variable.parameter'],
      settings: {
        foreground: '#AAB9FF',
      },
    },
  ],
}

export default defineConfig({
  site: 'https://amaral.codes',
  integrations: [
    sitemap({ filter: shouldIncludeInSitemap }),
  ],
  vite: {
    server: {
      fs: {
        deny: ['.env', '.env.*', '*.{crt,pem,key,p12,pfx,cer,der}', '.npmrc', '.yarnrc.yml', '**/.git/**', '**/.local/**', '**/.next/**'],
      },
    },
    optimizeDeps: {
      include: ['pdfjs-dist'],
    },
    plugins: [usdzMimeTypePlugin],
  },
  markdown: {
    shikiConfig: {
      theme: contemporaryEditorialCodeTheme,
    },
  },
})
