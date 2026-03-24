import MarketingLayout from "@/components/marketing/MarketingLayout";
import { useParams } from "wouter";
import { Link } from "wouter";
import { ArrowLeft, Calendar, Clock } from "lucide-react";

const posts: Record<string, { title: string; date: string; category: string; readTime: string; content: string[] }> = {
  "introducing-ai-agent": {
    title: "Introducing the E-Code AI Agent",
    date: "2025-03-15",
    category: "Product",
    readTime: "5 min",
    content: [
      "Today we're excited to announce the E-Code AI Agent — a revolutionary new way to build software. Instead of writing every line of code yourself, you can now describe what you want to build and our AI agent will generate the entire application for you.",
      "The AI agent understands your project context, can create files, install packages, write backend APIs, build frontend interfaces, and even deploy your application — all from a simple text prompt.",
      "This isn't just autocomplete or code suggestions. The AI agent is a full coding partner that understands your entire codebase and can make complex, multi-file changes while maintaining consistency across your project.",
      "We've been testing the AI agent with beta users for the past three months, and the results have been remarkable. Teams report shipping features 3-5x faster with the agent's help.",
      "The AI agent is available today on all E-Code plans, with usage-based billing for AI operations. Free tier users get 100 AI operations per month, and Pro users get unlimited operations.",
    ],
  },
  "cloud-ide-2025": {
    title: "The future of cloud IDEs in 2025",
    date: "2025-03-10",
    category: "Engineering",
    readTime: "8 min",
    content: [
      "Cloud IDEs have come a long way from simple text editors in the browser. In 2025, they're becoming the primary development environment for a growing number of teams.",
      "The key trends we see are: AI-first development experiences, zero-configuration environments, instant deployment pipelines, and real-time collaboration as a default.",
      "At E-Code, we're building for this future. Our platform combines a powerful code editor, AI coding agent, instant preview, database hosting, and production deployment into a single seamless experience.",
      "We believe the future of development is one where environment setup takes zero time, deployment is instant, and AI amplifies every developer's capabilities.",
    ],
  },
};

const defaultPost = {
  title: "Blog Post",
  date: "2025-01-01",
  category: "General",
  readTime: "5 min",
  content: ["This blog post is coming soon. Check back later for the full content."],
};

export default function BlogDetail() {
  const params = useParams<{ slug: string }>();
  const post = posts[params.slug || ""] || defaultPost;

  return (
    <MarketingLayout>
      <article className="py-20 lg:py-28 px-6" data-testid="blog-detail">
        <div className="max-w-3xl mx-auto">
          <Link href="/blog" className="inline-flex items-center gap-2 text-sm text-[var(--ide-text-secondary)] hover:text-[var(--ide-text)] mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to blog
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#0079F2]/10 text-[#0079F2]">{post.category}</span>
            <span className="text-xs text-[var(--ide-text-muted)] flex items-center gap-1"><Calendar className="w-3 h-3" /> {post.date}</span>
            <span className="text-xs text-[var(--ide-text-muted)] flex items-center gap-1"><Clock className="w-3 h-3" /> {post.readTime}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-8" data-testid="blog-title">{post.title}</h1>
          <div className="prose prose-invert max-w-none space-y-6">
            {post.content.map((p, i) => (
              <p key={i} className="text-[var(--ide-text-secondary)] leading-relaxed">{p}</p>
            ))}
          </div>
        </div>
      </article>
    </MarketingLayout>
  );
}
