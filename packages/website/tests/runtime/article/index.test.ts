import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { element, mount } from '../dom'
import { createArticleBootstrapScript, initializeArticleBeforePaint } from '../../../src/features/articles/article.client'

describe('article standalone links', () => {
  let browser: ReturnType<typeof mount>

  beforeEach(() => {
    vi.resetModules()
    browser = mount()
  })

  afterEach(async () => {
    await browser.happyDOM.close()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('generates a synchronous standalone bootstrap before article paint', () => {
    document.body.innerHTML = '<div class="content"><p><a href="https://example.com">A reference</a></p></div>'

    window.eval(createArticleBootstrapScript())

    expect(element('.external-card strong').textContent).toBe('A reference')
    expect(document.querySelector('.content p')).toBeNull()
  })

  it.each(['A useful reference', 'example.com'])('enhances a standalone link titled %s on initial load', (title) => {
    document.body.innerHTML = `<div class="content"><p>
      <a href="https://www.example.com/reference?view=full">${title}</a>
    </p></div>`
    const original = element('a')

    initializeArticleBeforePaint()

    const card = element('.external-card', HTMLAnchorElement)
    expect(card.href).toBe('https://www.example.com/reference?view=full')
    expect(card.target).toBe('_blank')
    expect(card.rel).toBe('noopener noreferrer')
    expect(card.querySelector('span')?.textContent).toBe('example.com')
    expect(card.querySelector('strong')?.textContent).toBe(title)
    expect(document.querySelector('.content p')).toBeNull()
    expect(original.isConnected).toBe(false)
  })

  it.each([
    ['inline prefix', '<p>Read <a href="https://example.com">this reference</a></p>'],
    ['inline suffix', '<p><a href="https://example.com">This reference</a> has details.</p>'],
    ['multiple links', '<p><a href="https://example.com/one">One</a> <a href="https://example.com/two">Two</a></p>'],
    ['empty link', '<p><a href="https://example.com"></a></p>'],
    ['whitespace-only link', '<p><a href="https://example.com"> \n </a></p>'],
    ['plain paragraph', '<p>A paragraph without links.</p>'],
    ['empty paragraph', '<p></p>'],
    ['nested link', '<p><strong><a href="https://example.com">A reference</a></strong></p>'],
    ['sibling element', '<p><a href="https://example.com">A reference</a><span></span></p>'],
  ])('leaves an %s paragraph untouched', (_name, markup) => {
    document.body.innerHTML = `<div class="content">${markup}</div>`
    const paragraph = element('p')
    const originalMarkup = paragraph.outerHTML

    initializeArticleBeforePaint()
    document.dispatchEvent(new Event('astro:page-load'))

    expect(element('p')).toBe(paragraph)
    expect(paragraph.outerHTML).toBe(originalMarkup)
    expect(document.querySelector('.external-card')).toBeNull()
  })

  it('leaves standalone links outside article content untouched', () => {
    document.body.innerHTML = '<footer><p><a href="https://example.com">A reference</a></p></footer>'
    const paragraph = element('p')
    const originalMarkup = paragraph.outerHTML

    initializeArticleBeforePaint()
    document.dispatchEvent(new Event('astro:page-load'))

    expect(element('p')).toBe(paragraph)
    expect(paragraph.outerHTML).toBe(originalMarkup)
    expect(document.querySelector('.external-card')).toBeNull()
  })

  it('enhances swapped content on page load without replacing existing cards again', () => {
    initializeArticleBeforePaint()
    document.body.innerHTML = '<div class="content"><p><a href="https://example.com/first">First reference</a></p></div>'
    document.dispatchEvent(new Event('astro:page-load'))
    const firstCard = element('.external-card')
    document.dispatchEvent(new Event('astro:page-load'))
    expect(element('.external-card')).toBe(firstCard)
    expect(document.querySelectorAll('.external-card')).toHaveLength(1)

    document.body.innerHTML = '<div class="content"><p><a href="https://example.com/next">Next reference</a></p></div>'
    document.dispatchEvent(new Event('astro:page-load'))

    expect(element('.external-card', HTMLAnchorElement).href).toBe('https://example.com/next')
    expect(element('.external-card strong').textContent).toBe('Next reference')
    expect(document.querySelectorAll('.external-card')).toHaveLength(1)
    expect(firstCard.isConnected).toBe(false)
  })

  it('renders link text as text rather than interpreting it as markup', () => {
    document.body.innerHTML = '<div class="content"><p><a href="https://example.com/reference"></a></p></div>'
    const title = '<img src=x onerror="alert(1)"> & <script>alert(2)</script>'
    element('a').textContent = title

    initializeArticleBeforePaint()

    expect(element('.external-card strong').textContent).toBe(title)
    expect(element('.external-card strong').childElementCount).toBe(0)
    expect(document.querySelector('img, script, [onerror]')).toBeNull()
  })

  it('uses the original destination as the label when its URL cannot be parsed', () => {
    document.body.innerHTML = '<div class="content"><p><a href="http://[">A malformed reference</a></p></div>'

    initializeArticleBeforePaint()

    expect(element('.external-card').getAttribute('href')).toBe('http://[')
    expect(element('.external-card span').textContent).toBe('http://[')
    expect(element('.external-card strong').textContent).toBe('A malformed reference')
  })
})
