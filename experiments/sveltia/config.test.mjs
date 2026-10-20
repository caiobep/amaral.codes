import assert from 'node:assert/strict'
import test from 'node:test'
import { createEditorConfig } from './config.mjs'

test('drafts use the editorial workflow in the private content repository', () => {
  const config = createEditorConfig({ repository: 'example/private-content' })
  assert.deepEqual(config.backend, {
    name: 'github',
    repo: 'example/private-content',
    branch: 'main', preview_context: 'publishing-preview',
    auth_methods: ['token'],
  })
  assert.equal(config.publish_mode, 'editorial_workflow')
  assert.equal(config.collections.length, 4)
  for (const collection of config.collections.filter(item => item.name !== 'topics')) {
    assert.equal(collection.delete, false)
    assert.equal(
      collection.fields.find(field => field.name === 'summary').widget,
      'text',
    )
    assert.equal(
      collection.fields.find(field => field.name === 'category').default,
      collection.name === 'posts' ? 'note' : collection.name.slice(0, -1),
    )
    assert.deepEqual(
      collection.fields.find(field => field.name === 'body').modes,
      ['rich_text', 'raw'],
    )
  }
})

test('writing uses native date controls, safe URLs, and optimized collision-free uploads', () => {
  const config = createEditorConfig({
    repository: 'example/private-content',
    siteUrl: 'https://preview.example.com',
  })
  assert.equal(config.site_url, 'https://preview.example.com')
  for (const collection of config.collections.filter(item => item.name !== 'topics')) {
    assert.deepEqual(collection.slug.editable, ['create'])
    const date = collection.fields.find(field => field.name === 'date')
    assert.equal(date.widget, 'datetime')
    assert.equal(date.type, 'date')
    assert.equal(date.default, '{{now}}')
    assert(
      collection.fields.findIndex(field => field.name === 'body') <
        collection.fields.findIndex(field => field.name === 'date'),
    )
  }
  const media = config.media_libraries.default.config
  assert(media.filename_template.includes('{{uuid_short}}'))
  assert.equal(media.transformations.raster_image.format, 'webp')
  assert.equal(media.transformations.raster_image.width, 2400)
})

test('a demonstration cannot contact GitHub or create a draft pull request', () => {
  const config = createEditorConfig({
    repository: 'example/private-content',
    demonstration: true,
  })
  assert.deepEqual(config.backend, { name: 'test-repo' })
  assert.equal(config.publish_mode, 'simple')
})

test('desktop tables show editorial fields and allow sorting by homepage order', () => {
  const config = createEditorConfig({ repository: 'example/private-content' })
  for (const collection of config.collections.filter(item => item.name !== 'topics')) {
    assert.deepEqual(collection.table_columns, [
      'title',
      ...(collection.name === 'posts' ? [{ field: 'category', label: 'Type' }] : []),
      'date',
      { field: collection.name === 'posts' ? '{{locales}}' : 'language', label: 'Language' },
      'summary', 'topics',
      { field: 'featuredOrder', label: 'Homepage order' },
    ])
    for (const column of collection.table_columns) {
      const name = typeof column === 'string' ? column : column.field
      if (name === '{{locales}}') continue
      assert(collection.fields.some(field => field.name === name))
    }
    assert(collection.sortable_fields.fields.includes('featuredOrder'))
    assert.deepEqual(collection.sortable_fields.default, {
      field: 'date', direction: 'descending',
    })
  }
})

test('editorial filters cover missing summaries, homepage placement, and every writing type', () => {
  const config = createEditorConfig({ repository: 'example/private-content' })
  for (const collection of config.collections.filter(item => item.name !== 'topics')) {
    assert(collection.view_filters.some(filter => filter.field === 'summary' && filter.empty === true))
    assert(collection.view_filters.some(filter => filter.field === 'featuredOrder' && filter.gt === 0))
    assert.equal(collection.fields.find(field => field.name === 'summary').required, false)
  }
  const posts = config.collections.find(collection => collection.name === 'posts')
  for (const { value } of posts.fields.find(field => field.name === 'category').options) {
    assert(posts.view_filters.some(filter => filter.field === 'category' && new RegExp(filter.pattern).test(value)))
  }
})

test('collections use native icons and select shared topics without changing saved labels', () => {
  const config = createEditorConfig({ repository: 'example/private-content' })
  for (const collection of config.collections) {
    assert.match(collection.icon, /^[a-z_]+$/u)
    if (collection.name === 'topics') continue
    const topics = collection.fields.find(field => field.name === 'topics')
    assert.equal(topics.widget, 'relation')
    assert.equal(topics.collection, 'topics')
    assert.equal(topics.multiple, true)
    assert.equal(topics.value_field, 'name')
    assert.deepEqual(topics.display_fields, ['name'])
  }
  const catalog = config.collections.find(collection => collection.name === 'topics')
  assert.equal(catalog.folder, 'taxonomy/topics')
  assert.equal(catalog.delete, false)
  assert.equal(catalog.fields.find(field => field.name === 'name').unique, true)
  assert.equal(catalog.editor.preview, false)
})


test('Posts consolidate writing types and translations preserve their original language', () => {
  const config = createEditorConfig({ repository: 'example/private-content' })
  assert.deepEqual(config.collections.map(collection => collection.name), ['posts', 'podcasts', 'talks', 'topics'])
  const posts = config.collections[0]
  const type = posts.fields.find(field => field.name === 'category')
  assert.deepEqual(type.options.map(option => option.value), ['essay', 'note', 'review', 'link', 'video'])
  assert.equal(type.dropdown_threshold, 0)
  assert.equal(type.widget, 'select')
  assert.equal(posts.fields.find(field => field.name === 'body').i18n, true)
  assert.equal(posts.fields.some(field => field.name === 'originalLanguage'), false)
  assert.equal(config.i18n.omit_default_locale_from_file_path, true)
  assert.equal(config.collections[1].i18n, false)
  assert.equal(config.collections[2].i18n, false)
  assert.equal(posts.preview_path, '{{locale | lower}}/posts/{{slug}}')
})


test('slides use R2 file selection only after the dedicated media library is configured', () => {
  const options = { repository: 'example/private-content' }
  const fileField = config => config.collections.find(collection => collection.name === 'talks').fields.find(field => field.name === 'talk').fields.find(field => field.name === 'materials').fields.find(field => field.name === 'url')
  assert.equal(fileField(createEditorConfig(options)).widget, 'string')
  const configured = createEditorConfig({ ...options, media: { access_key_id: 'a'.repeat(32), account_id: 'b'.repeat(32), bucket: 'amaral-publishing-media', public_url: 'https://preview.example.com/_media' } })
  assert.equal(fileField(configured).widget, 'file')
  assert.equal(fileField(configured).media_library.name, 'cloudflare_r2')
  assert.equal(configured.media_libraries.cloudflare_r2.bucket, 'amaral-publishing-media')
})
