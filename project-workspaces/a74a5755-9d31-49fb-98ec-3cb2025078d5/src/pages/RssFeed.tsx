import React from "react";
import { generateRssXml } from "../utils/rss";
import { posts } from "../data/posts";

export default function RssFeed() {
  const rssXml = generateRssXml(posts);
  return (
    <pre className="whitespace-pre-wrap bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 text-indigo-200 overflow-auto max-w-7xl mx-auto">
      {rssXml}
    </pre>
  );
}
