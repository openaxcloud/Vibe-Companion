export interface BlogPost {
  slug: string
  title: string
  date: string
  excerpt: string
  content: string
  tags: string[]
  author: string
  readTime: number
}

export interface BlogMetadata {
  title: string
  date: string
  excerpt: string
  tags: string[]
  author: string
}