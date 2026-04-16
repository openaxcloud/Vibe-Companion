import React, { useEffect } from "react";
import { useParams, Navigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { posts } from "../data/posts";

export default function PostPage() {
  const { slug } = useParams<{ slug: string }>();
  if (!slug) return <Navigate to="/" />;

  const post = posts.find((p) => p.slug === slug);
  if (!post) return <Navigate to="/" />;

  useEffect(() => {
    document.title = `${post.title} - My Blog`;
  }, [post.title]);

  return (
    <article className="prose prose-invert max-w-none">
      <h1 className="text-4xl font-bold mb-4 text-indigo-400">{post.title}</h1>
      <p className="mb-2 text-indigo-300 italic">{post.date}</p>
      <ReactMarkdown
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            return !inline && match ? (
              <SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div" {...props}>
                {String(children).replace(/\n$/, "")}
              </SyntaxHighlighter>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {post.content}
      </ReactMarkdown>
    </article>
  );
}
