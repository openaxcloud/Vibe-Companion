import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { posts } from '../data/posts';
import MarkdownRenderer from '../components/MarkdownRenderer';

const BlogPostPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const post = posts.find((p) => p.slug === slug);

  if (!post) {
    return <Navigate to="/" replace />;
  }

  return (
    <article className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-lg shadow-xl p-8 mt-8 animate-fade-in">
      <h1 className="text-4xl font-extrabold text-white mb-4 leading-tight">
        {post.title}
      </h1>
      <p className="text-slate-400 text-md mb-6">
        By <span className="text-primary-300">{post.author}</span> on {new Date(post.date).toLocaleDateString()}
      </p>
      <div className="flex flex-wrap gap-2 mb-8">
        {post.tags.map((tag) => (
          <span key={tag} className="bg-primary-700 text-primary-100 text-sm font-medium px-3 py-1 rounded-full">
            {tag}
          </span>
        ))}
      </div>
      <div className="text-slate-300 leading-relaxed text-lg">
        <MarkdownRenderer content={post.content} />
      </div>
    </article>
  );
};

export default BlogPostPage;
