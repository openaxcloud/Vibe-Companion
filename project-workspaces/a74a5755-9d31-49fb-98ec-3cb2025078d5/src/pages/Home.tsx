import React from "react";
import { Link } from "react-router-dom";
import { posts } from "../data/posts";

export default function Home() {
  return (
    <section className="space-y-8">
      <h2 className="text-4xl font-bold text-indigo-400">Latest Posts</h2>
      {posts.map((post) => (
        <article
          key={post.slug}
          className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-glow shadow-indigo-900 hover:shadow-indigo-700 transition-shadow duration-300"
        >
          <Link to={`/post/${post.slug}`}>
            <h3 className="text-2xl font-semibold text-white hover:text-indigo-300">
              {post.title}
            </h3>
          </Link>
          <p className="mt-2 text-indigo-200 text-sm">{post.date}</p>
          <p className="mt-4 text-indigo-100 leading-relaxed">{post.summary}</p>
        </article>
      ))}
    </section>
  );
}
