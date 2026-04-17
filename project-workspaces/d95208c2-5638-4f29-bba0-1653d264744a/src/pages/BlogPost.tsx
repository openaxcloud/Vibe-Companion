import { useEffect, useState } from 'react'
import { useParams, Link, Navigate } from 'react-router-dom'
import { Calendar, Clock, User, Tag, ArrowLeft, Share2 } from 'lucide-react'
import { format } from 'date-fns'
import { getPostBySlug, getAllPosts } from '../utils/blog'
import { BlogPost as BlogPostType } from '../types/blog'
import MarkdownRenderer from '../components/MarkdownRenderer'

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>()
  const [post, setPost] = useState<BlogPostType | null>(null)
  const [relatedPosts, setRelatedPosts] = useState<BlogPostType[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slug) return

    const foundPost = getPostBySlug(slug)
    setPost(foundPost)

    if (foundPost) {
      // Find related posts based on common tags
      const allPosts = getAllPosts()
      const related = allPosts
        .filter(p => p.slug !== slug)
        .filter(p => p.tags.some(tag => foundPost.tags.includes(tag)))
        .slice(0, 3)
      
      setRelatedPosts(related)
    }

    setLoading(false)
  }, [slug])

  const handleShare = async () => {
    const url = window.location.href
    const title = post?.title || 'Blog Post'

    if (navigator.share) {
      try {
        await navigator.share({ title, url })
      } catch (err) {
        // Fallback to clipboard
        await navigator.clipboard.writeText(url)
        alert('Link copied to clipboard!')
      }
    } else {
      await navigator.clipboard.writeText(url)
      alert('Link copied to clipboard!')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!post) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="space-y-8">
      {/* Back Button */}
      <Link
        to="/"
        className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-800 transition-colors"
      >
        <ArrowLeft size={20} />
        <span>Back to all posts</span>
      </Link>

      {/* Article Header */}
      <header className="space-y-4">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 leading-tight">
          {post.title}
        </h1>

        <div className="flex flex-wrap items-center text-gray-600 space-x-6">
          <div className="flex items-center space-x-2">
            <Calendar size={18} />
            <span>{format(new Date(post.date), 'MMMM dd, yyyy')}</span>
          </div>

          <div className="flex items-center space-x-2">
            <Clock size={18} />
            <span>{post.readTime} min read</span>
          </div>

          <div className="flex items-center space-x-2">
            <User size={18} />
            <span>{post.author}</span>
          </div>

          <button
            onClick={handleShare}
            className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 transition-colors"
          >
            <Share2 size={18} />
            <span>Share</span>
          </button>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center space-x-1 px-3 py-1 text-sm font-medium bg-blue-100 text-blue-800 rounded-full"
            >
              <Tag size={14} />
              <span>{tag}</span>
            </span>
          ))}
        </div>
      </header>

      {/* Article Content */}
      <article className="bg-white rounded-lg shadow-sm p-8">
        <MarkdownRenderer content={post.content} />
      </article>

      {/* Related Posts */}
      {relatedPosts.length > 0 && (
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">Related Posts</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {relatedPosts.map((relatedPost) => (
              <Link
                key={relatedPost.slug}
                to={`/post/${relatedPost.slug}`}
                className="bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow"
              >
                <h3 className="font-semibold text-gray-900 mb-2 hover:text-blue-600">
                  {relatedPost.title}
                </h3>
                <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                  {relatedPost.excerpt}
                </p>
                <div className="text-xs text-gray-500">
                  {format(new Date(relatedPost.date), 'MMM dd, yyyy')} • {relatedPost.readTime} min read
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}