import { fileURLToPath } from 'node:url'

export default function publishingEditor() {
  return {
    name: 'amaral-publishing-editor',
    hooks: {
      'astro:config:setup': ({ injectRoute }) => {
        if (process.env.AMARAL_PUBLISHING_DRAFT === '1') return
        injectRoute({ pattern: '/admin', entrypoint: fileURLToPath(new URL('./editor/index.astro', import.meta.url)), prerender: true })
      },
    },
  }
}
