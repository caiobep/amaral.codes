import { z } from 'astro/zod'
import sanitizeHtml from 'sanitize-html'
import {
  SITE_HTML_ALLOWED_ATTRIBUTES,
  SITE_HTML_ALLOWED_SCHEMES,
  SITE_HTML_ALLOWED_TAGS,
  SITE_HTML_IFRAME_HOSTS,
} from '@emdash-cms/admin/html-block'
import { isPublishableUrl } from './body-url'
import { cmsSrcsetUrls, rewriteCmsSrcset } from './body-srcset'

export const htmlBlock = z
  .object({
    _type: z.literal('htmlBlock'),
    html: z.string(),
    css: z.string().optional(),
    js: z.string().optional(),
    isolated: z.boolean().optional(),
  })
  .transform(block => {
    if (block.isolated || block.css || block.js)
      throw new Error(
        'Isolated HTML and executable CSS/JavaScript blocks are not supported for publishing',
      )
    return { _type: block._type, markdown: sanitizeCmsHtml(block.html) }
  })

const htmlPolicy: sanitizeHtml.IOptions = {
  allowedTags: [...SITE_HTML_ALLOWED_TAGS],
  allowedAttributes: Object.fromEntries(
    Object.entries(SITE_HTML_ALLOWED_ATTRIBUTES).map(([tag, attributes]) => [
      tag,
      [...attributes],
    ]),
  ),
  allowedSchemes: [...SITE_HTML_ALLOWED_SCHEMES],
  allowedIframeHostnames: [...SITE_HTML_IFRAME_HOSTS],
}
const urlAttributes = new Set(['href', 'src', 'cite'])

export function sanitizeCmsHtml(
  html: string,
  rewriteUrl?: (url: string) => string,
): string {
  return sanitizeHtml(html, {
    ...htmlPolicy,
    transformTags: {
      '*': (tagName, attributes) =>
        validateHtmlUrls(tagName, attributes, rewriteUrl),
    },
  })
}

function validateHtmlUrls(
  tagName: string,
  attributes: sanitizeHtml.Attributes,
  rewriteUrl: ((url: string) => string) | undefined,
): sanitizeHtml.Tag {
  for (const [attribute, value] of Object.entries(attributes)) {
    attributes[attribute] = rewriteHtmlAttribute(attribute, value, rewriteUrl)
  }
  return { tagName: publicHtmlTag(tagName), attribs: attributes }
}

function rewriteHtmlAttribute(
  attribute: string,
  value: string,
  rewriteUrl: ((url: string) => string) | undefined,
): string {
  if (attribute === 'srcset') return rewriteCmsSrcset(value, rewriteUrl)
  if (!urlAttributes.has(attribute)) return value
  if (!isPublishableUrl(value))
    throw new Error('CMS HTML contains an unsafe or private URL')
  return rewriteUrl ? rewriteUrl(value) : value
}

function publicHtmlTag(tagName: string): string {
  return tagName === 'h1' ? 'h2' : tagName
}

export function cmsHtmlMediaUrls(html: string): string[] {
  try {
    return extractHtmlUrls(sanitizeCmsHtml(html))
  } catch {
    return []
  }
}

function extractHtmlUrls(html: string): string[] {
  const urls: string[] = []
  sanitizeHtml(html, {
    ...htmlPolicy,
    transformTags: {
      '*': (tagName, attribs) => {
        for (const [attribute, value] of Object.entries(attribs)) {
          urls.push(...htmlAttributeUrls(attribute, value))
        }
        return { tagName, attribs }
      },
    },
  })
  return urls
}

function htmlAttributeUrls(attribute: string, value: string): string[] {
  if (attribute === 'srcset') return cmsSrcsetUrls(value)
  return urlAttributes.has(attribute) ? [value] : []
}
