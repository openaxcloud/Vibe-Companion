import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import PostPage from "./pages/PostPage";
import RssFeed from "./pages/RssFeed";

export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/post/:slug" element={<PostPage />} />
          <Route path="/rss.xml" element={<RssFeed />} />
        </Routes>
      </Layout>
    </Router>
  );
}
