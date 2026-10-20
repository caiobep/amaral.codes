import fs from 'node:fs/promises'
import path from 'node:path'

export async function writeBuildWorker(output, target, { media, versionUrlsProtected }) {
  for (const file of ['worker.mjs', 'materials-worker.mjs', 'media.mjs']) {
    await fs.copyFile(new URL(file, import.meta.url), path.join(output, file))
  }
  const configuration = {
    name: 'amaral-publishing-preview', compatibility_date: '2026-10-14',
    workers_dev: true, preview_urls: Boolean(versionUrlsProtected),
    main: './worker.mjs',
    assets: { directory: './dist', binding: 'ASSETS', not_found_handling: '404-page' },
    r2_buckets: [
      { binding: 'TALK_MATERIALS', bucket_name: 'amaral-codes-assets' },
      ...(media ? [{ binding: 'EDITOR_MEDIA', bucket_name: media.bucket }] : []),
    ],
  }
  await fs.writeFile(path.join(output, 'target.json'), JSON.stringify({ kind: target.kind, alias: target.alias }))
  await fs.writeFile(path.join(output, 'wrangler.json'), JSON.stringify(configuration, null, 2) + '\n')
}
