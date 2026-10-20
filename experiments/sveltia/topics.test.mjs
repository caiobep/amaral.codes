import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { seedTopics, validateTopics } from './topics.mjs'

const post = topics => new Map([['entries/notes/example.md', `---\ntopics: ${JSON.stringify(topics)}\n---\nExact article body.`]])

test('catalog preserves exact labels, deduplicates shared topics, and refuses to overwrite them', async t => {
  const repository = await fs.mkdtemp(path.join(os.tmpdir(), 'publishing-topics-'))
  t.after(() => fs.rm(repository, { recursive: true, force: true }))
  const documents = [{ metadata: { topics: ['React Native', 'iOS'] } }, { metadata: { topics: ['iOS'] } }]
  assert.deepEqual(await seedTopics(repository, documents), ['taxonomy/topics/ios.yml', 'taxonomy/topics/react-native.yml'])
  assert.deepEqual([...(await validateTopics(repository, post(['React Native', 'iOS'])))].sort(), ['React Native', 'iOS'].sort())
  await assert.rejects(seedTopics(repository, documents), /EEXIST/u)
  await assert.rejects(validateTopics(repository, post(['react native'])), /Unknown topic/u)
})

test('renames, duplicate names, and private metadata cannot silently break published topic references', async t => {
  const repository = await fs.mkdtemp(path.join(os.tmpdir(), 'publishing-topics-'))
  t.after(() => fs.rm(repository, { recursive: true, force: true }))
  await seedTopics(repository, [{ metadata: { topics: ['Original'] } }])
  const record = path.join(repository, 'taxonomy/topics/original.yml')
  await fs.writeFile(record, 'name: Renamed\n')
  await assert.rejects(validateTopics(repository, post(['Original'])), /Unknown topic/u)
  await fs.writeFile(record, 'name: Original\n')
  const duplicate = path.join(repository, 'taxonomy/topics/duplicate.yml')
  await fs.writeFile(duplicate, 'name: Original\n')
  await assert.rejects(validateTopics(repository, post(['Original'])), /Duplicate topic/u)
  await fs.writeFile(duplicate, 'name: Another\nstatus: draft\n')
  await assert.rejects(validateTopics(repository, post(['Original'])), /Unexpected topic fields/u)
  await fs.writeFile(duplicate, 'name: Another\ndescription: https://app.notion.com/private-example\n')
  await assert.rejects(validateTopics(repository, post(['Original'])), /Private topic metadata/u)
})
