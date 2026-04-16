import { Feed } from 'feed';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Helper to get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface PostMetadata {
  slug: string;
  title: string;
  date: Date;
  description: string;
  content: string;
}

async function generateRssFeed() {
  const feed = new Feed({
    title: 'My Personal Blog',
    description: 'A personal blog about web development, tech, and life.',
    id: 'https://my-personal-blog.com/',
    link: 'https://my-personal-blog.com/',
    language: 'en',
    image: 'https://my-personal-blog.com/logo.png', // Optional: Add a logo
    favicon: 'https://my-personal-blog.com/favicon.ico', // Optional: Add a favicon
    copyright: `All rights reserved ${new Date().getFullYear()}, My Personal Blog`,
    updated: new Date(),
    generator: 'My Personal Blog with Feed library',
    feedLinks: {
      rss2: 'https://my-personal-blog.com/rss.xml',
    },
    author: {
      name: 'Your Name',
      email: 'your.email@example.com',
      link: 'https://my-personal-blog.com/about',
    },
  });

  const postsDirectory = path.join(__dirname, '../posts');
  let postFiles: string[] = [];
  try {
    // Dynamically import fs for readdirSync only if available in the environment (Node.js)
    const fs = await import('fs');
    postFiles = fs.readdirSync(postsDirectory).filter(file => file.endsWith('.md'));
  } catch (e) {
    console.warn('Could not read posts directory for RSS generation. This is expected if running in browser context without fs module.');
    console.warn('Please ensure this script is run in a Node.js environment or during a build step.');
    // Fallback or handle for environments where fs is not available (like browser)
    // For this example, we'll proceed without dynamic post loading if fs is not present.
    // In a production setup, this script would run as a build-time step.
  }


  const posts: PostMetadata[] = [];

  for (const file of postFiles) {
    const filePath = path.join(postsDirectory, file);
    const content = readFileSync(filePath, 'utf-8');
    const slug = file.replace('.md', '');

    const titleMatch = content.match(/^#\s(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : 'Untitled Post';

    const dateMatch = content.match(/Date:\s(.+)$/m);
    const date = dateMatch ? new Date(dateMatch[1].trim()) : new Date();

    const descriptionMatch = content.match(/Description:\s(.+)$/m);
    const description = descriptionMatch ? descriptionMatch[1].trim() : content.substring(0, Math.min(content.length, 150)) + '...';


    posts.push({ slug, title, date, description, content });
  }

  posts.sort((a, b) => b.date.getTime() - a.date.getTime());

  posts.forEach((post) => {
    feed.addItem({
      title: post.title,
      id: `https://my-personal-blog.com/post/${post.slug}`,
      link: `https://my-personal-blog.com/post/${post.slug}`,
      description: post.description, // Use description for summary
      content: post.content, // Full content for RSS item
      author: [
        {
          name: 'Your Name',
          email: 'your.email@example.com',
          link: 'https://my-personal-blog.com/about',
        },
      ],
      date: post.date,
    });
  });

  // Output the RSS feed to a file in the public directory (or where it can be served)
  const outputPath = path.join(__dirname, '../../public/rss.xml'); // Adjust path as needed for your build
  writeFileSync(outputPath, feed.rss2(), 'utf-8');
  console.log(`RSS feed generated at ${outputPath}`);
}

// Ensure the public directory exists
const publicDir = path.join(__dirname, '../../public');
try {
  const fs = await import('fs');
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }
} catch (e) {
    console.warn('Could not create public directory. This is expected if running in browser context without fs module.');
}


generateRssFeed();
