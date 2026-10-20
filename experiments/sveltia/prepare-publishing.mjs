import assert from 'node:assert/strict'
import path from 'node:path'
import { prepareSourceConnection } from './connect-source.mjs'

const [directory, revision] = process.argv.slice(2)
assert(directory && revision, 'Usage: node experiments/sveltia/prepare-publishing.mjs <content-directory> <reviewed-source-sha>')
await prepareSourceConnection(path.resolve(directory), revision)
console.log('Prepared the immutable-source publishing connection; protected version URLs must be verified before enabling draft builds.')
