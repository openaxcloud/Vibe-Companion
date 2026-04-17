import { Link } from 'react-router-dom'
import { Calendar, Clock, User, Tag } from 'lucide-react'
import { format } from 'date-fns'
import { BlogPost } from '../types/blog'

interface BlogPostCardProps {
  post: BlogPost
}

export default function BlogPostCard({ post }: BlogPostCardProps) {
  return (
    <article className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 overflow-hidden">
      <div className="p-6">
        <Link to={`/post/${post.slug}`}>
          <h2 className="text-xl font-semibold text-gray-900 mb-3 hover:text-blue-600 transition-colors">
            {post.title}
          </h2>
        </Link>
        
        <p className="text-gray-600 mb-4 line-clamp-3">
          {post.excerpt}
        </p>
        
        <div className="flex flex-wrap items-center text-sm text-gray-500 mb-4 space-x-4">
          <div className="flex items-center space-x-1">
            <Calendar size={16} />
            <span>{format(new Date(post.date), 'MMM dd, yyyy')}</span>
          </div>
          
          <div className="flex items-center space-x-1">
            <Clock size={16} />
            <span>{post.readTime} min read</span>
          </div>
          
          <div className="flex items-center space-x-1">
            <User size={16} />
            <span>{post.author}</span>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center space-x-1 px-3 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full"
            >
              <Tag size={12} />
              <span>{tag}</span>
            </span>
          ))}
        </div>
      </div>
    </article>
  )
}