import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { Entries } from './collections/entries'
import { Media } from './collections/media'
import { Users } from './collections/users'
import { articleFeatures } from './editor'
import { stateDirectory } from './trial-state'

const secret = process.env.PAYLOAD_SECRET
if (!secret) throw new Error('Start the isolated editor with npm run cms:dev.')

export default buildConfig({
  secret,
  serverURL: `${process.env.CMS_TRIAL_HOST ? 'https' : 'http'}://${process.env.CMS_TRIAL_HOST ?? '127.0.0.1'}:4010`,
  cookiePrefix: 'amaral-cms-trial',
  admin: {
    user: 'users',
    avatar: 'default',
    importMap: { baseDir: import.meta.dirname },
    components: {
      header: ['./components/TrialNotice#TrialNotice'],
      beforeDashboard: ['./components/TrialOverview#TrialOverview'],
    },
  },
  collections: [Users, Media, Entries],
  editor: lexicalEditor({ features: articleFeatures }),
  db: sqliteAdapter({ client: { url: `file:${stateDirectory}/cms.db` } }),
  sharp,
  typescript: { outputFile: new URL('./payload-types.ts', import.meta.url).pathname },
  graphQL: { disable: true },
})
