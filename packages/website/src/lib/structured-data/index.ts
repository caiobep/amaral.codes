import { resolveEntryLanguage } from '@amaral.codes/content-contract/entry-language'
import type { EntryData } from '../../content/schemas'
import { resolvePublicAssetUrl } from '../assets'
import { createCanonicalUrl, requireSite } from '../site'

type PodcastEntryData = Pick<EntryData, 'category' | 'date' | 'language' | 'podcast' | 'summary' | 'title'>
type PageSchemaType = 'CollectionPage' | 'ContactPage' | 'ProfilePage' | 'WebPage'

interface ArticleStructuredDataInput {
  datePublished: string
  description: string
  image: string
  language: string
  pathname: string
  title: string
}

function createSiteIdentity(site: URL | undefined) {
  const siteUrl = requireSite(site).toString()
  const personId = new URL('/#person', siteUrl).toString()
  const websiteId = new URL('/#website', siteUrl).toString()
  return {
    personId,
    websiteId,
    personData: {
      '@id': personId,
      '@type': 'Person',
      image: new URL('/photos/profile/about-portrait-1080.webp', siteUrl).toString(),
      name: 'Caio Amaral',
      sameAs: [
        'https://github.com/caiobep',
        'https://ca.linkedin.com/in/caiobep/',
        'https://twitter.com/caicorre',
      ],
      url: new URL('/about/', siteUrl).toString(),
    },
    websiteData: {
      '@id': websiteId,
      '@type': 'WebSite',
      name: 'Caio Amaral',
      publisher: { '@id': personId },
      url: siteUrl,
    },
  }
}

export function createPageStructuredData(input: {
  description: string
  pathname: string
  title: string
  type: PageSchemaType
}, site: URL | undefined) {
  const canonicalUrl = createCanonicalUrl(input.pathname, site)
  const { personData, personId, websiteData, websiteId } = createSiteIdentity(site)
  const pageData = {
    '@id': `${canonicalUrl}#webpage`,
    '@type': input.type,
    author: { '@id': personId },
    description: input.description,
    isPartOf: { '@id': websiteId },
    name: input.title,
    url: canonicalUrl,
    ...(input.type === 'ContactPage'
      ? { about: { '@id': personId } }
      : {}),
    ...(input.type === 'ProfilePage'
      ? { mainEntity: { '@id': personId } }
      : {}),
  }

  return {
    '@context': 'https://schema.org',
    '@graph': [personData, websiteData, pageData],
  }
}

export function createArticleStructuredData(
  input: ArticleStructuredDataInput,
  site: URL | undefined,
) {
  const canonicalUrl = createCanonicalUrl(input.pathname, site)
  const authorUrl = new URL('/about/', requireSite(site)).toString()
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    author: {
      '@type': 'Person',
      name: 'Caio Amaral',
      url: authorUrl,
    },
    datePublished: input.datePublished,
    description: input.description,
    headline: input.title,
    image: input.image,
    inLanguage: input.language,
    mainEntityOfPage: canonicalUrl,
    url: canonicalUrl,
  }
}

export function createPodcastStructuredData(data: PodcastEntryData, canonicalUrl: string) {
  const { date, podcast, summary, title } = data
  if (!podcast) return undefined

  const audioUrl = podcast.audioUrl ? resolvePublicAssetUrl(podcast.audioUrl) : undefined
  return {
    '@context': 'https://schema.org',
    '@type': 'PodcastEpisode',
    datePublished: date,
    description: summary,
    inLanguage: resolveEntryLanguage(data),
    name: title,
    partOfSeries: {
      '@type': 'PodcastSeries',
      name: podcast.show,
    },
    url: canonicalUrl,
    ...(audioUrl
      ? {
          associatedMedia: {
            '@type': 'MediaObject',
            contentUrl: audioUrl,
            encodingFormat: 'audio/mpeg',
          },
        }
      : {}),
  }
}
