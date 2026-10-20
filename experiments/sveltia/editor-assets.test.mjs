import assert from 'node:assert/strict'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Window } from 'happy-dom'
import { articlePreviewStyles } from './editor-assets.mjs'
import { displayDate, registerPublishingPreview } from './editor/preview.mjs'
const previewOptions = { describeArticle: ({ summary, title }) => summary || title, siteUrl: 'https://example.com' }

test('article preview reuses real styles and removes Astro-only selector syntax', () => {
  assert.equal(
    articlePreviewStyles(
      '<style>.content :global(pre code) { color: red; }</style>',
    ),
    '.content pre code { color: red; }',
  )
  assert.throws(() => articlePreviewStyles('No stylesheet'))
})

test('preview preserves nested selector boundaries instead of styling prose as inline code', () => {
  const selectors = '.content :global(:not(pre) > code), .content :global(a:is(:hover, :focus))'
  assert.equal(
    articlePreviewStyles(`<style>${selectors} { color: red; }</style>`),
    '.content :not(pre) > code, .content a:is(:hover, :focus) { color: red; }',
  )
  assert.throws(() => articlePreviewStyles('<style>:global(:not(pre) { color: red; }</style>'))
})

test('publication dates do not shift a day in a browser timezone', () => {
  assert.equal(displayDate('2020-10-28'), 'October 28, 2020')
  assert.equal(displayDate('2020-10-28T00:00:00.000Z'), 'October 28, 2020')
  assert.equal(displayDate('2020-10-28', ''), 'October 28, 2020')
  assert.equal(displayDate(''), 'Choose a publication date')
})

test('all collections render escaped editorial metadata and use the native body preview', () => {
  const templates = new Map()
  registerPublishingPreview({
    React,
    registerPreviewStyle: () => {},
    registerPreviewTemplate: (name, component) =>
      templates.set(name, component),
  }, previewOptions)
  assert.equal(templates.size, 3)
  const data = {
    title: '<script>unsafe()</script>',
    summary: 'Secondary homepage text',
    category: 'note',
    date: '2020-10-28',
    language: '',
    topics: ['Publishing'],
  }
  const html = renderToStaticMarkup(
    React.createElement(templates.get('posts'), {
      entry: new Map([['data', { toJS: () => data }]]),
      widgetFor: field =>
        React.createElement(
          'div',
          { 'data-native-field': field },
          'Native preview',
        ),
      getAsset: () => undefined,
    }),
  )
  assert(html.includes('&lt;script&gt;unsafe()&lt;/script&gt;'))
  assert(html.includes('October 28, 2020'))
  assert(html.includes('Secondary homepage text'))
  assert(html.includes('data-native-field="body"'))
  assert(!html.includes('<script>'))
})

test('social preview uses independent overrides and the editor asset URL without exposing HTML', () => {
  const templates = new Map()
  registerPublishingPreview({ React: { ...React, useState: initial => [initial === 'article' ? 'sharing' : initial, () => {}] }, registerPreviewStyle() {}, registerPreviewTemplate: (name, component) => templates.set(name, component) }, previewOptions)
  const data = { title: 'Article title', date: '2026-10-18', category: 'note', sharing: { title: '<script>Shared</script>', description: 'Shared description', image: '/media/cover.webp', imageAlt: 'Cover photo' } }
  const html = renderToStaticMarkup(React.createElement(templates.get('posts'), {
    entry: new Map([['data', { toJS: () => data }]]), getAsset: () => 'blob:unsaved-cover',
  }))
  assert(html.includes('Social sharing preview'))
  assert(html.includes('blob:unsaved-cover'))
  assert(html.includes('Shared description'))
  assert(html.includes('&lt;script&gt;Shared&lt;/script&gt;'))
  assert(!html.includes('<script>'))
})

test('preview appearance changes only its document and restores the previous theme on cleanup', () => {
  const editor = new Window()
  const preview = new Window()
  editor.document.documentElement.dataset.theme = 'light'
  preview.document.documentElement.dataset.theme = 'existing'
  for (const theme of ['light', 'dark']) {
    const effects = []
    const templates = new Map()
    registerPublishingPreview({
      React: { ...React,
        useState: initial => [initial === 'article' ? 'homepage' : theme, () => {}],
        useEffect: effect => effects.push(effect),
      },
      registerPreviewStyle() {},
      registerPreviewTemplate: (name, component) => templates.set(name, component),
    }, previewOptions)
    const data = { title: 'Original title', summary: 'Original summary' }
    const html = renderToStaticMarkup(React.createElement(templates.get('posts'), {
      entry: new Map([['data', { toJS: () => data }]]), document: preview.document,
    }))
    assert(html.includes('aria-label="Preview appearance"'))
    assert(html.includes(`aria-pressed="true">${theme === 'light' ? 'Light' : 'Dark'}</button>`))
    const cleanup = effects[0]()
    assert.equal(preview.document.documentElement.dataset.theme, theme)
    assert.equal(editor.document.documentElement.dataset.theme, 'light')
    assert.deepEqual(data, { title: 'Original title', summary: 'Original summary' })
    cleanup()
    assert.equal(preview.document.documentElement.dataset.theme, 'existing')
  }
  editor.happyDOM.abort()
  preview.happyDOM.abort()
})
