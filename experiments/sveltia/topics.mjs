import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import yaml from 'js-yaml'
import { checkPublicDocument } from '../../scripts/public-content-privacy/index.mjs'

export async function seedTopics(repository, documents) {
  const names = [...new Set(documents.flatMap(document => document.metadata.topics ?? []))]
    .sort((left, right) => left.localeCompare(right))
  const directory = path.join(repository, 'taxonomy/topics')
  await fs.mkdir(directory, { recursive: true })
  const files = []
  for (const name of names) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '')
    assert(slug, 'A topic needs a meaningful filename')
    await fs.writeFile(path.join(directory, `${slug}.yml`), yaml.dump({ name }), { flag: 'wx' })
    files.push(`taxonomy/topics/${slug}.yml`)
  }
  return files
}

async function readTopic(directory, file) {
  assert(file.endsWith('.yml'), 'Topic records must be YAML files')
  const raw = await fs.readFile(path.join(directory, file), 'utf8')
  const topic = yaml.load(raw, { schema: yaml.JSON_SCHEMA })
  assert(topic && typeof topic === 'object' && !Array.isArray(topic), `Invalid topic: ${file}`)
  assert(Object.keys(topic).every(key => ['name', 'description'].includes(key)), `Unexpected topic fields: ${file}`)
  assert(typeof topic.name === 'string' && topic.name.trim().length > 0 && topic.name === topic.name.trim(), `Invalid topic name: ${file}`)
  assert(topic.description === undefined || typeof topic.description === 'string', `Invalid topic description: ${file}`)
  assert.equal(checkPublicDocument(file, `---\n${raw}\n---\n`).length, 0, `Private topic metadata: ${file}`)
  return topic
}

export async function validateTopics(repository, entries) {
  const directory = path.join(repository, 'taxonomy/topics')
  const names = new Set()
  for (const file of await fs.readdir(directory)) {
    const topic = await readTopic(directory, file)
    assert(!names.has(topic.name), `Duplicate topic: ${topic.name}`)
    names.add(topic.name)
  }
  for (const [file, raw] of entries) {
    const metadata = yaml.load(raw.match(/^---\r?\n([\s\S]*?)\r?\n---/u)[1], { schema: yaml.JSON_SCHEMA })
    for (const topic of metadata.topics ?? []) {
      assert(names.has(topic), `Unknown topic "${topic}" in ${file}; update the topic and its references together`)
    }
  }
  return names
}
