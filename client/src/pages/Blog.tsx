import MarketingLayout from "@/components/marketing/MarketingLayout";
import { Link } from "wouter";
import { ArrowRight, Calendar } from "lucide-react";

const posts = [
  { id: "introducing-ai-agent", title: "Introducing the E-Code AI Agent", excerpt: "Build entire applications from a single prompt. Our AI agent understands your project, writes code, and deploys it for you.", date: "2025-03-15", category: "Product", readTime: "5 min" },
  { id: "cloud-ide-2025", title: "The future of cloud IDEs in 2025", excerpt: "How AI-powered cloud development environments are reshaping the way teams build software.", date: "2025-03-10", category: "Engineering", readTime: "8 min" },
  { id: "scaling-to-100k", title: "Scaling E-Code to 100,000 users", excerpt: "A deep dive into the infrastructure and architecture decisions that power E-Code at scale.", date: "2025-03-05", category: "Engineering", readTime: "12 min" },
  { id: "enterprise-security", title: "Enterprise-grade security for cloud development", excerpt: "How we achieved SOC 2 compliance and what it means for enterprise teams using E-Code.", date: "2025-02-28", category: "Security", readTime: "6 min" },
  { id: "education-partnership", title: "E-Code for Education: Teaching code without setup", excerpt: "How universities are using E-Code to eliminate environment setup and focus on teaching.", date: "2025-02-20", category: "Education", readTime: "4 min" },
  { id: "real-time-collaboration", title: "Building real-time collaboration into a cloud IDE", excerpt: "The technical challenges and solutions behind multiplayer coding in E-Code.", date: "2025-02-15", category: "Engineering", readTime: "10 min" },
];

export default function Blog() {
  return (
    <MarketingLayout>
      <section className="py-20 lg:py-28 px-6" data-testid="blog-hero">
        <div className="max-w-4xl mx-auto text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Blog</h1>
          <p className="text-lg text-[var(--ide-text-secondary)]">Product updates, engineering deep dives, and stories from the E-Code team.</p>
        </div>
        <div className="max-w-4xl mx-auto grid gap-6">
          {posts.map((post) => (
            <Link key={post.id} href={`/blog/${post.id}`}>
              <article className="group p-6 rounded-xl border border-[var(--ide-border)] hover:border-[#0079F2]/50 bg-[var(--ide-panel)]/50 hover:bg-[var(--ide-panel)] transition-all cursor-pointer" data-testid={`blog-post-${post.id}`}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#0079F2]/10 text-[#0079F2]">{post.category}</span>
                  <span className="text-xs text-[var(--ide-text-muted)] flex items-center gap-1"><Calendar className="w-3 h-3" /> {post.date}</span>
                  <span className="text-xs text-[var(--ide-text-muted)]">{post.readTime}</span>
                </div>
                <h2 className="text-xl font-semibold mb-2 group-hover:text-[#0079F2] transition-colors">{post.title}</h2>
                <p className="text-sm text-[var(--ide-text-secondary)] mb-3">{post.excerpt}</p>
                <span className="text-sm text-[#0079F2] flex items-center gap-1">Read more <ArrowRight className="w-3.5 h-3.5" /></span>
              </article>
            </Link>
          ))}
        </div>
      </section>
    </MarketingLayout>
  );
}
