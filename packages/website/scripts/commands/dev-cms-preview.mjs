import { dev } from 'astro'

const server = await dev({
  configFile: './astro.cms.config.mjs',
  server: { host: process.env.CMS_TRIAL_HOST ?? '127.0.0.1', port: 4324 },
})

process.on('SIGINT', () => { void server.stop() })
process.on('SIGTERM', () => { void server.stop() })
