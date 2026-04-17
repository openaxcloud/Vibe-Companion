import matter from 'gray-matter'
import { BlogPost, BlogMetadata } from '../types/blog'

// Sample blog posts data - in a real app, this would come from a CMS or markdown files
const blogPosts: Record<string, string> = {
  'welcome-to-my-blog': `---
title: Welcome to My Blog
date: 2024-01-15
excerpt: This is my first blog post where I introduce myself and talk about what you can expect from this blog.
tags: [introduction, personal, web-development]
author: John Doe
---

# Welcome to My Blog!

Hello and welcome to my personal blog! I'm excited to share my thoughts, experiences, and learnings with you.

## What You Can Expect

This blog will cover a variety of topics including:

- **Web Development**: Tips, tricks, and tutorials
- **Technology Insights**: Latest trends and innovations  
- **Personal Projects**: Behind-the-scenes of what I'm building
- **Career Growth**: Lessons learned and advice

## Why I Started This Blog

I believe in the power of sharing knowledge and experiences. Through this blog, I hope to:

1. Document my learning journey
2. Help others facing similar challenges
3. Build a community of like-minded individuals
4. Improve my writing and communication skills

## Technology Stack

This blog is built with:

\`\`\`typescript
// React + TypeScript + Vite
const tech = {
  frontend: 'React',
  language: 'TypeScript',
  bundler: 'Vite',
  styling: 'Tailwind CSS',
  markdown: 'react-markdown',
  highlighting: 'rehype-highlight'
}
\`\`\`

Stay tuned for more content, and feel free to reach out if you have any questions or suggestions!`,

  'mastering-react-hooks': `---
title: Mastering React Hooks - A Deep Dive
date: 2024-01-10
excerpt: Learn advanced React hooks patterns and best practices for building robust applications.
tags: [react, javascript, hooks, frontend]
author: John Doe
---

# Mastering React Hooks - A Deep Dive

React hooks have revolutionized the way we write React components. Let's explore some advanced patterns and best practices.

## Custom Hooks

Custom hooks are a powerful way to extract component logic into reusable functions.

\`\`\`typescript
function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? JSON.parse(item) : initialValue
    } catch (error) {
      return initialValue
    }
  })

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)
      window.localStorage.setItem(key, JSON.stringify(valueToStore))
    } catch (error) {
      console.log(error)
    }
  }

  return [storedValue, setValue] as const
}
\`\`\`

## useCallback and useMemo

Understanding when and how to use these optimization hooks is crucial:

\`\`\`typescript
const ExpensiveComponent = ({ data, filter }: Props) => {
  // Memoize expensive calculations
  const processedData = useMemo(() => {
    return data.filter(item => item.includes(filter))
      .map(item => expensiveTransformation(item))
  }, [data, filter])

  // Memoize event handlers
  const handleClick = useCallback((id: string) => {
    console.log('Clicked:', id)
  }, [])

  return (
    <div>
      {processedData.map(item => (
        <Item key={item.id} data={item} onClick={handleClick} />
      ))}
    </div>
  )
}
\`\`\`

## Best Practices

1. **Keep hooks at the top level** - Never call hooks inside loops, conditions, or nested functions
2. **Use custom hooks for complex state logic** - Extract reusable stateful logic
3. **Optimize with care** - Don't overuse useMemo and useCallback
4. **Follow the rules of hooks** - Use the ESLint plugin to catch violations

Happy coding!`,

  'building-scalable-apis': `---
title: Building Scalable APIs with Node.js
date: 2024-01-05
excerpt: Best practices for designing and implementing scalable REST APIs that can handle growth.
tags: [nodejs, api, backend, scalability]
author: John Doe
---

# Building Scalable APIs with Node.js

Creating APIs that can scale with your application's growth is crucial for long-term success.

## API Design Principles

### 1. RESTful Design
Follow REST conventions for predictable and intuitive APIs:

\`\`\`
GET    /api/users          # Get all users
GET    /api/users/:id      # Get specific user
POST   /api/users          # Create user
PUT    /api/users/:id      # Update user
DELETE /api/users/:id      # Delete user
\`\`\`

### 2. Proper HTTP Status Codes

\`\`\`typescript
// Success responses
200 - OK (GET, PUT)
201 - Created (POST)
204 - No Content (DELETE)

// Client error responses
400 - Bad Request
401 - Unauthorized
403 - Forbidden
404 - Not Found
422 - Unprocessable Entity

// Server error responses
500 - Internal Server Error
502 - Bad Gateway
503 - Service Unavailable
\`\`\`

## Performance Optimization

### Database Indexing
\`\`\`sql
-- Index frequently queried columns
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
\`\`\`

### Caching Strategy
\`\`\`typescript
import Redis from 'ioredis'

const redis = new Redis()

async function getCachedUser(userId: string) {
  const cached = await redis.get(\`user:\${userId}\`)
  
  if (cached) {
    return JSON.parse(cached)
  }
  
  const user = await User.findById(userId)
  await redis.setex(\`user:\${userId}\`, 3600, JSON.stringify(user))
  
  return user
}
\`\`\`

### Rate Limiting
\`\`\`typescript
import rateLimit from 'express-rate-limit'

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
})

app.use('/api/', limiter)
\`\`\`

## Error Handling

\`\`\`typescript
class APIError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message)
    Object.setPrototypeOf(this, APIError.prototype)
  }
}

app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof APIError) {
    return res.status(err.statusCode).json({
      error: {
        message: err.message,
        status: err.statusCode
      }
    })
  }
  
  // Log unexpected errors
  console.error(err)
  
  res.status(500).json({
    error: {
      message: 'Internal server error',
      status: 500
    }
  })
})
\`\`\`

These patterns will help you build APIs that can grow with your application!`
}

function calculateReadTime(content: string): number {
  const wordsPerMinute = 200
  const words = content.split(/\s+/).length
  return Math.ceil(words / wordsPerMinute)
}

export function getAllPosts(): BlogPost[] {
  return Object.entries(blogPosts).map(([slug, content]) => {
    const { data, content: markdownContent } = matter(content)
    const metadata = data as BlogMetadata
    
    return {
      slug,
      title: metadata.title,
      date: metadata.date,
      excerpt: metadata.excerpt,
      content: markdownContent,
      tags: metadata.tags || [],
      author: metadata.author,
      readTime: calculateReadTime(markdownContent)
    }
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export function getPostBySlug(slug: string): BlogPost | null {
  const content = blogPosts[slug]
  if (!content) return null
  
  const { data, content: markdownContent } = matter(content)
  const metadata = data as BlogMetadata
  
  return {
    slug,
    title: metadata.title,
    date: metadata.date,
    excerpt: metadata.excerpt,
    content: markdownContent,
    tags: metadata.tags || [],
    author: metadata.author,
    readTime: calculateReadTime(markdownContent)
  }
}

export function generateRSSFeed(): string {
  const posts = getAllPosts()
  const siteUrl = 'https://yourdomain.com'
  const feedDate = new Date().toUTCString()
  
  const rssItems = posts.map(post => `
    <item>
      <title><![CDATA[${post.title}]]></title>
      <description><![CDATA[${post.excerpt}]]></description>
      <link>${siteUrl}/post/${post.slug}</link>
      <guid isPermaLink="true">${siteUrl}/post/${post.slug}</guid>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      <author>your-email@example.com (${post.author})</author>
    </item>
  `).join('')
  
  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Personal Blog</title>
    <description>A personal blog about web development, technology, and more</description>
    <link>${siteUrl}</link>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml" />
    <lastBuildDate>${feedDate}</lastBuildDate>
    <language>en-us</language>
    ${rssItems}
  </channel>
</rss>`
}