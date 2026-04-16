import React from 'react';
import { Link } from 'react-router-dom';
import { posts } from '../data/posts';
import { LucideBook, LucideCalendar } from 'lucide-react';

const Home: React.FC = () => {
  return (
    <main className="max-w-7xl mx-auto p-8">
      <h1 className="text-4xl font-bold mb-8 border-b border-white/20 pb-2">My Personal Blog</h1>
      <ul className="space-y-6">
        {posts.map(post => (
          <li
            key={post.id}
            className="glass-card p-6 rounded-lg border border-white/10 backdrop-blur-xl shadow-md hover:scale-[1.02] transition-transform duration-200"
          >
            <Link to={`/post/${post.slug}`} className="block">
              <h2 className="text-2xl font-semibold mb-2 text-primary-400 hover:underline">{post.title}</h2>
              <p className="flex items-center text-sm text-slate-400 mb-2">
                <LucideCalendar className="mr-2 h-4 w-4" />
                {new Date(post.date).toLocaleDateString()}
              </p>
              <p className="text-slate-300">{post.summary}</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
};

export default Home;
