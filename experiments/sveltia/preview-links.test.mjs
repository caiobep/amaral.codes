import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Window } from 'happy-dom'
import { observePreviewLinks } from './editor/preview-links.mjs'

test('preview updates and removes a pinned card without editing the Markdown body', () => {
  const window = new Window({ url: 'https://example.com/admin/' })
  const document = window.document
  document.body.innerHTML = '<div class="content"><p><a href="https://example.com/source">Original</a></p></div>'
  const cards = title => new Map([['https://example.com/source', { title }]])
  let stop = observePreviewLinks(document, cards('<script>First</script>'), () => undefined)
  assert.equal(document.querySelector('strong').textContent, '<script>First</script>')
  assert.equal(document.querySelector('script'), null)
  stop()
  stop = observePreviewLinks(document, cards('Second'), () => undefined)
  assert.equal(document.querySelector('strong').textContent, 'Second')
  stop()
  stop = observePreviewLinks(document, new Map(), () => undefined)
  assert.equal(document.querySelector('.external-card'), null)
  assert.equal(document.querySelector('p').textContent, 'Original')
  stop()
  window.happyDOM.abort()
})
