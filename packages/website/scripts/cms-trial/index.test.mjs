import { describe, expect, it, vi } from 'vitest'
import base from '../../astro.config.mjs'
import trial from '../../astro.cms.config.mjs'

describe('isolated CMS configuration', () => {
  const integration = trial.integrations.find(item => item.name === 'local-cms-preview')
  const setup = integration.hooks['astro:config:setup']

  it('injects the preview only into the optional development server', () => {
    const injectRoute = vi.fn()
    setup({ command: 'dev', injectRoute })
    expect(injectRoute).toHaveBeenCalledTimes(3)
    expect(injectRoute).toHaveBeenNthCalledWith(1, {
      pattern: '/cms-preview/[id]', entrypoint: './src/cms-preview/page.astro', prerender: false,
    })
    for (const kind of ['talks', 'podcasts']) {
      expect(injectRoute).toHaveBeenCalledWith({
        pattern: `/${kind}/cms-preview/[filename]`, entrypoint: './src/cms-preview/media.ts', prerender: false,
      })
    }
    expect(base.integrations.some(item => item.name === 'local-cms-preview')).toBe(false)
  })

  it('refuses production and preview builds with the trial configuration', () => {
    for (const command of ['build', 'preview']) {
      const injectRoute = vi.fn()
      expect(() => setup({ command, injectRoute })).toThrow('local-only')
      expect(injectRoute).not.toHaveBeenCalled()
    }
  })

  it('protects local private state in both dev configurations', () => {
    for (const config of [base, trial]) {
      expect(config.vite.server.fs.deny).toEqual(expect.arrayContaining([
        '.env', '.env.*', '*.{crt,pem,key,p12,pfx,cer,der}', '.npmrc', '.yarnrc.yml',
        '**/.git/**', '**/.local/**', '**/.next/**',
      ]))
    }
    expect(trial.vite.server.strictPort).toBe(true)
  })

  it('isolates optimized dependencies from the normal website server', () => {
    expect(trial.vite.cacheDir).toBe('./.astro/cms-trial/vite')
    expect(trial.vite.cacheDir).not.toBe(base.vite.cacheDir)
    expect(trial.vite.optimizeDeps.include).toEqual(expect.arrayContaining(['pdfjs-dist', '@payloadcms/live-preview']))
  })

  it('configures the same exact CMS origin for browser messages and server previews', async () => {
    vi.stubEnv('CMS_TRIAL_HOST', '192.0.2.10')
    vi.resetModules()
    try {
      const { default: lan } = await import('../../astro.cms.config.mjs')
      expect(lan.vite.define['import.meta.env.CMS_TRIAL_ORIGIN']).toBe('"https://192.0.2.10:4010"')
      expect(base.vite.define?.['import.meta.env.CMS_TRIAL_ORIGIN']).toBeUndefined()
    } finally {
      vi.unstubAllEnvs()
      vi.resetModules()
    }
  })
})
