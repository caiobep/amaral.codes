import { describe, expect, it } from 'vitest'
import { PUBLIC_ASSET_ORIGIN } from '../assets'
import {
  createArticleStructuredData,
  createPageStructuredData,
  createPodcastStructuredData,
} from '.'

const site = new URL('https://amaral.codes')

describe('createPageStructuredData', () => {
  it('connects a public page to the canonical website and person', () => {
    const structuredData = createPageStructuredData({
      description: 'About Caio Amaral.',
      pathname: '/about/',
      title: 'About',
      type: 'ProfilePage',
    }, site)

    expect(structuredData['@graph']).toEqual(expect.arrayContaining([
      expect.objectContaining({
        '@id': 'https://amaral.codes/#person',
        '@type': 'Person',
        url: 'https://amaral.codes/about/',
      }),
      expect.objectContaining({ '@id': 'https://amaral.codes/#website', '@type': 'WebSite' }),
      expect.objectContaining({
        '@id': 'https://amaral.codes/about/#webpage',
        '@type': 'ProfilePage',
        mainEntity: { '@id': 'https://amaral.codes/#person' },
      }),
    ]))
  })

  it('does not make a collection page a person profile', () => {
    const structuredData = createPageStructuredData({
      description: 'Notes by Caio Amaral.',
      pathname: '/posts/',
      title: 'Notes',
      type: 'CollectionPage',
    }, site)
    const page = structuredData['@graph'].find((item) => item['@type'] === 'CollectionPage')

    expect(page).not.toHaveProperty('mainEntity')
  })

  it('relates the contact page to the person', () => {
    const structuredData = createPageStructuredData({
      description: 'Contact Caio Amaral.',
      pathname: '/contact/',
      title: 'Contact',
      type: 'ContactPage',
    }, site)
    const page = structuredData['@graph'].find((item) => item['@type'] === 'ContactPage')

    expect(page).toHaveProperty('about', { '@id': 'https://amaral.codes/#person' })
  })
})

describe('createArticleStructuredData', () => {
  it('uses the configured site for canonical article metadata', () => {
    const structuredData = createArticleStructuredData({
      datePublished: '2026-07-30',
      description: 'A useful note.',
      image: 'https://amaral.codes/social/article-default.jpg',
      language: 'en',
      pathname: '/posts/a-note',
      title: 'A note',
    }, site)

    expect(structuredData).toMatchObject({
      '@type': 'BlogPosting',
      mainEntityOfPage: 'https://amaral.codes/posts/a-note',
      url: 'https://amaral.codes/posts/a-note',
    })
  })
})

describe('createPodcastStructuredData', () => {
  it('publishes canonical object-storage URLs for locally expressed podcast audio', () => {
    const structuredData = createPodcastStructuredData({
      date: '2026-07-27',
      podcast: {
        audioUrl: '/podcasts/episode.mp3',
        players: [],
        show: 'Example show',
        sourceUrl: 'https://publisher.example/episode',
      },
      summary: 'An example episode.',
      title: 'Example episode',
    }, 'https://amaral.codes/posts/example/')

    expect(structuredData?.associatedMedia?.contentUrl)
      .toBe(`${PUBLIC_ASSET_ORIGIN}/podcasts/episode.mp3`)
  })

  it('keeps publisher-hosted audio URLs unchanged', () => {
    const audioUrl = 'https://publisher.example/episode.mp3'
    const structuredData = createPodcastStructuredData({
      date: '2026-07-27',
      podcast: {
        audioUrl,
        players: [],
        show: 'Example show',
        sourceUrl: 'https://publisher.example/episode',
      },
      summary: undefined,
      title: 'Example episode',
    }, 'https://amaral.codes/posts/example/')

    expect(structuredData?.associatedMedia?.contentUrl).toBe(audioUrl)
    expect(structuredData?.description).toBeUndefined()
  })

  it('omits absent audio and summaries', () => {
    const structuredData = createPodcastStructuredData({
      date: '2026-07-27',
      podcast: {
        players: [],
        show: 'Example show',
        sourceUrl: 'https://publisher.example/episode',
      },
      summary: undefined,
      title: 'Example episode',
    }, 'https://amaral.codes/posts/example/')

    expect(structuredData).not.toHaveProperty('associatedMedia')
    expect(structuredData?.description).toBeUndefined()
  })

  it('does not create podcast data for another entry type', () => {
    expect(createPodcastStructuredData({
      date: '2026-07-27',
      podcast: undefined,
      summary: undefined,
      title: 'Example note',
    }, 'https://amaral.codes/posts/example/')).toBeUndefined()
  })
})
