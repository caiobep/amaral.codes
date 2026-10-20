import { loadPreviewLinks } from './preview-links.mjs'
import { createSharingArtwork } from './sharing-artwork.mjs'

export function displayDate(value, language = 'en') {
  const date = new Date(value)
  if (!value || Number.isNaN(date.getTime())) return 'Choose a publication date'
  return new Intl.DateTimeFormat(language || 'en', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(date)
}

export function registerPublishingPreview(CMS, { describeArticle, siteUrl }) {
  const { createElement: h, useState, useEffect } = CMS.React
  const SharingArtwork = createSharingArtwork(CMS.React)

  function previewMetadata(data) {
    return h(
      'div',
      { className: 'article-meta' },
      h('span', null, data.category),
      h(
        'time',
        { dateTime: data.date, 'data-key-path': 'date' },
        displayDate(data.date, data.language),
      ),
    )
  }

  function articlePreview(data, title, metadata, widgetFor) {
    return h(
      'article',
      { className: 'article page-shell' },
      h(
        'header',
        null,
        h('span', { className: 'back-link' }, 'All notes'),
        h('div', { className: 'article-meta-row' }, metadata),
        h('h1', { 'data-key-path': 'title', tabIndex: 0 }, title),
        data.summary
          ? h(
              'p',
              { className: 'dek', 'data-key-path': 'summary', tabIndex: 0 },
              data.summary,
            )
          : null,
        h(
          'ul',
          {
            className: 'tag-list',
            'aria-label': 'Topics',
            'data-key-path': 'topics',
          },
          ...(data.topics ?? []).map(topic => h('li', { key: topic }, topic)),
        ),
      ),
      h(
        'div',
        { className: 'content' },
        data.podcast ? widgetFor('podcast') : null,
        data.talk ? widgetFor('talk') : null,
        widgetFor('body'),
      ),
    )
  }

  function homepagePreview(data, title, metadata) {
    return h(
      'section',
      {
        className: 'homepage-card-preview',
        'aria-label': 'Homepage card preview',
      },
      h('p', { className: 'preview-eyebrow' }, 'Recent notes'),
      h(
        'article',
        { className: 'homepage-card' },
        metadata,
        h('h2', { 'data-key-path': 'title', tabIndex: 0 }, title),
        h(
          'p',
          { 'data-key-path': 'summary', tabIndex: 0 },
          data.summary ||
            'Add a summary to show secondary text beside this title.',
        ),
        h('span', { className: 'preview-read-link' }, 'Open note →'),
      ),
      h(
        'p',
        { className: 'preview-caption' },
        data.featuredOrder
          ? `Homepage position ${data.featuredOrder}`
          : 'Set a homepage order to feature this entry.',
      ),
    )
  }

  function previewToolbar(view, setView, theme, setTheme) {
    return h(
      'div',
      {
        className: 'preview-toolbar',
      },
      h('div', { className: 'preview-controls', role: 'group', 'aria-label': 'Preview view' },
      ...['article', 'homepage', 'sharing'].map(mode =>
        h(
          'button',
          {
            key: mode,
            type: 'button',
            'aria-pressed': view === mode,
            onClick: () => setView(mode),
          },
          { article: 'Article', homepage: 'Homepage card', sharing: 'Social sharing' }[mode],
        ),
      )),
      h('div', { className: 'preview-controls', role: 'group', 'aria-label': 'Preview appearance' },
        ...['light', 'dark'].map(mode => h('button', {
          key: mode,
          type: 'button',
          'aria-pressed': theme === mode,
          onClick: () => setTheme(mode),
        }, { light: 'Light', dark: 'Dark' }[mode])),
      ),
    )
  }

  function sharingPreview(data, title, getAsset) {
    const sharing = data.sharing ?? {}
    const image = sharing.image
    const asset = image ? getAsset(image) : undefined
    const description = sharing.description || describeArticle({
      contentHtml: '', contentMarkdown: data.body, summary: data.summary, title,
    })
    return h('section', { className: 'sharing-preview', 'aria-label': 'Social sharing preview' },
      h('p', { className: 'preview-eyebrow' }, 'Shared link'),
      h('div', { className: 'sharing-card' },
        image ? h('img', { src: asset ? String(asset) : image, alt: sharing.imageAlt }) : h(SharingArtwork, { data }),
        h('div', { className: 'sharing-card-copy' },
          h('span', { className: 'sharing-domain' }, new URL(siteUrl).hostname),
          h('h2', null, sharing.title || `${title} | Caio Amaral`),
          h('p', null, description),
        ),
      ),
      h('p', { className: 'preview-caption' }, 'Shared-link illustration. Social apps cannot read an Access-protected preview.'),
    )
  }

  function EntryPreview({ entry, widgetFor, getAsset, document }) {
    const data = entry.get('data').toJS()
    const [view, setView] = useState('article')
    const [theme, setTheme] = useState('light')
    const title = data.title || 'Your title'
    const metadata = previewMetadata(data)
    useEffect(() => {
      if (!document) return
      const root = document.documentElement
      const previous = root.getAttribute('data-theme')
      root.setAttribute('data-theme', theme)
      return () => {
        if (previous === null) root.removeAttribute('data-theme')
        else root.setAttribute('data-theme', previous)
      }
    }, [document, theme])
    useEffect(() => {
      if (view !== 'article' || !document) return
      return loadPreviewLinks(document, data.linkCards, getAsset, siteUrl)
    }, [view, document, data.body, data.linkCards, getAsset])
    return h(
      'main',
      null,
      previewToolbar(view, setView, theme, setTheme),
      view === 'sharing' ? sharingPreview(data, title, getAsset)
        : view === 'article' ? articlePreview(data, title, metadata, widgetFor)
          : homepagePreview(data, title, metadata),
    )
  }

  CMS.registerPreviewStyle('/admin/preview.css')
  for (const collection of [
    'posts',
    'podcasts',
    'talks',
  ]) {
    CMS.registerPreviewTemplate(collection, EntryPreview)
  }
}
