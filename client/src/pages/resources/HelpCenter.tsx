import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowRight, Search, BookOpen, MessageCircle, Mail,
  ChevronDown, ChevronRight, HelpCircle, Rocket, Users,
  CreditCard, Shield, Settings, Code, Zap
} from "lucide-react";
import { Link } from "wouter";
import PublicLayout from "@/components/layout/PublicLayout";
import { SEOHead, structuredData } from "@/components/seo/SEOHead";
import { getSEOConfig } from "@/config/seo.config";

const seo = getSEOConfig('help-center');

const categories = [
  {
    icon: <Rocket className="h-6 w-6" />,
    title: "Getting Started",
    description: "New to E-Code? Start here.",
    articles: 12,
    color: "blue"
  },
  {
    icon: <Code className="h-6 w-6" />,
    title: "IDE & Editor",
    description: "Using the development environment",
    articles: 24,
    color: "purple"
  },
  {
    icon: <Zap className="h-6 w-6" />,
    title: "AI & Agents",
    description: "AI-powered development features",
    articles: 18,
    color: "orange"
  },
  {
    icon: <Users className="h-6 w-6" />,
    title: "Collaboration",
    description: "Team features and sharing",
    articles: 15,
    color: "green"
  },
  {
    icon: <CreditCard className="h-6 w-6" />,
    title: "Billing & Plans",
    description: "Subscriptions and payments",
    articles: 10,
    color: "pink"
  },
  {
    icon: <Shield className="h-6 w-6" />,
    title: "Security & Privacy",
    description: "Account security and data protection",
    articles: 8,
    color: "cyan"
  }
];

const faqs = [
  {
    question: "How do I get started with E-Code?",
    answer: "Sign up for a free account at e-code.ai/register. You'll be guided through creating your first project. No credit card required."
  },
  {
    question: "What programming languages are supported?",
    answer: "E-Code supports 40+ languages including Python, JavaScript, TypeScript, Go, Rust, Java, C++, Ruby, PHP, and more. All with AI assistance."
  },
  {
    question: "How does AI code generation work?",
    answer: "Describe what you want to build in natural language. Our AI agent generates production-ready code, creates files, and can even deploy your application."
  },
  {
    question: "Can I collaborate with my team in real-time?",
    answer: "Yes! E-Code supports real-time multiplayer editing. Multiple developers can code simultaneously with live cursors and instant sync."
  },
  {
    question: "How do I deploy my application?",
    answer: "Click the Deploy button in your project. E-Code handles everything: containers, SSL certificates, custom domains, and global CDN distribution."
  },
  {
    question: "Is my code private and secure?",
    answer: "Yes. All code is encrypted at rest and in transit. We're SOC 2 Type II certified and GDPR compliant. Enterprise customers can use private cloud options."
  },
  {
    question: "What's included in the free tier?",
    answer: "Unlimited projects, 3 deployments, AI assistance, real-time collaboration, and community support. No credit card required."
  },
  {
    question: "How do I cancel my subscription?",
    answer: "Go to Settings > Billing > Cancel Subscription. Your account will remain active until the end of your billing period. You can reactivate anytime."
  }
];

export default function HelpCenter() {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const filteredFaqs = faqs.filter(
    faq => faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
           faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <PublicLayout>
      <SEOHead
        {...seo}
        structuredData={structuredData.faqPage(faqs)}
      />

      <div className="container mx-auto px-4 py-12 sm:py-16 md:py-20" data-testid="page-help-center">
        {/* Hero Section */}
        <div className="text-center max-w-4xl mx-auto mb-12 sm:mb-16">
          <Badge className="mb-4 px-4 py-1.5 text-[13px] font-medium bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-0">
            Support
          </Badge>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent" data-testid="heading-help-center">
            Help Center
          </h1>
          <p className="text-[15px] sm:text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            Find answers, browse documentation, or get in touch with our support team.
          </p>

          {/* Search */}
          <div className="max-w-2xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search for help articles, FAQs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-14 text-[15px]"
              data-testid="input-help-search"
            />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid sm:grid-cols-3 gap-4 mb-16 max-w-4xl mx-auto">
          <Link href="/docs">
            <Card className="p-6 hover:shadow-lg transition-all duration-300 cursor-pointer group text-center">
              <BookOpen className="h-8 w-8 mx-auto mb-3 text-indigo-600 group-hover:scale-110 transition-transform" />
              <h3 className="font-semibold mb-1">Documentation</h3>
              <p className="text-[13px] text-muted-foreground">Comprehensive guides & API reference</p>
            </Card>
          </Link>
          <Link href="/forum">
            <Card className="p-6 hover:shadow-lg transition-all duration-300 cursor-pointer group text-center">
              <MessageCircle className="h-8 w-8 mx-auto mb-3 text-purple-600 group-hover:scale-110 transition-transform" />
              <h3 className="font-semibold mb-1">Community Forum</h3>
              <p className="text-[13px] text-muted-foreground">Ask questions & share solutions</p>
            </Card>
          </Link>
          <Link href="/contact">
            <Card className="p-6 hover:shadow-lg transition-all duration-300 cursor-pointer group text-center">
              <Mail className="h-8 w-8 mx-auto mb-3 text-pink-600 group-hover:scale-110 transition-transform" />
              <h3 className="font-semibold mb-1">Contact Support</h3>
              <p className="text-[13px] text-muted-foreground">Get help from our team</p>
            </Card>
          </Link>
        </div>

        {/* Categories */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold text-center mb-8">Browse by Category</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((category) => (
              <Card key={category.title} className="p-6 hover:shadow-lg transition-all duration-300 cursor-pointer group">
                <div className={`p-3 bg-${category.color}-100 dark:bg-${category.color}-900/20 rounded-xl w-fit mb-4`}>
                  <div className={`text-${category.color}-600 dark:text-${category.color}-400`}>
                    {category.icon}
                  </div>
                </div>
                <h3 className="text-[15px] font-semibold mb-1 group-hover:text-indigo-600 transition-colors">
                  {category.title}
                </h3>
                <p className="text-[13px] text-muted-foreground mb-3">{category.description}</p>
                <div className="flex items-center text-[13px] text-muted-foreground">
                  <span>{category.articles} articles</span>
                  <ChevronRight className="h-4 w-4 ml-auto group-hover:translate-x-1 transition-transform" />
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* FAQ Section */}
        <div className="max-w-4xl mx-auto mb-16">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {(searchQuery ? filteredFaqs : faqs).map((faq, index) => (
              <Card
                key={index}
                className={`overflow-hidden transition-all duration-300 ${expandedFaq === index ? 'ring-2 ring-indigo-500' : ''}`}
              >
                <button
                  className="w-full p-6 text-left flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-900/50 min-h-[44px]"
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  data-testid={`button-faq-${index}`}
                >
                  <span className="font-semibold pr-4">{faq.question}</span>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground flex-shrink-0 transition-transform ${expandedFaq === index ? 'rotate-180' : ''}`} />
                </button>
                {expandedFaq === index && (
                  <div className="px-6 pb-6 text-muted-foreground border-t">
                    <p className="pt-4">{faq.answer}</p>
                  </div>
                )}
              </Card>
            ))}
          </div>

          {searchQuery && filteredFaqs.length === 0 && (
            <Card className="p-12 text-center">
              <HelpCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No results found</h3>
              <p className="text-muted-foreground mb-4">Try different keywords or contact support.</p>
              <Button variant="outline" onClick={() => setSearchQuery("")} className="min-h-[44px]" data-testid="button-help-clear-search">
                Clear Search
              </Button>
            </Card>
          )}
        </div>

        {/* Contact Section */}
        <Card className="max-w-4xl mx-auto p-8 md:p-12 bg-gradient-to-r from-indigo-500 to-purple-500 border-0 text-white">
          <div className="text-center">
            <MessageCircle className="h-12 w-12 mx-auto mb-6 opacity-80" />
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">Still Need Help?</h2>
            <p className="text-[15px] text-white/90 mb-8">
              Our support team is here to help. We typically respond within a few hours.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/contact">
                <Button size="lg" className="gap-2 min-h-[48px] bg-white text-indigo-600 hover:bg-indigo-50" data-testid="button-help-contact-support">
                  <Mail className="h-5 w-5" />
                  Contact Support
                </Button>
              </Link>
              <Link href="/forum">
                <Button size="lg" variant="outline" className="gap-2 min-h-[48px] border-white/30 text-white hover:bg-white/10" data-testid="button-help-ask-community">
                  <Users className="h-5 w-5" />
                  Ask the Community
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </PublicLayout>
  );
}
