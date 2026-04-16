import React, { useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import { posts } from '../data/posts';
import { LucideArrowLeft } from 'lucide-react';

const PostPage: React.FC = () => {
  const { slug } = useParams();
  const post = posts.find(p => p.slug === slug);

  useEffect(() => {
    Prism.highlightAll();
  }, [slug]);

  if (!post) {
    return (
      <main className="max-w-7xl mx-auto p-8">
        <p className="text-center text-red-400">Post not found.</p>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto p-8">
      <Link to="/" className="inline-flex items-center text-primary-400 hover:underline mb-6">
        <LucideArrowLeft className="mr-2" /> Back to home
      </Link>
      <article className="glass-card p-8 rounded-lg border border-white/10 backdrop-blur-xl shadow-md">
        <h1 className="text-4xl font-bold mb-2 text-primary-400">{post.title}</h1>
        <time dateTime={post.date} className="block mb-6 text-sm text-slate-400">
          {new Date(post.date).toLocaleDateString()}
        </time>
        <ReactMarkdown
          children={post.content}
          remarkPlugins={[remarkGfm]}
          components={{
            code({ node, inline, className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '');
              return !inline && match ? (
                <pre className={`language-${match[1]} mb-4 rounded-lg bg-[#011627] p-4 overflow-x-auto`}>
                  <code className={className} {...props}>
                    {String(children).replace(/\n$/, '')}
                  </code>
                </pre>
              ) : (
                <code className={`rounded bg-white/10 px-1 py-[0.15rem] font-mono text-sm`} {...props}>
                  {children}
                </code>
              );
            },
          }}
        />
      </article>
    </main>
  );
};

export default PostPage;
