import RSS from "rss";
import type { Post } from "../types";

export function generateRssXml(posts: Post[]): string {
  const feed = new RSS({
    title: "My Blog",
    description: "Latest posts from My Blog",
    feed_url: "http://localhost:3000/rss.xml",
    site_url: "http://localhost:3000",
    pubDate: new Date(),
  });

  posts.forEach((post) => {
    feed.item({
      title: post.title,
      description: post.summary,
      url: `http://localhost:3000/post/${post.slug}`,
      date: new Date(post.date),
    });
  });

  return feed.xml({ indent: true });
}
