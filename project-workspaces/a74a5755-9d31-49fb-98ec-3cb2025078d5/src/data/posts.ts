import type { Post } from '../types';

// Sample realistic posts data
export const posts: Post[] = [
  {
    id: '1',
    slug: 'welcome-to-my-blog',
    title: 'Welcome to My Personal Blog',
    date: '2024-04-10',
    summary: 'Discover my thoughts on tech, programming, and life.',
    content: `# Welcome to my blog\n\nThis is the very first post on my personal blog built with **React**, **TypeScript**, and **Markdown** support!\n\n## Features\n- Markdown rendering\n- Syntax highlighting\n- RSS feed generation\n\nEnjoy reading and feel free to reach out!`,
  },
  {
    id: '2',
    slug: 'typescript-and-beyond',
    title: 'TypeScript and Beyond',
    date: '2024-04-14',
    summary: 'Exploring advanced TypeScript features with real examples.',
    content: `# TypeScript and Beyond\n\nIn this post, we delve into the powerful features of TypeScript:\n\n\`\`\`ts\nfunction greet(name: string): string {\n  return `Hello, ${name}!`;\n}\n\`\`\`\n\nThis lets you write safer and more expressive code.`,
  },
];
