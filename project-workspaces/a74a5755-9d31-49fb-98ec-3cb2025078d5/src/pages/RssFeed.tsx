import React from 'react';
import { generateRssFeed } from '../utils/rss';

const RssFeed: React.FC = () => {
  // Assume the base URL is hardcoded for demo; in real use, derive from env or request
  const baseUrl = 'http://localhost:3000';
  const rssXml = generateRssFeed(baseUrl);

  React.useEffect(() => {
    const parser = new DOMParser();
    // No rendering to UI needed, just the XML output for the route
    // This component could be adjusted to server-side rendering if applicable
  }, []);

  return (
    <>
      <pre className="max-w-7xl mx-auto p-8 whitespace-pre-wrap overflow-x-auto text-sm bg-black/80 glass-card border border-white/20 rounded-lg">
        {rssXml}
      </pre>
    </>
  );
};

export default RssFeed;
