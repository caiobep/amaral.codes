import { defineCollection, z } from 'astro:content'

const blogPostsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    id: z.string(),
    title: z.string(),
    date: z.string(),
    tags: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        icon: z.string().optional(),
      }),
    ),
  }),
})

export const collections = { 'blog-posts': blogPostsCollection }
