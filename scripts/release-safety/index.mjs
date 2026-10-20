import fs from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

export const PRODUCTION_CUSTOM_DOMAIN = 'amaral.codes'
export const FRESH_PREVIEW_COMMAND = 'exec astro preview --host 127.0.0.1 --port 4322'

const ROOT_URL = new URL('../../', import.meta.url)
const PLAYWRIGHT_CONFIG_URL = new URL('packages/website/playwright.config.mjs', ROOT_URL)
const ROOT_PACKAGE_URL = new URL('package.json', ROOT_URL)
const WEBSITE_PACKAGE_URL = new URL('packages/website/package.json', ROOT_URL)
const WRANGLER_CONFIG_URL = new URL('packages/website/wrangler.jsonc', ROOT_URL)

const PRODUCTION_BUILD_COMMAND = [
  'npm run content:sync -- all',
  'npm run verify:publication',
  'npm run build:production-content -w @amaral.codes/website',
].join(' && ')
const PRODUCTION_WEBSITE_BUILD_COMMAND = 'AMARAL_CONTENT_SOURCE=production npm run build'

export function findReleaseSafetyViolations(playwrightConfig, wranglerConfig) {
  return [
    ...findPreviewViolations(playwrightConfig),
    ...findRoutingViolations(wranglerConfig),
  ]
}

export function findProductionBuildViolations(rootPackage, websitePackage) {
  const violations = []

  if (rootPackage.scripts?.['build:production'] !== PRODUCTION_BUILD_COMMAND) {
    violations.push('Production builds must sync, verify, and force the production content source.')
  }

  if (
    websitePackage.scripts?.['build:production-content']
    !== PRODUCTION_WEBSITE_BUILD_COMMAND
  ) {
    violations.push('The website production build must force AMARAL_CONTENT_SOURCE=production.')
  }

  return violations
}

export function findCmsPreviewBuildViolations(websitePackage) {
  const command = websitePackage.scripts?.['build:cms:preview']
  if (command === undefined) return []
  return command ===
    'AMARAL_CONTENT_SOURCE=production AMARAL_CMS_PREVIEW=1 astro build --force'
    ? []
    : [
        'The deployed CMS preview must force published content instead of inheriting fixture mode.',
      ]
}

function findPreviewViolations(config) {
  const violations = []

  if (config.webServer?.command !== FRESH_PREVIEW_COMMAND) {
    violations.push('Playwright must launch Astro directly with exec.')
  }

  if (config.webServer?.reuseExistingServer !== false) {
    violations.push('Playwright must set webServer.reuseExistingServer to false.')
  }

  return violations
}

function findRoutingViolations(config) {
  const routes = Array.isArray(config.routes) ? config.routes : []
  const apexRoute = routes.find(route => route?.pattern === PRODUCTION_CUSTOM_DOMAIN)
  const violations = []

  if (config.workers_dev !== false) {
    violations.push('Cloudflare production must set workers_dev to false.')
  }

  if (apexRoute?.custom_domain !== true) {
    violations.push(`${PRODUCTION_CUSTOM_DOMAIN} must be configured as a Custom Domain.`)
  }

  if (routes.length !== 1 || routes[0]?.pattern !== PRODUCTION_CUSTOM_DOMAIN) {
    violations.push('Cloudflare production routes must contain exactly one canonical apex domain.')
  }

  if ('route' in config) {
    violations.push('Cloudflare production must use the guarded routes array, not route.')
  }

  return violations
}

export async function verifyReleaseSafety() {
  const [
    { default: playwrightConfig },
    rootPackageSource,
    websitePackageSource,
    wranglerSource,
  ] = await Promise.all([
    import(PLAYWRIGHT_CONFIG_URL.href),
    fs.readFile(ROOT_PACKAGE_URL, 'utf8'),
    fs.readFile(WEBSITE_PACKAGE_URL, 'utf8'),
    fs.readFile(WRANGLER_CONFIG_URL, 'utf8'),
  ])
  const rootPackage = JSON.parse(rootPackageSource)
  const websitePackage = JSON.parse(websitePackageSource)
  const wranglerConfig = JSON.parse(wranglerSource)
  const violations = [
    ...findReleaseSafetyViolations(playwrightConfig, wranglerConfig),
    ...findProductionBuildViolations(rootPackage, websitePackage),
    ...findCmsPreviewBuildViolations(websitePackage),
  ]

  if (violations.length > 0) {
    throw new Error(`Release safety checks failed:\n  - ${violations.join('\n  - ')}`)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await verifyReleaseSafety()
    console.log('Release safety checks passed.')
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}
