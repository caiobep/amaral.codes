import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import yaml from 'js-yaml'
import { createEditorConfig } from './config.mjs'

export function articlePreviewStyles(articleSource) {
  const styles = articleSource.match(/<style>([\s\S]*?)<\/style>/u)?.[1]
  assert(styles, 'The website article stylesheet is required for the preview')
  return unwrapGlobalSelectors(styles)
}

function unwrapGlobalSelectors(styles) {
  let start = styles.indexOf(':global(')
  while (start !== -1) {
    let end = start + ':global('.length
    let depth = 1
    while (depth > 0) {
      assert(end < styles.length, 'Unclosed global CSS selector')
      if (styles[end] === '(') depth++
      if (styles[end] === ')') depth--
      end++
    }
    styles = styles.slice(0, start) +
      styles.slice(start + ':global('.length, end - 1) + styles.slice(end)
    start = styles.indexOf(':global(', start)
  }
  return styles
}

export async function configureEditor(website) {
  const source = new URL('./editor/', import.meta.url)
  const admin = path.join(website, 'public/admin')
  const feature = path.join(website, 'src/features/publishing')
  await fs.mkdir(admin, { recursive: true })
  await fs.mkdir(feature, { recursive: true })
  await fs.mkdir(path.join(website, 'src/pages/admin'), { recursive: true })
  await fs.copyFile(
    new URL('index.astro', source),
    path.join(website, 'src/pages/admin/index.astro'),
  )
  await fs.copyFile(
    new URL('preview.mjs', source),
    path.join(feature, 'preview.mjs'),
  )
  await fs.copyFile(new URL('preview-links.mjs', source), path.join(feature, 'preview-links.mjs'))
  await fs.copyFile(new URL('sharing-artwork.mjs', source), path.join(feature, 'sharing-artwork.mjs'))
  await fs.cp(new URL('./fonts/', import.meta.url), path.join(website, 'scripts/social-cards/fonts'), { recursive: true })
  await fs.rm(path.join(admin, 'index.html'), { force: true })
  await fs.copyFile(
    path.join(website, 'public/vendor/LICENSE.txt'),
    path.join(admin, 'LICENSE.txt'),
  )
  await fs.rm(path.join(website, 'public/vendor/sveltia-cms.js'), {
    force: true,
  })
  const styles = await Promise.all(
    ['fonts', 'theme'].map(name =>
      fs.readFile(path.join(website, `src/styles/global/${name}.css`), 'utf8'),
    ),
  )
  styles.push(
    articlePreviewStyles(
      await fs.readFile(
        path.join(website, 'src/features/articles/EntryArticle.astro'),
        'utf8',
      ),
    ),
  )
  styles.push(await fs.readFile(new URL('preview-shell.css', source), 'utf8'))
  styles.push(await fs.readFile(path.join(website, 'src/features/articles/link-cards.css'), 'utf8'))
  await fs.writeFile(path.join(admin, 'preview.css'), styles.join('\n'))
  await fs.writeFile(
    path.join(website, 'src/scripts/layout/pwa.ts'),
    `import { disableTrialOfflineCache } from './trial-offline'

export function initializePwa() {
  if ('serviceWorker' in navigator) void disableTrialOfflineCache()
}
`,
  )
  await fs.writeFile(
    path.join(admin, 'config.yml'),
    yaml.dump(
      createEditorConfig({
        repository: 'caiobep/amaral-content',
        siteUrl: 'https://amaral-publishing-preview.caiobep.workers.dev',
      }),
    ),
  )
  const configPath = path.join(website, 'astro.config.mjs')
  const config = await fs.readFile(configPath, 'utf8')
  await fs.writeFile(configPath, config.replace(
    "site: 'https://amaral.codes'",
    "site: 'https://amaral-publishing-preview.caiobep.workers.dev'",
  ))
}
