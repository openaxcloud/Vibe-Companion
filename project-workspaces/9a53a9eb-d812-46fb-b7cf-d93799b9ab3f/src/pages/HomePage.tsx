import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Post } from '../types/post';

function HomePage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPosts() {
      try {
        // In a real app, this would fetch from an API or a content management system.
        // For this static blog, we'll simulate fetching from a list of available posts.
        const postModules = import.meta.glob('../posts/*.md', { as: 'raw', eager: true });
        const loadedPosts: Post[] = [];

        for (const path in postModules) {
          const content = postModules[path];
          const slug = path.split('/').pop()?.replace('.md', '') || 'unknown';
          
          // Basic metadata extraction (title, date). In a real app, use gray-matter or similar.
          const titleMatch = content.match(/^#\s(.+)$/m);
          const title = titleMatch ? titleMatch[1].trim() : 'Untitled Post';

          const dateMatch = content.match(/Date:\s(.+)$/m);
          const date = dateMatch ? new Date(dateMatch[1].trim()) : new Date();

          const descriptionMatch = content.match(/Description:\s(.+)$/m);
          const description = descriptionMatch ? descriptionMatch[1].trim() : content.substring(0, 150) + '...';


          loadedPosts.push({
            slug,
            title,
            date,
            content, // full content might not be needed for listing, but useful for detail page
            description
          });
        }
        
        // Sort posts by date, newest first
        loadedPosts.sort((a, b) => b.date.getTime() - a.date.getTime());
        setPosts(loadedPosts);
      } catch (err) {
        console.error('Failed to load posts:', err);
        setError('Failed to load blog posts.');
      } finally {
        setLoading(false);
      }
    }
    fetchPosts();
  }, []);

  if (loading) {
    return (
      <div className="text-center py-10">
        <h2 className="text-3xl font-bold text-white mb-4">Loading Posts...</h2>
        <p className="text-slate-400">Please wait while we fetch the latest articles.</p>
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-10 text-red-400 text-lg">{error}</div>;
  }

  if (posts.length === 0) {
    return (
      <div className="text-center py-10">
        <h2 className="text-3xl font-bold text-white mb-4">No posts yet!</h2>
        <p className="text-slate-400">Stay tuned for exciting new content.</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <h1 className="text-5xl font-extrabold text-white mb-8 text-center animate-fade-in-up">
        Welcome to My Blog
      </h1>
      <p className="text-xl text-slate-300 text-center mb-12 max-w-2xl mx-auto animate-fade-in-up delay-100">
        Exploring technology, programming, and life one post at a time.
      </p>

      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-2">
        {posts.map((post) => (
          <Link
            to={`/post/${post.slug}`}
            key={post.slug}
            className="block transform transition-all duration-300 ease-in-out hover:scale-[1.02] hover:shadow-primary-500/30 hover:shadow-2xl
                       bg-white/5 backdrop-blur-lg border border-white/10 rounded-xl p-6 relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <article className="relative z-10">
              <h2 className="text-3xl font-bold text-white mb-3 leading-tight">
                {post.title}
              </h2>
              <p className="text-slate-400 text-sm mb-4">
                {new Date(post.date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
              <p className="text-slate-300 leading-relaxed mb-5">
                {post.description}
              </p>
              <span className="inline-flex items-center text-primary-300 hover:text-primary-200 transition-colors duration-200 font-medium">
                Read More &rarr;
              </span>
            </article>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default HomePage;
