import rss from '@astrojs/rss'
import { getCollection } from 'astro:content'

export async function GET(context) {
  const posts = await getCollection('blog-posts')

  return rss({
    title: 'Caio Amaral',
    description: 'Essays, notes, and short opinions about software, productivity, design, and human-computer interaction.',
    site: context.site,
    items: posts
      .sort((a, b) => new Date(b.data.date).valueOf() - new Date(a.data.date).valueOf())
      .map((post) => ({
        title: post.data.title,
        pubDate: new Date(post.data.date),
        description: post.data.summary && post.data.summary !== 'undefined'
          ? post.data.summary
          : 'A note from Caio Amaral.',
        link: `/posts/${post.slug}/`,
      })),
  })
}
