import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { ArrowLeft } from 'lucide-react';
import { Post } from '../types/post';

function BlogPostPage() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPost() {
      if (!slug) {
        setError('Post slug is missing.');
        setLoading(false);
        return;
      }

      try {
        const postModule = await import(`../posts/${slug}.md?raw`);
        const content = postModule.default;
        
        // Basic metadata extraction (title, date). In a real app, use gray-matter or similar.
        const titleMatch = content.match(/^#\s(.+)$/m);
        const title = titleMatch ? titleMatch[1].trim() : 'Untitled Post';

        const dateMatch = content.match(/Date:\s(.+)$/m);
        const date = dateMatch ? new Date(dateMatch[1].trim()) : new Date();

        const descriptionMatch = content.match(/Description:\s(.+)$/m);
        const description = descriptionMatch ? descriptionMatch[1].trim() : content.substring(0, 150) + '...';

        setPost({ slug, title, date, content, description });
      } catch (err: any) {
        if (err.message.includes('Unknown variable dynamic import')) {
          setError('Post not found.');
        } else {
          console.error('Failed to load post:', err);
          setError('Failed to load blog post.');
        }
      } finally {
        setLoading(false);
      }
    }
    fetchPost();
  }, [slug]);

  if (loading) {
    return (
      <div className="text-center py-10">
        <h2 className="text-3xl font-bold text-white mb-4">Loading Post...</h2>
        <p className="text-slate-400">Getting your article ready.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10">
        <p className="text-red-400 text-lg mb-4">{error}</p>
        <Link to="/" className="inline-flex items-center text-primary-300 hover:text-primary-200 transition-colors duration-200">
          <ArrowLeft className="w-5 h-5 mr-2" /> Back to Home
        </Link>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="text-center py-10">
        <p className="text-red-400 text-lg mb-4">Post not found.</p>
        <Link to="/" className="inline-flex items-center text-primary-300 hover:text-primary-200 transition-colors duration-200">
          <ArrowLeft className="w-5 h-5 mr-2" /> Back to Home
        </Link>
      </div>
    );
  }

  return (
    <article className="prose prose-invert max-w-none prose-h1:text-4xl prose-h1:font-extrabold prose-h1:text-white
                        prose-h2:text-3xl prose-h2:font-bold prose-h2:text-white
                        prose-h3:text-2xl prose-h3:font-bold prose-h3:text-white
                        prose-p:text-slate-300 prose-a:text-primary-300 hover:prose-a:text-primary-200
                        prose-li:text-slate-300 prose-strong:text-white
                        prose-code:bg-white/10 prose-code:text-primary-300 prose-code:rounded-md prose-code:p-1
                        prose-pre:bg-slate-800 prose-pre:rounded-lg prose-pre:p-4
                        ">
      <Link to="/" className="inline-flex items-center text-primary-300 hover:text-primary-200 transition-colors duration-200 mb-6">
        <ArrowLeft className="w-5 h-5 mr-2" /> Back to Blog
      </Link>
      <h1 className="mt-0">{post.title}</h1>
      <p className="text-slate-400 text-sm mb-8">
        Published on{' '}
        {new Date(post.date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}
      </p>
      <div className="markdown-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ node, inline, className, children, ...props }) {
              const match = /language-(\w+)/.exec(className || '');
              return !inline && match ? (
                <SyntaxHighlighter
                  style={dark} // Using 'dark' style from react-syntax-highlighter
                  language={match[1]}
                  PreTag="div"
                  {...props}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              ) : (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            },
            h1: ({node, ...props}) => <h1 className="text-4xl font-extrabold text-white mb-4 mt-8" {...props} />,
            h2: ({node, ...props}) => <h2 className="text-3xl font-bold text-white mb-3 mt-7" {...props} />,
            h3: ({node, ...props}) => <h3 className="text-2xl font-bold text-white mb-2 mt-6" {...props} />,
            p: ({node, ...props}) => <p className="text-lg text-slate-300 leading-relaxed mb-4" {...props} />,
            ul: ({node, ...props}) => <ul className="list-disc list-inside text-slate-300 mb-4 ml-5 space-y-2" {...props} />,
            ol: ({node, ...props}) => <ol className="list-decimal list-inside text-slate-300 mb-4 ml-5 space-y-2" {...props} />,
            li: ({node, ...props}) => <li className="text-lg" {...props} />,
            a: ({node, ...props}) => <a className="text-primary-300 hover:text-primary-200 transition-colors duration-200 underline" {...props} />,
          }}
        >
          {post.content}
        </ReactMarkdown>
      </div>
    </article>
  );
}

export default BlogPostPage;
