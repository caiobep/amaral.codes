import { defaultEditorFeatures, HeadingFeature, LinkFeature } from '@payloadcms/richtext-lexical'

export const articleFeatures = [
  ...defaultEditorFeatures.filter(({ key }) => !['relationship', 'link', 'heading'].includes(key)),
  HeadingFeature({ enabledHeadingSizes: ['h2', 'h3', 'h4', 'h5', 'h6'] }),
  LinkFeature({ enabledCollections: [] }),
]
