export interface Post {
  slug: string;
  title: string;
  date: string; // ISO date string
  summary: string;
  content: string; // markdown content
}

export const posts: Post[] = [
  {
    slug: "welcome",
    title: "Welcome to My Blog",
    date: "2026-04-14",
    summary: "An introduction to my personal blog where I share insights and tutorials.",
    content: `# Welcome to My Blog

This is my first post. Here I will share various topics including programming, technology, and personal insights.

## Features

- Markdown support
- Syntax highlighting for code blocks
- RSS feed generation


def helloWorld() {
  console.log("Hello, world!");
}

Thanks for reading!`,
  },
  {
    slug: "typescript-tips",
    title: "Top 10 TypeScript Tips",
    date: "2026-04-15",
    summary: "Improve your TypeScript skills with these essential tips.",
    content: `# Top 10 TypeScript Tips

Here are some tips to help you work better with TypeScript:

1. Use strict mode.
2. Use type aliases and interfaces.
3. Leverage union and intersection types.


type User = {
  id: number;
  name: string;
  email?: string;
};

Hope you find these tips useful!`,
  },
];
