import React from 'react';
import BlogPostCard from '../components/BlogPostCard';
import { posts } from '../data/posts';

const HomePage: React.FC = () => {
  return (
    <div className="py-8">
      <h1 className="text-4xl font-extrabold text-white mb-8 text-center">
        Welcome to My Blog
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {posts.map((post) => (
          <BlogPostCard key={post.slug} post={post} />
        ))}
      </div>
    </div>
  );
};

export default HomePage;
