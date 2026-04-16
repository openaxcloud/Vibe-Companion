import RSS from 'rss';
import { posts } from '../data/posts';
import type { Post } from '../types';

export function generateRssFeed(baseUrl: string): string {
  const feed = new RSS({
    title: "My Personal Blog",
    description: "Latest posts from my personal blog",
    feed_url: `${baseUrl}/rss.xml`,
    site_url: baseUrl,
    language: 'en',
  });

  posts.forEach((post: Post) => {
    feed.item({
      title: post.title,
      description: post.summary,
      url: `${baseUrl}/post/${post.slug}`,
      date: post.date,
    });
  });

  return feed.xml({ indent: true });
}
