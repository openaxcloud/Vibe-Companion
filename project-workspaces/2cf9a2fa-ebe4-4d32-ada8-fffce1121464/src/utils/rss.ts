import { Post } from '../types';

export const generateRssFeed = (posts: Post[]): string => {
  const blogTitle = "My Personal Blog";
  const blogLink = "http://localhost:5173"; // Replace with your actual domain
  const blogDescription = "A personal blog with posts on web development, programming, and more.";

  let rssItems = '';
  posts.forEach((post) => {
    const postLink = `${blogLink}/post/${post.slug}`;
    rssItems += `
      <item>
        <title><![CDATA[${post.title}]]></title>
        <link>${postLink}</link>
        <guid>${postLink}</guid>
        <pubDate>${new Date(post.date).toUTCString()}</pubDate>
        <author><![CDATA[${post.author}]]></author>
        <description><![CDATA[${post.content.substring(0, 200)}...]]></description>
      </item>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title><![CDATA[${blogTitle}]]></title>
    <link>${blogLink}</link>
    <atom:link href="${blogLink}/rss.xml" rel="self" type="application/rss+xml" />
    <description><![CDATA[${blogDescription}]]></description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${rssItems}
  </channel>
</rss>`;
};
