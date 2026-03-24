import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowRight, BookOpen, Clock, Play, Search,
  CheckCircle, Code, Rocket, Database, Globe,
  Sparkles, Users, Filter
} from "lucide-react";
import { Link } from "wouter";
import PublicLayout from "@/components/layout/PublicLayout";
import { SEOHead, structuredData } from "@/components/seo/SEOHead";
import { getSEOConfig } from "@/config/seo.config";

const seo = getSEOConfig('tutorials');

const categories = ["All", "Getting Started", "AI & Agents", "Frontend", "Backend", "Database", "Deployment"];

const tutorials = [
  {
    id: 1,
    title: "Getting Started with E-Code",
    description: "Learn the basics of E-Code in 10 minutes. Create your first project and deploy it live.",
    duration: "10 min",
    level: "Beginner",
    category: "Getting Started",
    featured: true,
    image: "/assets/tutorials/getting-started.jpg"
  },
  {
    id: 2,
    title: "Building Your First AI-Powered App",
    description: "Use AI agents to build a full-stack application from a single prompt.",
    duration: "15 min",
    level: "Beginner",
    category: "AI & Agents",
    featured: true,
    image: "/assets/tutorials/ai-app.jpg"
  },
  {
    id: 3,
    title: "React Fundamentals on E-Code",
    description: "Master React development with live preview, hot reload, and AI assistance.",
    duration: "25 min",
    level: "Intermediate",
    category: "Frontend",
    image: "/assets/tutorials/react.jpg"
  },
  {
    id: 4,
    title: "Building REST APIs with Node.js",
    description: "Create production-ready REST APIs with Express, validation, and authentication.",
    duration: "30 min",
    level: "Intermediate",
    category: "Backend",
    image: "/assets/tutorials/nodejs.jpg"
  },
  {
    id: 5,
    title: "PostgreSQL Database Setup",
    description: "Connect to PostgreSQL, design schemas, and manage data with Drizzle ORM.",
    duration: "20 min",
    level: "Intermediate",
    category: "Database",
    image: "/assets/tutorials/postgresql.jpg"
  },
  {
    id: 6,
    title: "One-Click Deployment",
    description: "Deploy your app to the cloud with custom domains, SSL, and CDN.",
    duration: "8 min",
    level: "Beginner",
    category: "Deployment",
    image: "/assets/tutorials/deployment.jpg"
  },
  {
    id: 7,
    title: "Real-time Collaboration",
    description: "Work with your team in real-time. Pair programming and live code sharing.",
    duration: "12 min",
    level: "Beginner",
    category: "Getting Started",
    image: "/assets/tutorials/collaboration.jpg"
  },
  {
    id: 8,
    title: "Advanced AI Agent Prompting",
    description: "Master the art of prompting AI agents for complex multi-file projects.",
    duration: "20 min",
    level: "Advanced",
    category: "AI & Agents",
    image: "/assets/tutorials/ai-advanced.jpg"
  },
  {
    id: 9,
    title: "Building E-commerce with Stripe",
    description: "Complete e-commerce tutorial with shopping cart, checkout, and payments.",
    duration: "45 min",
    level: "Advanced",
    category: "Backend",
    image: "/assets/tutorials/ecommerce.jpg"
  }
];

export default function Tutorials() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const filteredTutorials = tutorials.filter((tutorial) => {
    const matchesSearch = tutorial.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tutorial.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === "All" || tutorial.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const featuredTutorials = tutorials.filter(t => t.featured);

  return (
    <PublicLayout>
      <SEOHead
        {...seo}
        structuredData={structuredData.website()}
      />

      <div className="container mx-auto px-4 py-12 sm:py-16 md:py-20" data-testid="page-tutorials">
        {/* Hero Section */}
        <div className="text-center max-w-4xl mx-auto mb-12 sm:mb-16">
          <Badge className="mb-4 px-4 py-1.5 text-[13px] font-medium bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-0">
            Learn & Build
          </Badge>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-cyan-600 dark:from-blue-400 dark:to-cyan-400 bg-clip-text text-transparent" data-testid="heading-tutorials">
            Tutorials
          </h1>
          <p className="text-[15px] sm:text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            Learn to build real-world applications with step-by-step tutorials.
            From beginner to advanced, we've got you covered.
          </p>

          {/* Search */}
          <div className="max-w-xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search tutorials..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-12 text-[15px]"
              data-testid="input-tutorials-search"
            />
          </div>
        </div>

        {/* Categories */}
        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {categories.map((category) => (
            <Button
              key={category}
              variant={activeCategory === category ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveCategory(category)}
              className={`min-h-[44px] ${activeCategory === category ? "bg-blue-600 hover:bg-blue-700" : ""}`}
              data-testid={`button-tutorials-category-${category.toLowerCase().replace(/\s+/g, '-')}`}
            >
              {category}
            </Button>
          ))}
        </div>

        {/* Featured Tutorials */}
        {activeCategory === "All" && searchQuery === "" && (
          <div className="mb-16">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-yellow-500" />
              Featured Tutorials
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {featuredTutorials.map((tutorial) => (
                <Card key={tutorial.id} className="overflow-hidden hover:shadow-xl transition-all duration-300 group cursor-pointer">
                  <div className="aspect-video bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30 relative">
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-16 h-16 rounded-full bg-white/90 dark:bg-slate-900/90 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Play className="h-8 w-8 text-blue-600 ml-1" />
                      </div>
                    </div>
                    <Badge className="absolute top-4 left-4 bg-yellow-500 text-white">Featured</Badge>
                  </div>
                  <div className="p-6">
                    <div className="flex items-center gap-4 mb-3">
                      <Badge variant="outline">{tutorial.level}</Badge>
                      <span className="text-[13px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {tutorial.duration}
                      </span>
                    </div>
                    <h3 className="text-xl font-semibold mb-2 group-hover:text-blue-600 transition-colors">
                      {tutorial.title}
                    </h3>
                    <p className="text-muted-foreground">{tutorial.description}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* All Tutorials */}
        <div>
          <h2 className="text-2xl font-bold mb-6">
            {activeCategory === "All" ? "All Tutorials" : activeCategory}
            <span className="text-muted-foreground font-normal text-[15px] ml-2">
              ({filteredTutorials.length})
            </span>
          </h2>

          {filteredTutorials.length === 0 ? (
            <Card className="p-12 text-center">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No tutorials found</h3>
              <p className="text-muted-foreground mb-4">Try a different search term or category.</p>
              <Button variant="outline" onClick={() => { setSearchQuery(""); setActiveCategory("All"); }} className="min-h-[44px]" data-testid="button-tutorials-clear-filters">
                Clear Filters
              </Button>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTutorials.map((tutorial) => (
                <Card key={tutorial.id} className="overflow-hidden hover:shadow-lg transition-all duration-300 group cursor-pointer">
                  <div className="aspect-video bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 relative">
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-12 h-12 rounded-full bg-white/90 dark:bg-slate-900/90 flex items-center justify-center">
                        <Play className="h-6 w-6 text-blue-600 ml-0.5" />
                      </div>
                    </div>
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <Badge variant="secondary" className="text-[11px]">{tutorial.category}</Badge>
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {tutorial.duration}
                      </span>
                    </div>
                    <h3 className="font-semibold mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">
                      {tutorial.title}
                    </h3>
                    <p className="text-[13px] text-muted-foreground line-clamp-2">{tutorial.description}</p>
                    <div className="mt-3">
                      <Badge variant="outline" className="text-[11px]">{tutorial.level}</Badge>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* CTA Section */}
        <Card className="mt-16 p-8 md:p-12 bg-gradient-to-r from-blue-500 to-cyan-500 border-0 text-white">
          <div className="text-center max-w-3xl mx-auto">
            <Rocket className="h-12 w-12 mx-auto mb-6 opacity-80" />
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">Ready to Start Building?</h2>
            <p className="text-[15px] text-white/90 mb-8">
              Put your learning into practice. Create your first project in minutes.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register">
                <Button size="lg" className="gap-2 min-h-[48px] bg-white text-blue-600 hover:bg-blue-50" data-testid="button-tutorials-start-free">
                  Start Free
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <Link href="/docs">
                <Button size="lg" variant="outline" className="gap-2 min-h-[48px] border-white/30 text-white hover:bg-white/10" data-testid="button-tutorials-read-docs">
                  <BookOpen className="h-5 w-5" />
                  Read Docs
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </PublicLayout>
  );
}
