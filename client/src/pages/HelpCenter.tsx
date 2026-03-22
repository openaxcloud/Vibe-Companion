import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  HelpCircle, ArrowLeft, ChevronDown, ChevronRight, Search,
  Send, MessageSquare, BookOpen, Zap, Shield, Globe, Users,
  CreditCard, Bug, CheckCircle2, Mail, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface FaqItem {
  question: string;
  answer: string;
  category: string;
}

const faqs: FaqItem[] = [
  { category: "General", question: "What is E-Code?", answer: "E-Code is a cloud-based IDE that lets you write, run, and deploy code from your browser. It supports 20+ programming languages with features like AI assistance, real-time collaboration, built-in terminal, database, and one-click deployment." },
  { category: "General", question: "What languages are supported?", answer: "E-Code supports JavaScript, TypeScript, Python, Go, Rust, Java, C++, C, C#, Ruby, PHP, Swift, Kotlin, Scala, Haskell, Lua, R, Perl, Bash, SQL, HTML/CSS, and more. Each language has syntax highlighting, IntelliSense, and debugging support." },
  { category: "General", question: "Can I use E-Code offline?", answer: "E-Code requires an internet connection as it runs in the cloud. However, your code is automatically saved and will be available when you reconnect. We're exploring PWA support for limited offline editing in the future." },
  { category: "Account", question: "How do I reset my password?", answer: "Click 'Forgot Password' on the login page, enter your email address, and we'll send you a reset link. The link expires after 1 hour. If you don't receive the email, check your spam folder." },
  { category: "Account", question: "How do I delete my account?", answer: "Go to Settings > Account > Delete Account. This will permanently delete your account and all associated data. This action cannot be undone. You'll need to confirm by typing 'DELETE' and entering your password." },
  { category: "Account", question: "Can I change my email address?", answer: "Yes, go to Settings > Profile and update your email. You'll need to verify the new email address before the change takes effect." },
  { category: "Projects", question: "How do I share my project?", answer: "Click the Share button in the project header. You can generate a share link (read-only or read-write) or invite specific users by email. Shared projects show a collaboration indicator." },
  { category: "Projects", question: "Is there a limit on project size?", answer: "Free accounts can have up to 500MB of storage per project and 10GB total. Pro accounts get 5GB per project and 100GB total. File upload limits are 50MB per file for free and 500MB for Pro." },
  { category: "Projects", question: "How do I import from GitHub?", answer: "Click 'Import' on the dashboard or use the 'Open in E-Code' feature. Paste your GitHub repository URL and E-Code will clone it. You can also connect your GitHub account for seamless push/pull." },
  { category: "Billing", question: "What's included in the free plan?", answer: "The free plan includes: 3 projects, 100 AI requests/day, 500MB storage per project, basic deployment, community support, and access to all languages and features." },
  { category: "Billing", question: "How does AI billing work?", answer: "AI usage is billed per token. GPT-4o costs $0.01 per 1K tokens, Claude 3.5 Sonnet costs $0.008 per 1K tokens, and Gemini Pro costs $0.005 per 1K tokens. Your current usage is shown in Settings > Usage." },
  { category: "Billing", question: "Can I get a refund?", answer: "Yes, we offer a 14-day money-back guarantee for Pro subscriptions. Contact support with your account email and reason for refund. Refunds are processed within 5-7 business days." },
  { category: "Deployment", question: "How do I deploy my app?", answer: "Open the Deploy panel in the IDE, configure your build and start commands, then click Deploy. Your app gets a free .ecode.app subdomain. Custom domains are available on Pro plans." },
  { category: "Deployment", question: "Why is my deployed app showing errors?", answer: "Common causes: 1) Missing environment variables (add them in the Deployment settings), 2) Build command failing (check build logs), 3) Port mismatch (make sure your app listens on the PORT environment variable), 4) Memory limits exceeded." },
  { category: "Security", question: "Is my code secure?", answer: "Yes. Each project runs in an isolated sandbox. Code is encrypted at rest and in transit. Secrets are stored with AES-256 encryption. We perform regular security audits and penetration testing." },
  { category: "Security", question: "What happens to my data?", answer: "Your code and data remain yours. We don't use your code for training AI models. Data is stored in encrypted databases with daily backups. You can export your data at any time from Settings." },
];

const categories = ["General", "Account", "Projects", "Billing", "Deployment", "Security"];

export default function HelpCenter() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactSubject, setContactSubject] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactCategory, setContactCategory] = useState("general");
  const [submitted, setSubmitted] = useState(false);

  const contactMutation = useMutation({
    mutationFn: (data: { subject: string; message: string; category: string }) =>
      apiRequest("POST", "/api/support/ticket", data),
    onSuccess: () => {
      setSubmitted(true);
      setContactSubject("");
      setContactMessage("");
      toast({ title: "Support ticket created", description: "We'll get back to you within 24 hours." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const filteredFaqs = faqs.filter(faq => {
    const matchesSearch = !searchQuery.trim() ||
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || faq.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const categoryIcons: Record<string, typeof HelpCircle> = {
    General: Zap,
    Account: Users,
    Projects: BookOpen,
    Billing: CreditCard,
    Deployment: Globe,
    Security: Shield,
  };

  return (
    <div className="h-screen flex flex-col bg-[var(--ide-bg)] text-[var(--ide-text)]" data-testid="help-page">
      <header className="flex items-center gap-3 px-6 h-14 border-b border-[var(--ide-border)] bg-[var(--ide-panel)] shrink-0">
        <button
          onClick={() => setLocation("/dashboard")}
          className="flex items-center gap-1.5 text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] transition-colors"
          data-testid="button-back-dashboard"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-[12px]">Dashboard</span>
        </button>
        <div className="w-px h-5 bg-[var(--ide-border)]" />
        <HelpCircle className="w-4 h-4 text-[#F59E0B]" />
        <h1 className="text-[14px] font-semibold">Help Center</h1>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">How can we help?</h2>
            <p className="text-[13px] text-[var(--ide-text-muted)]">Search our FAQ or contact support</p>
          </div>

          <div className="relative mb-6">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ide-text-muted)]" />
            <input
              type="text"
              placeholder="Search for answers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 pl-10 pr-4 text-[13px] bg-[var(--ide-panel)] border border-[var(--ide-border)] rounded-xl text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] outline-none focus:border-[#F59E0B]/50 focus:ring-1 focus:ring-[#F59E0B]/20"
              data-testid="input-help-search"
            />
          </div>

          <div className="flex gap-2 mb-6 flex-wrap">
            <button
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${!selectedCategory ? "bg-[#F59E0B]/10 text-[#F59E0B]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] bg-[var(--ide-surface)]"}`}
              onClick={() => setSelectedCategory(null)}
              data-testid="filter-all"
            >
              All
            </button>
            {categories.map(cat => {
              const Icon = categoryIcons[cat] || HelpCircle;
              return (
                <button
                  key={cat}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${selectedCategory === cat ? "bg-[#F59E0B]/10 text-[#F59E0B]" : "text-[var(--ide-text-muted)] hover:text-[var(--ide-text)] bg-[var(--ide-surface)]"}`}
                  onClick={() => setSelectedCategory(cat)}
                  data-testid={`filter-${cat.toLowerCase()}`}
                >
                  <Icon className="w-3 h-3" />
                  {cat}
                </button>
              );
            })}
          </div>

          <div className="space-y-2 mb-8">
            {filteredFaqs.map((faq, idx) => {
              const isExpanded = expandedFaq === idx;
              return (
                <div key={idx} className="bg-[var(--ide-panel)] border border-[var(--ide-border)] rounded-xl overflow-hidden" data-testid={`faq-${idx}`}>
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[var(--ide-surface)]/50 transition-colors"
                    onClick={() => setExpandedFaq(isExpanded ? null : idx)}
                  >
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-[#F59E0B] shrink-0" /> : <ChevronRight className="w-4 h-4 text-[var(--ide-text-muted)] shrink-0" />}
                    <span className="text-[13px] font-medium flex-1">{faq.question}</span>
                    <span className="text-[10px] text-[var(--ide-text-muted)] bg-[var(--ide-surface)] px-2 py-0.5 rounded-full shrink-0">{faq.category}</span>
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 ml-7">
                      <p className="text-[12px] text-[var(--ide-text-secondary)] leading-relaxed">{faq.answer}</p>
                    </div>
                  )}
                </div>
              );
            })}
            {filteredFaqs.length === 0 && (
              <div className="text-center py-8">
                <Search className="w-8 h-8 text-[var(--ide-text-muted)] mx-auto mb-2" />
                <p className="text-[12px] text-[var(--ide-text-muted)]">No results found. Try a different search or contact support below.</p>
              </div>
            )}
          </div>

          <div className="bg-[var(--ide-panel)] border border-[var(--ide-border)] rounded-xl p-6" data-testid="contact-support-section">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 flex items-center justify-center">
                <Mail className="w-5 h-5 text-[#F59E0B]" />
              </div>
              <div>
                <h3 className="text-[14px] font-semibold">Contact Support</h3>
                <p className="text-[11px] text-[var(--ide-text-muted)]">Can't find what you're looking for? We'll get back to you within 24 hours.</p>
              </div>
            </div>

            {submitted ? (
              <div className="text-center py-6">
                <CheckCircle2 className="w-10 h-10 text-[#0CCE6B] mx-auto mb-3" />
                <h4 className="text-[14px] font-semibold mb-1">Ticket Submitted</h4>
                <p className="text-[12px] text-[var(--ide-text-muted)] mb-4">We'll respond to your email within 24 hours.</p>
                <Button size="sm" variant="outline" className="text-[11px]" onClick={() => setSubmitted(false)} data-testid="button-new-ticket">
                  Submit Another
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2 flex-wrap">
                  {["general", "bug", "billing", "feature"].map(cat => (
                    <button
                      key={cat}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-medium capitalize transition-colors ${
                        contactCategory === cat ? "bg-[#F59E0B]/10 text-[#F59E0B]" : "text-[var(--ide-text-muted)] bg-[var(--ide-surface)] hover:text-[var(--ide-text)]"
                      }`}
                      onClick={() => setContactCategory(cat)}
                    >
                      {cat === "bug" ? "Bug Report" : cat === "feature" ? "Feature Request" : cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Subject"
                  value={contactSubject}
                  onChange={(e) => setContactSubject(e.target.value)}
                  className="w-full h-9 px-3 text-[12px] bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded-lg text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] outline-none focus:border-[#F59E0B]/50"
                  data-testid="input-ticket-subject"
                />
                <textarea
                  placeholder="Describe your issue or question in detail..."
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 text-[12px] bg-[var(--ide-surface)] border border-[var(--ide-border)] rounded-lg text-[var(--ide-text)] placeholder:text-[var(--ide-text-muted)] outline-none focus:border-[#F59E0B]/50 resize-none"
                  data-testid="input-ticket-message"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    className="h-9 text-[11px] gap-1.5 bg-[#F59E0B] hover:bg-[#D97706] text-black"
                    onClick={() => contactMutation.mutate({ subject: contactSubject, message: contactMessage, category: contactCategory })}
                    disabled={!contactSubject.trim() || !contactMessage.trim() || contactMutation.isPending}
                    data-testid="button-submit-ticket"
                  >
                    <Send className="w-3 h-3" />
                    Submit Ticket
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={() => setLocation("/docs")}
              className="flex-1 flex items-center gap-3 p-4 bg-[var(--ide-panel)] border border-[var(--ide-border)] rounded-xl hover:border-[#0079F2]/30 transition-colors"
              data-testid="link-docs"
            >
              <BookOpen className="w-5 h-5 text-[#0079F2]" />
              <div>
                <div className="text-[12px] font-semibold">Documentation</div>
                <div className="text-[10px] text-[var(--ide-text-muted)]">Read the full docs</div>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-[var(--ide-text-muted)] ml-auto" />
            </button>
            <button
              onClick={() => setLocation("/community")}
              className="flex-1 flex items-center gap-3 p-4 bg-[var(--ide-panel)] border border-[var(--ide-border)] rounded-xl hover:border-[#7C65CB]/30 transition-colors"
              data-testid="link-community"
            >
              <MessageSquare className="w-5 h-5 text-[#7C65CB]" />
              <div>
                <div className="text-[12px] font-semibold">Community</div>
                <div className="text-[10px] text-[var(--ide-text-muted)]">Ask the community</div>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-[var(--ide-text-muted)] ml-auto" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
