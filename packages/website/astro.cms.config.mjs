import { defineConfig } from 'astro/config'
import base from './astro.config.mjs'
import { readFileSync } from 'node:fs'

export default defineConfig({
  ...base,
  cacheDir: './.astro/cms-trial',
  devToolbar: { enabled: false },
  vite: {
    ...base.vite,
    cacheDir: './.astro/cms-trial/vite',
    define: {
      'import.meta.env.CMS_TRIAL_ORIGIN': JSON.stringify(`${process.env.CMS_TRIAL_HOST ? 'https' : 'http'}://${process.env.CMS_TRIAL_HOST ?? '127.0.0.1'}:4010`),
    },
    server: {
      ...base.vite?.server,
      strictPort: true,
      https: process.env.CMS_TRIAL_CERT ? {
        cert: readFileSync(process.env.CMS_TRIAL_CERT),
        key: readFileSync(process.env.CMS_TRIAL_KEY),
      } : undefined,
    },
    optimizeDeps: { include: [...base.vite.optimizeDeps.include, '@payloadcms/live-preview'] },
  },
  integrations: [
    ...(base.integrations ?? []),
    {
      name: 'local-cms-preview',
      hooks: {
        'astro:config:setup': ({ command, injectRoute }) => {
          if (command !== 'dev') throw new Error('The CMS trial is local-only. Use the normal config for production builds.')
          injectRoute({ pattern: '/cms-preview/[id]', entrypoint: './src/cms-preview/page.astro', prerender: false })
          for (const kind of ['talks', 'podcasts']) {
            injectRoute({ pattern: `/${kind}/cms-preview/[filename]`, entrypoint: './src/cms-preview/media.ts', prerender: false })
          }
        },
      },
    },
  ],
})
