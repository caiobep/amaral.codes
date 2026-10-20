import fs from 'node:fs/promises'
import path from 'node:path'
import yaml from 'js-yaml'
import { createEditorConfig } from './config.mjs'
import { articlePreviewStyles } from './editor-assets.mjs'

export async function prepareSiteAssets(website, output, { siteUrl, media, draft, publishedSite }) {
  const publicDirectory = path.join(output, 'public')
  await fs.cp(path.join(website, 'public'), publicDirectory, { recursive: true })
  if (!draft) await writeEditorAssets(website, publicDirectory, { siteUrl, media })
  if (draft) await fs.appendFile(path.join(publicDirectory, '_redirects'), `\n/admin ${publishedSite}/admin/ 302\n/admin/* ${publishedSite}/admin/:splat 302\n`)
  await fs.writeFile(path.join(publicDirectory, '_headers'), '/*\n  X-Robots-Tag: noindex, nofollow\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: same-origin\n  X-Frame-Options: DENY\n  Cache-Control: private, no-store\n')
  await fs.writeFile(path.join(publicDirectory, 'robots.txt'), 'User-agent: *\nDisallow: /\n')
  return publicDirectory
}

async function writeEditorAssets(website, publicDirectory, { siteUrl, media }) {
  const admin = path.join(publicDirectory, 'admin')
  await fs.mkdir(admin, { recursive: true })
  await fs.writeFile(path.join(admin, 'config.yml'), yaml.dump(createEditorConfig({ repository: 'caiobep/amaral-content', siteUrl, media })))
  const styles = await Promise.all(['fonts', 'theme'].map(name => fs.readFile(path.join(website, `src/styles/global/${name}.css`), 'utf8')))
  styles.push(articlePreviewStyles(await fs.readFile(path.join(website, 'src/features/articles/EntryArticle.astro'), 'utf8')))
  styles.push(await fs.readFile(new URL('./editor/preview-shell.css', import.meta.url), 'utf8'))
  styles.push(await fs.readFile(path.join(website, 'src/features/articles/link-cards.css'), 'utf8'))
  await fs.writeFile(path.join(admin, 'preview.css'), styles.join('\n'))

}

export async function writeLocalizedRoutes(publicDirectory, routes) {
  await fs.writeFile(path.join(publicDirectory, 'publication-routes.json'), JSON.stringify(routes))
  const redirects = routes.filter(route => route.url.startsWith('/posts/')).map(route => `/${route.language.toLowerCase()}/posts/${route.url.split('/').at(-1)} ${route.url} 302`)
  const filename = path.join(publicDirectory, '_redirects')
  const previous = await fs.readFile(filename, 'utf8').catch(error => {
    if (error.code !== 'ENOENT') throw error
    return ''
  })
  await fs.writeFile(filename, `${previous}\n${redirects.join('\n')}\n`)
}
