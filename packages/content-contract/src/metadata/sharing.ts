import { z } from 'zod'
import { isPublicUrl, isPublicHttpsUrl, isRootRelativePublicUrl } from '../public-url/index.ts'

const text = z.string().trim().min(1)
const imageUrl = z.string().trim().refine(value => isRootRelativePublicUrl(value) || isPublicHttpsUrl(value), 'Use a root-relative or public HTTPS image URL without credentials.')
const imageFields = { image: imageUrl.optional(), imageAlt: text.optional() }

function validateImage(value: { image?: string | undefined, imageAlt?: string | undefined }, context: z.RefinementCtx) {
  if (Boolean(value.image) !== Boolean(value.imageAlt)) {
    context.addIssue({ code: 'custom', path: ['imageAlt'], message: 'A sharing image needs alternative text, and alternative text needs an image.' })
  }
}

export const sharingSchema = z.object({
  title: text.max(180).optional(),
  description: text.max(320).optional(),
  ...imageFields,
}).strict().superRefine(validateImage)

export const linkCardSchema = z.object({
  url: z.url().refine(isPublicUrl, 'Use a public link URL without credentials.'),
  title: text.max(180),
  description: text.max(320).optional(),
  ...imageFields,
}).strict().superRefine(validateImage)
