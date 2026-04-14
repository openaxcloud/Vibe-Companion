import React from 'react';
import { Link } from 'react-router-dom';
import { Post } from '../types';

interface BlogPostCardProps {
  post: Post;
}

const BlogPostCard: React.FC<BlogPostCardProps> = ({ post }) => {
  return (
    <article className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg shadow-xl p-6 hover:shadow-primary-500/30 transition-all duration-300 ease-out">
      <Link to={`/post/${post.slug}`}>
        <h2 className="text-2xl font-bold text-white hover:text-primary-400 transition-colors duration-200 mb-2">
          {post.title}
        </h2>
      </Link>
      <p className="text-slate-400 text-sm mb-4">
        By <span className="text-primary-300">{post.author}</span> on {new Date(post.date).toLocaleDateString()}
      </p>
      <div className="flex flex-wrap gap-2 mb-4">
        {post.tags.map((tag) => (
          <span key={tag} className="bg-primary-700 text-primary-100 text-xs font-medium px-2.5 py-0.5 rounded-full">
            {tag}
          </span>
        ))}
      </div>
      <Link to={`/post/${post.slug}`}>
        <button className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors duration-200">
          Read More
        </button>
      </Link>
    </article>
  );
};

export default BlogPostCard;
