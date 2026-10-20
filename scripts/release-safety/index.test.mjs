import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  FRESH_PREVIEW_COMMAND,
  PRODUCTION_CUSTOM_DOMAIN,
  findCmsPreviewBuildViolations,
  findProductionBuildViolations,
  findReleaseSafetyViolations,
} from './index.mjs'

describe('findCmsPreviewBuildViolations', () => {
  it('rejects the deployed preview command that inherited fixture mode', () => {
    assert.match(
      findCmsPreviewBuildViolations({
        scripts: {
          'build:cms:preview': 'AMARAL_CMS_PREVIEW=1 astro build --force',
        },
      })[0],
      /instead of inheriting fixture mode/u,
    )
  })

  it('accepts a preview that forces published content even with ambient fixture mode', () => {
    assert.deepEqual(
      findCmsPreviewBuildViolations({
        scripts: {
          'build:cms:preview':
            'AMARAL_CONTENT_SOURCE=production AMARAL_CMS_PREVIEW=1 astro build --force',
        },
      }),
      [],
    )
  })

  it('leaves repositories without the CMS preview command unaffected', () => {
    assert.deepEqual(findCmsPreviewBuildViolations({ scripts: {} }), [])
  })
})

describe('findReleaseSafetyViolations', () => {
  it('accepts a fresh preview and the canonical apex Custom Domain', () => {
    const violations = findReleaseSafetyViolations(
      freshPreviewConfig(),
      productionWranglerConfig(),
    )

    assert.deepEqual(violations, [])
  })

  it('rejects Playwright server reuse', () => {
    const violations = findReleaseSafetyViolations(
      {
        webServer: {
          command: FRESH_PREVIEW_COMMAND,
          reuseExistingServer: true,
        },
      },
      productionWranglerConfig(),
    )

    assert.match(violations[0], /reuseExistingServer/u)
  })

  it('rejects a wrapped preview command that can outlive Playwright', () => {
    const violations = findReleaseSafetyViolations(
      {
        webServer: {
          command: 'npm run preview -- --host 127.0.0.1 --port 4322',
          reuseExistingServer: false,
        },
      },
      productionWranglerConfig(),
    )

    assert.match(violations[0], /launch Astro directly/u)
  })

  it('requires the apex to be a Custom Domain with workers.dev disabled', () => {
    const violations = findReleaseSafetyViolations(freshPreviewConfig(), {
      routes: [{ pattern: PRODUCTION_CUSTOM_DOMAIN }],
      workers_dev: true,
    })

    assert.equal(violations.length, 2)
    assert.match(violations[0], /workers_dev/u)
    assert.match(violations[1], /Custom Domain/u)
  })

  it('rejects additional or legacy production routes', () => {
    const wranglerConfig = productionWranglerConfig()
    wranglerConfig.route = `${PRODUCTION_CUSTOM_DOMAIN}/*`
    wranglerConfig.routes.push({
      custom_domain: true,
      pattern: `www.${PRODUCTION_CUSTOM_DOMAIN}`,
    })

    const violations = findReleaseSafetyViolations(freshPreviewConfig(), wranglerConfig)

    assert.equal(violations.length, 2)
    assert.match(violations[0], /exactly one canonical apex/u)
    assert.match(violations[1], /guarded routes array/u)
  })
})

describe('findProductionBuildViolations', () => {
  it('accepts a production build that cannot inherit fixture mode', () => {
    const violations = findProductionBuildViolations(
      {
        scripts: {
          'build:production': [
            'npm run content:sync -- all',
            'npm run verify:publication',
            'npm run build:production-content -w @amaral.codes/website',
          ].join(' && '),
        },
      },
      {
        scripts: {
          'build:production-content': 'AMARAL_CONTENT_SOURCE=production npm run build',
        },
      },
    )

    assert.deepEqual(violations, [])
  })

  it('rejects a production build that can use the ambient content source', () => {
    const violations = findProductionBuildViolations(
      { scripts: { 'build:production': 'npm run build:site' } },
      { scripts: { build: 'astro build --force' } },
    )

    assert.equal(violations.length, 2)
    assert.match(violations[0], /force the production content source/u)
    assert.match(violations[1], /AMARAL_CONTENT_SOURCE=production/u)
  })

  it('rejects production builds that refresh only one collection', () => {
    const violations = findProductionBuildViolations(
      {
        scripts: {
          'build:production': [
            'npm run content:sync -- entries',
            'npm run verify:publication',
            'npm run build:production-content -w @amaral.codes/website',
          ].join(' && '),
        },
      },
      {
        scripts: {
          'build:production-content': 'AMARAL_CONTENT_SOURCE=production npm run build',
        },
      },
    )

    assert.equal(violations.length, 1)
    assert.match(violations[0], /must sync, verify/u)
  })
})

function freshPreviewConfig() {
  return {
    webServer: {
      command: FRESH_PREVIEW_COMMAND,
      reuseExistingServer: false,
    },
  }
}

function productionWranglerConfig() {
  return {
    routes: [{
      custom_domain: true,
      pattern: PRODUCTION_CUSTOM_DOMAIN,
    }],
    workers_dev: false,
  }
}
