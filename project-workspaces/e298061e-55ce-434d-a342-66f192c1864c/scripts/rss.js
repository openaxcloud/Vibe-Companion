// Generate RSS feed dynamically
const fs = require('fs');
const { parseMarkdown } = require('./utils');

const posts = [
  { title: 'First Post', date: '2023-01-01', url: '/posts/first-post.html' },
  { title: 'Second Post', date: '2023-02-01', url: '/posts/second-post.html' },
];

const generateRSS = () => {
  const rssItems = posts.map(post => `
    <item>
      <title>${post.title}</title>
      <link>${post.url}</link>
      <pubDate>${post.date}</pubDate>
    </item>`).join('');

  const rssFeed = `<?xml version="1.0" encoding="UTF-8" ?>
  <rss version="2.0">
    <channel>
      <title>My Personal Blog</title>
      <link>/</link>
      <description>Personal blog by me</description>
      ${rssItems}
    </channel>
  </rss>`;

  fs.writeFileSync('./public/rss.xml', rssFeed);
};

generateRSS();