import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { LazyMotionDiv, CSSFade, CSSSlide, fadeVariants, staggerVariants } from '@/lib/motion';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { 
  Zap, Globe, Users, Shield, Code, Terminal, GitBranch, 
  Rocket, Package, Database, Cpu, Cloud, Lock, Star,
  ChevronRight, ArrowRight, CheckCircle, PlayCircle,
  Sparkles, Check, Loader2, MessageSquare, Bot, ShoppingCart,
  Play, Pause, Volume2, VolumeX, Maximize, Globe2,
  BookOpen, Store, Briefcase, ListTodo, CloudSun, PenTool,
  Layers, BarChart3, Settings, Palette, Workflow, Brain,
  TrendingUp, Users2, Building2, Award, Timer, Gauge,
  FileCode2, Server, Smartphone, Monitor, Laptop
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { MarketingLayout } from '@/components/layout/MarketingLayout';
import { IDEFeatureShowcase } from '@/components/landing/IDEFeatureShowcase';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { Spinner } from '@/components/ui/spinner';
import { getProjectUrl } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';
import { AIModelSelector } from '@/components/ai/AIModelSelector';
import { BuildModeSelector, BuildMode } from "@/components/ai/BuildModeSelector";
import { 
  SiPython, SiJavascript, SiHtml5, SiCss,
  SiTypescript, SiGo, SiReact, SiNodedotjs, SiSpring,
  SiRust, SiPhp, SiOpenjdk, SiDocker, SiKubernetes,
  SiGoogle
} from 'react-icons/si';

const cloudComputingImg = 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop';
const modernSoftwareImg = 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=2070&auto=format&fit=crop';
const codingWorkspaceImg = 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=2070&auto=format&fit=crop';

// Animation variants
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6 }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

const scaleIn = {
  initial: { scale: 0.9, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  transition: { duration: 0.5 }
};

export default function Landing() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [appDescription, setAppDescription] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [buildModeDialogOpen, setBuildModeDialogOpen] = useState(false);
  const [pendingBuildPrompt, setPendingBuildPrompt] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);

  // Check if user just registered and needs to trigger workspace creation
  useEffect(() => {
    const triggerBuild = sessionStorage.getItem('triggerBuildOnLanding');
    const pendingPrompt = sessionStorage.getItem('pendingAppDescription');
    
    if (user && triggerBuild === 'true' && pendingPrompt) {
      // Clear the flags
      sessionStorage.removeItem('triggerBuildOnLanding');
      
      // Trigger workspace creation
      handleStartBuilding(pendingPrompt);
    }
  }, [user]);

  // Fetch real templates from database
  const { data: templates = [], isLoading: templatesLoading } = useQuery<any[]>({
    queryKey: ['/api/marketplace/templates'],
    enabled: true
  });

  // Professional feature set
  const features = [
    {
      icon: <Rocket className="h-6 w-6" />,
      title: 'Enterprise-Grade Infrastructure',
      description: 'Built on Fortune 500 standards with 99.99% uptime SLA, auto-scaling, and global CDN distribution'
    },
    {
      icon: <Brain className="h-6 w-6" />,
      title: 'AI-Powered Development',
      description: 'Advanced AI agents that understand context, write production code, and deploy automatically'
    },
    {
      icon: <Shield className="h-6 w-6" />,
      title: 'Bank-Level Security',
      description: 'SOC 2 Type II certified with end-to-end encryption, RBAC, and continuous security monitoring'
    },
    {
      icon: <Users2 className="h-6 w-6" />,
      title: 'Real-Time Collaboration',
      description: 'Multiple developers can code simultaneously with instant sync and conflict resolution'
    },
    {
      icon: <Gauge className="h-6 w-6" />,
      title: '10x Faster Development',
      description: 'Ship features in minutes instead of months with our optimized development pipeline'
    },
    {
      icon: <Globe2 className="h-6 w-6" />,
      title: 'Global Edge Deployment',
      description: 'Deploy to 200+ edge locations worldwide with automatic SSL and DDoS protection'
    }
  ];

  // Enterprise testimonials
  const testimonials = [
    {
      quote: "E-Code reduced our development time by 85% and saved us $2M annually in engineering costs.",
      author: "Sarah Chen",
      role: "CTO, Fortune 500 Tech Company",
      company: "TechCorp Global",
      avatar: "SC"
    },
    {
      quote: "The AI agent built our entire customer portal in 3 days. What used to take months now takes hours.",
      author: "Michael Rodriguez",
      role: "VP Engineering, Series C Startup",
      company: "InnovateTech",
      avatar: "MR"
    },
    {
      quote: "Best development platform we've used. Our team productivity increased by 400% in the first month.",
      author: "Emily Watson",
      role: "Director of Engineering, Enterprise SaaS",
      company: "CloudScale Solutions",
      avatar: "EW"
    }
  ];

  // Stats for credibility
  const stats = [
    { label: 'Active Developers', value: '2M+', icon: <Users className="h-5 w-5" /> },
    { label: 'Apps Deployed', value: '10M+', icon: <Rocket className="h-5 w-5" /> },
    { label: 'Lines of Code', value: '5B+', icon: <FileCode2 className="h-5 w-5" /> },
    { label: 'Uptime SLA', value: '99.99%', icon: <TrendingUp className="h-5 w-5" /> }
  ];

  const handleStartBuilding = async (description: string) => {
    setChatOpen(false);
    
    // ✅ REPLIT-IDENTICAL FLOW: Require login before workspace creation
    // If user is not logged in, save prompt and redirect to login page
    if (!user) {
      // Save the prompt so we can resume after login
      sessionStorage.setItem('pendingAppDescription', description);
      sessionStorage.setItem('triggerBuildOnLanding', 'true');
      
      toast({
        title: 'Sign in required',
        description: 'Please sign in to create your workspace',
      });
      
      // Redirect to auth page
      navigate('/login');
      return;
    }
    
    // User is authenticated - show BuildModeSelector dialog
    setPendingBuildPrompt(description);
    setBuildModeDialogOpen(true);
  };

  const handleBuildModeSelect = async (mode: BuildMode) => {
    setBuildModeDialogOpen(false);
    
    // If user chose to continue planning, don't create workspace yet
    if (mode === 'continue-planning') {
      toast({
        title: 'Continue refining',
        description: 'Take your time to refine your app description',
      });
      return;
    }
    
    // User selected a build mode - proceed with workspace creation
    try {
      const requestPayload = {
        prompt: pendingBuildPrompt,
        buildMode: mode,
        options: {
          autoStart: true,
          language: 'typescript',
          framework: 'react'
        }
      };
      
      const result = await apiRequest('POST', '/api/workspace/bootstrap', requestPayload) as any;

      if (result.success) {
        // Store prompt and build mode for the IDE Agent panel to pick up
        sessionStorage.setItem(`agent-prompt-${result.projectId}`, pendingBuildPrompt);
        sessionStorage.setItem(`agent-build-mode-${result.projectId}`, mode);
        
        // Clear the pending prompts
        sessionStorage.removeItem('pendingAppDescription');
        sessionStorage.removeItem('triggerBuildOnLanding');
        setPendingBuildPrompt('');
        
        toast({
          title: 'Creating your workspace...',
          description: mode === 'design-first' 
            ? 'AI is creating your design prototype now' 
            : 'AI is generating your full application now',
        });
        navigate(`/ide/${result.projectId}?bootstrap=${result.bootstrapToken}&buildMode=${mode}`);
      } else {
        throw new Error(result.error || 'Bootstrap failed');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create workspace. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const data = await apiRequest('POST', '/api/newsletter/subscribe', { email }) as any;
      toast({ title: "Success!", description: data.message || "You've been subscribed!", variant: "success" });
      setEmail('');
      setTimeout(() => navigate('/login'), 1500);
    } catch (error) {
      toast({ title: "Error", description: "Failed to subscribe. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <MarketingLayout>
      {/* Hero Section with E-Code Gradient */}
      <LazyMotionDiv 
        className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-[var(--ecode-background)]"
        style={{ fontFamily: 'var(--ecode-font-sans)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        data-testid="section-hero"
      >
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <img 
            src={cloudComputingImg} 
            alt="Cloud Computing Technology"
            className="w-full h-full object-cover opacity-10 dark:opacity-5"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[var(--ecode-background)]/80 via-[var(--ecode-background)]/90 to-[var(--ecode-background)]" />
        </div>

        {/* Animated Grid Background */}
        <div className="absolute inset-0 bg-grid-pattern opacity-5 dark:opacity-10" />
        
        {/* Content */}
        <div className="container-responsive relative z-10 max-w-7xl text-center px-4 py-20">
          <LazyMotionDiv 
            className="space-y-8"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {/* Badge */}
            <LazyMotionDiv variants={fadeInUp}>
              <Badge 
                variant="secondary" 
                className="mx-auto inline-flex items-center gap-2 px-6 py-2 text-[13px] font-semibold bg-gradient-to-r from-ecode-accent/10 to-ecode-secondary-accent/10 border border-ecode-accent/20 dark:from-ecode-accent/15 dark:to-ecode-secondary-accent/15 dark:border-ecode-accent/30 transition-all duration-300 hover:border-ecode-accent/40"
                data-testid="badge-hero"
              >
                <Sparkles className="h-4 w-4 text-ecode-accent" />
                AI-Powered Enterprise Development Platform
                <Sparkles className="h-4 w-4 text-ecode-accent" />
              </Badge>
            </LazyMotionDiv>

            {/* Main Headline */}
            <LazyMotionDiv 
              className="text-[clamp(2.25rem,8vw,3rem)] sm:text-6xl lg:text-7xl xl:text-8xl font-bold tracking-tight"
              variants={fadeInUp}
              data-testid="heading-hero"
            >
              <span className="bg-gradient-to-r from-[var(--ecode-text)] to-[var(--ecode-text-secondary)] bg-clip-text text-transparent">
                Build & Deploy
              </span>
              <br />
              <span className="bg-gradient-to-r from-ecode-orange via-ecode-orange-light to-ecode-yellow bg-clip-text text-transparent">
                Production Apps
              </span>
              <br />
              <span className="bg-gradient-to-r from-[var(--ecode-text)] to-[var(--ecode-text-secondary)] bg-clip-text text-transparent">
                in Minutes
              </span>
            </LazyMotionDiv>

            {/* Subheadline */}
            <LazyMotionDiv 
              className="mx-auto max-w-3xl text-xl sm:text-2xl text-[var(--ecode-text-muted)] font-medium"
              variants={fadeInUp}
              data-testid="text-hero-description"
            >
              The only platform that combines AI agents, cloud infrastructure, and enterprise security 
              to deliver Fortune 500 development velocity to every team.
            </LazyMotionDiv>

            {/* AI Model Selection - Only show to logged-in users */}
            {user && (
              <LazyMotionDiv
                className="max-w-4xl mx-auto mt-8"
                variants={fadeInUp}
              >
                <div className="flex justify-center">
                  <AIModelSelector variant="card" className="w-full max-w-2xl" />
                </div>
              </LazyMotionDiv>
            )}

            {/* AI Input Section */}
            <LazyMotionDiv 
              className="max-w-4xl mx-auto mt-8"
              variants={fadeInUp}
            >
              <div className="relative group">
                {/* E-Code Glow effect */}
                <div 
                  className="absolute -inset-1 rounded-2xl blur-lg opacity-20 group-hover:opacity-30 transition-all duration-300 bg-gradient-to-br from-ecode-orange via-ecode-orange-light to-ecode-yellow"
                />
                
                {/* Input Container */}
                <div className="relative bg-[var(--ecode-surface)] border border-[var(--ecode-border)] rounded-2xl p-2 shadow-[0_8px_32px_-8px_rgba(242,98,7,0.15)] transition-all duration-300 hover:border-ecode-accent/30 hover:shadow-[0_8px_32px_-8px_rgba(242,98,7,0.25)]">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder="Describe your app idea in any language..."
                        className="w-full bg-transparent border-none outline-none text-base sm:text-[15px] placeholder:text-[var(--ecode-text-muted)] text-[var(--ecode-text)] px-4 sm:px-6 py-3 sm:py-4 font-normal transition-colors duration-200"
                        style={{ fontFamily: 'var(--ecode-font-sans)' }}
                        value={appDescription || ''}
                        onChange={(e) => setAppDescription(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && appDescription?.trim()) {
                            handleStartBuilding(appDescription);
                          }
                        }}
                        data-testid="input-app-description"
                      />
                    </div>
              <Button 
                size="lg"
                className="bg-ecode-accent hover:bg-ecode-accent-hover text-white shadow-lg px-6 sm:px-8 py-3 sm:py-4 text-base sm:text-[15px] font-semibold h-auto min-h-[44px] rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-[0_8px_32px_-8px_rgba(242,98,7,0.4)]"
                onClick={() => {
                  if (appDescription?.trim()) {
                    handleStartBuilding(appDescription);
                  }
                }}
                disabled={!appDescription?.trim()}
                data-testid="button-hero-build-now"
              >
                <Sparkles className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden xs:inline">Build Now</span>
                <span className="xs:hidden">Build</span>
              </Button>
                  </div>
                </div>
              </div>

              {/* Popular Examples Below Input */}
              <LazyMotionDiv 
                className="mt-8 space-y-4"
                variants={fadeInUp}
              >
                <p className="text-[13px] text-[var(--ecode-text-muted)] text-center">
                  Try these popular examples:
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  {[
                    { 
                      icon: <ShoppingCart className="h-4 w-4" />, 
                      label: "E-commerce Platform",
                      text: "Build a full-stack e-commerce marketplace with Stripe payments, product catalog with search and filters, shopping cart with checkout flow, user authentication, order management dashboard, inventory tracking, email notifications for orders, and mobile-responsive design with dark mode", 
                      color: "from-ecode-orange to-ecode-orange-light", 
                      id: "ecommerce" 
                    },
                    { 
                      icon: <MessageSquare className="h-4 w-4" />, 
                      label: "Real-time Chat",
                      text: "Create a Slack-like real-time messaging platform with WebSocket connections, public and private channels, direct messages, file and image sharing, message reactions and threading, typing indicators, read receipts, user presence status, and push notifications", 
                      color: "from-ecode-orange-light to-ecode-yellow", 
                      id: "chat" 
                    },
                    { 
                      icon: <Bot className="h-4 w-4" />, 
                      label: "AI Assistant",
                      text: "Build an intelligent AI chatbot with OpenAI GPT-5 integration, conversation memory and context, document upload for RAG knowledge base, code execution sandbox, streaming responses with typing animation, conversation history with search, export to PDF, and multi-language support", 
                      color: "from-ecode-orange to-ecode-orange-hover", 
                      id: "chatbot" 
                    },
                    { 
                      icon: <Globe className="h-4 w-4" />, 
                      label: "Analytics Dashboard",
                      text: "Design a Fortune 500-grade analytics dashboard with real-time interactive charts (line, bar, pie, area), KPI metric widgets, data tables with sorting and filtering, date range picker with presets, CSV and PDF export, role-based access control, customizable widgets, and dark mode support", 
                      color: "from-ecode-yellow to-ecode-orange", 
                      id: "dashboard" 
                    },
                    { 
                      icon: <Briefcase className="h-4 w-4" />, 
                      label: "SaaS Starter",
                      text: "Create a complete SaaS starter kit with beautiful landing page, pricing tiers comparison, Stripe subscription billing with usage-based pricing, user authentication with social login, team management and invitations, admin dashboard with analytics, email onboarding flow, and API documentation", 
                      color: "from-ecode-orange-hover to-ecode-orange", 
                      id: "saas" 
                    },
                    { 
                      icon: <ListTodo className="h-4 w-4" />, 
                      label: "Project Management",
                      text: "Build a Jira-like project management tool with drag-and-drop Kanban boards, sprint planning and backlog, task assignments with deadlines, time tracking and estimates, Gantt chart timeline view, team collaboration with comments, file attachments, activity feed, and customizable workflows", 
                      color: "from-ecode-orange-light to-ecode-orange", 
                      id: "project" 
                    }
                  ].map((example, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setAppDescription(example.text);
                        setTimeout(() => {
                          const inputElement = document.querySelector('textarea[data-testid="input-app-description"]') as HTMLTextAreaElement;
                          if (inputElement) {
                            inputElement.focus();
                            inputElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          }
                        }, 100);
                      }}
                      className="group flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full bg-[var(--ecode-surface)] border border-[var(--ecode-border)] hover:border-ecode-accent/50 transition-all duration-300 hover:scale-105 hover:shadow-[0_4px_16px_-4px_rgba(242,98,7,0.2)] min-h-[44px]"
                      data-testid={`button-example-${example.id}`}
                    >
                      <div className={`bg-gradient-to-r ${example.color} text-white p-1.5 rounded-md transition-transform duration-300 group-hover:scale-110`}>
                        {example.icon}
                      </div>
                      <span className="text-[11px] sm:text-[13px] font-medium text-[var(--ecode-text)]">
                        {example.label}
                      </span>
                    </button>
                  ))}
                </div>
              </LazyMotionDiv>

              {/* Features below input */}
              <LazyMotionDiv 
                className="flex flex-wrap justify-center gap-4 mt-6"
                variants={fadeInUp}
              >
                <div className="flex items-center gap-2 text-[13px] text-[var(--ecode-text-muted)]">
                  <CheckCircle className="h-4 w-4 text-ecode-accent" />
                  No credit card required
                </div>
                <div className="flex items-center gap-2 text-[13px] text-[var(--ecode-text-muted)]">
                  <CheckCircle className="h-4 w-4 text-ecode-accent" />
                  Deploy instantly
                </div>
                <div className="flex items-center gap-2 text-[13px] text-[var(--ecode-text-muted)]">
                  <CheckCircle className="h-4 w-4 text-ecode-accent" />
                  Scale to millions
                </div>
              </LazyMotionDiv>
            </LazyMotionDiv>

            {/* CTA Buttons */}
            <LazyMotionDiv 
              className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center mt-8 w-full px-4 sm:px-0"
              variants={fadeInUp}
            >
              <Button 
                size="lg"
                variant="outline"
                className="gap-2 px-6 sm:px-8 py-4 sm:py-6 text-base sm:text-[15px] border-2 border-[var(--ecode-border)] hover:border-ecode-accent/50 w-full sm:w-auto min-h-[48px] transition-all duration-300 hover:shadow-[0_4px_16px_-4px_rgba(242,98,7,0.2)]"
                onClick={() => {
                  const demoSection = document.getElementById('video-demo');
                  demoSection?.scrollIntoView({ behavior: 'smooth' });
                }}
                data-testid="button-hero-watch-demo"
              >
                <PlayCircle className="h-4 w-4 sm:h-5 sm:w-5 text-ecode-accent" />
                Watch Demo (2 min)
              </Button>
              <Button 
                size="lg"
                variant="ghost"
                className="gap-2 px-6 sm:px-8 py-4 sm:py-6 text-base sm:text-[15px] w-full sm:w-auto min-h-[48px] text-[var(--ecode-text)] hover:text-ecode-accent transition-all duration-300"
                onClick={() => navigate('/pricing')}
                data-testid="button-hero-view-pricing"
              >
                View Pricing
                <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </LazyMotionDiv>
          </LazyMotionDiv>
        </div>

        {/* Scroll Indicator */}
        <LazyMotionDiv 
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <ChevronRight className="h-8 w-8 text-gray-400 rotate-90" />
        </LazyMotionDiv>
      </LazyMotionDiv>

      {/* IDE Feature Showcase - Pre-login value demonstration */}
      <IDEFeatureShowcase />

      {/* Stats Section */}
      <section className="py-20 bg-gradient-to-b from-[var(--ecode-background)] to-[var(--ecode-surface-tertiary)]" data-testid="section-stats">
        <div className="container-responsive max-w-7xl">
          <LazyMotionDiv 
            className="grid grid-cols-2 md:grid-cols-4 gap-8"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {stats.map((stat, index) => (
              <LazyMotionDiv 
                key={index}
                className="text-center group"
                variants={fadeInUp}
                data-testid={`stat-${stat.label.toLowerCase().replace(/\s/g, '-')}`}
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-ecode-accent/10 mb-3 transition-all duration-300 group-hover:bg-ecode-accent/20 group-hover:scale-110">
                  <div className="text-ecode-accent">{stat.icon}</div>
                </div>
                <div className="text-4xl font-bold bg-gradient-to-r from-ecode-orange via-ecode-orange-light to-ecode-yellow bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="text-[13px] text-[var(--ecode-text-muted)] mt-1">
                  {stat.label}
                </div>
              </LazyMotionDiv>
            ))}
          </LazyMotionDiv>
        </div>
      </section>

      {/* Video Demo Section */}
      <section id="video-demo" className="py-20 bg-[var(--ecode-surface-tertiary)]" data-testid="section-video-demo">
        <div className="container-responsive max-w-7xl">
          <LazyMotionDiv 
            className="text-center mb-12"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            <LazyMotionDiv 
              className="text-4xl sm:text-5xl font-bold mb-4 text-[var(--ecode-text)]"
              variants={fadeInUp}
            >
              See E-Code Platform in Action
            </LazyMotionDiv>
            <LazyMotionDiv 
              className="text-xl text-[var(--ecode-text-muted)] max-w-3xl mx-auto"
              variants={fadeInUp}
            >
              Watch a real demo: Build and deploy a full-stack application in under 2 minutes using AI agents
            </LazyMotionDiv>
          </LazyMotionDiv>

          <LazyMotionDiv 
            className="relative max-w-5xl mx-auto"
            initial={{ scale: 0.9, opacity: 0, y: 30 }}
            whileInView={{ scale: 1, opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            {/* Video Container */}
            <div className="relative rounded-2xl overflow-hidden shadow-[0_8px_32px_-8px_rgba(242,98,7,0.3)] bg-gray-900 border border-[var(--ecode-border)] transition-all duration-300 hover:shadow-[0_12px_40px_-8px_rgba(242,98,7,0.4)]">
              {/* Video Placeholder */}
              <div className="relative aspect-video bg-gradient-to-br from-ecode-accent/20 to-ecode-secondary-accent/20">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  poster={modernSoftwareImg}
                  controls={false}
                  muted={isMuted}
                  loop
                  playsInline
                >
                  <source src="/assets/platform-demo.mp4" type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
                
                {/* Custom Controls Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                
                {/* Play Button */}
                <button
                  className="absolute inset-0 flex items-center justify-center group"
                  onClick={() => {
                    if (videoRef.current) {
                      if (isPlaying) {
                        videoRef.current.pause();
                      } else {
                        videoRef.current.play();
                      }
                      setIsPlaying(!isPlaying);
                    }
                  }}
                >
                  <div className="w-20 h-20 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                    {isPlaying ? (
                      <Pause className="h-8 w-8 text-white ml-0" />
                    ) : (
                      <Play className="h-8 w-8 text-white ml-1" />
                    )}
                  </div>
                </button>

                {/* Video Controls Bar */}
                <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center gap-4">
                  <button
                    className="text-white hover:text-gray-300 transition"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMuted(!isMuted);
                      if (videoRef.current) {
                        videoRef.current.muted = !isMuted;
                      }
                    }}
                  >
                    {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                  </button>
                  
                  <div className="flex-1" />
                  
                  <button
                    className="text-white hover:text-gray-300 transition"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (videoRef.current) {
                        videoRef.current.requestFullscreen();
                      }
                    }}
                  >
                    <Maximize className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Video Description */}
            <div className="mt-8 text-center">
              <h3 className="text-[15px] font-semibold mb-2">Live Platform Demo</h3>
              <p className="text-[13px] text-gray-600 dark:text-gray-400">
                Watch how E-Code Platform's AI agent builds a complete full-stack application with database, authentication, 
                and deployment - all from a single prompt
              </p>
              <div className="flex flex-wrap justify-center gap-4 mt-4">
                <Badge variant="secondary">AI Code Generation</Badge>
                <Badge variant="secondary">Real-time Preview</Badge>
                <Badge variant="secondary">Instant Deployment</Badge>
                <Badge variant="secondary">Database Setup</Badge>
              </div>
            </div>
          </LazyMotionDiv>
        </div>
      </section>

      {/* Projects Showcase - Examples Built with E-Code */}
      <section className="py-20 bg-[var(--ecode-background)]" data-testid="section-projects">
        <div className="container-responsive max-w-7xl">
          <LazyMotionDiv 
            className="text-center mb-12"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            <LazyMotionDiv 
              className="text-4xl sm:text-5xl font-bold mb-4 text-[var(--ecode-text)]"
              variants={fadeInUp}
            >
              Built with E-Code Platform
            </LazyMotionDiv>
            <LazyMotionDiv 
              className="text-xl text-[var(--ecode-text-muted)] max-w-3xl mx-auto"
              variants={fadeInUp}
            >
              Real production applications built by our community in hours, not months
            </LazyMotionDiv>
          </LazyMotionDiv>

          <LazyMotionDiv 
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {[
              {
                title: "TechStore Pro",
                description: "Full-featured e-commerce platform with 50K+ daily transactions",
                image: cloudComputingImg,
                tags: ["React", "Node.js", "PostgreSQL", "Stripe"],
                metrics: { users: "100K+", revenue: "$2M/mo", time: "Built in 3 days" },
                creator: "Built by StartupX"
              },
              {
                title: "CollabSpace",
                description: "Real-time collaboration tool used by 500+ remote teams",
                image: modernSoftwareImg,
                tags: ["Next.js", "WebSockets", "Redis", "AI"],
                metrics: { users: "50K+", messages: "10M+", time: "Built in 1 week" },
                creator: "Built by TeamFlow Inc"
              },
              {
                title: "DataViz Pro",
                description: "Analytics dashboard processing 1B+ events daily",
                image: codingWorkspaceImg,
                tags: ["Vue.js", "Python", "MongoDB", "D3.js"],
                metrics: { users: "10K+", events: "1B/day", time: "Built in 5 days" },
                creator: "Built by AnalyticsCo"
              },
              {
                title: "EduLearn Platform",
                description: "Online learning platform with 200K active students",
                image: cloudComputingImg,
                tags: ["React", "Django", "PostgreSQL", "Zoom API"],
                metrics: { students: "200K", courses: "5000+", time: "Built in 2 weeks" },
                creator: "Built by EduTech Global"
              },
              {
                title: "HealthTrack AI",
                description: "AI-powered health monitoring app with FDA approval",
                image: modernSoftwareImg,
                tags: ["React Native", "FastAPI", "TensorFlow", "FHIR"],
                metrics: { patients: "1M+", accuracy: "99.2%", time: "Built in 1 month" },
                creator: "Built by MedTech Solutions"
              },
              {
                title: "CryptoTrade Hub",
                description: "Cryptocurrency trading platform with $100M daily volume",
                image: codingWorkspaceImg,
                tags: ["Angular", "Go", "Redis", "WebSockets"],
                metrics: { volume: "$100M/day", trades: "1M+", time: "Built in 2 weeks" },
                creator: "Built by FinTech Innovations"
              }
            ].map((project, index) => (
              <LazyMotionDiv
                key={index}
                variants={scaleIn}
                whileHover={{ scale: 1.03 }}
                className="group cursor-pointer"
              >
                <Card className="h-full overflow-hidden border border-[var(--ecode-border)] bg-[var(--ecode-surface)] hover:border-ecode-accent/30 hover:shadow-[0_8px_32px_-8px_rgba(242,98,7,0.2)] transition-all duration-300">
                  <div className="relative h-48 overflow-hidden bg-gradient-to-br from-ecode-accent/10 to-ecode-secondary-accent/10">
                    <img 
                      src={project.image}
                      alt={project.title}
                      className="w-full h-full object-cover opacity-80 group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-4 left-4">
                      <h3 className="text-xl font-bold text-white">{project.title}</h3>
                      <p className="text-[13px] text-gray-200">{project.creator}</p>
                    </div>
                  </div>
                  <CardContent className="p-6">
                    <p className="text-[var(--ecode-text-muted)] mb-4">
                      {project.description}
                    </p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {project.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="text-[11px] bg-ecode-accent/10 text-ecode-accent border-ecode-accent/20">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-4 border-t border-[var(--ecode-border)]">
                      {Object.entries(project.metrics).map(([key, value]) => (
                        <div key={key} className="text-center">
                          <div className="text-[13px] font-semibold text-[var(--ecode-text)]">
                            {value}
                          </div>
                          <div className="text-[11px] text-[var(--ecode-text-muted)] capitalize">
                            {key === "time" ? "" : key}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </LazyMotionDiv>
            ))}
          </LazyMotionDiv>

          <LazyMotionDiv 
            className="text-center mt-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
          >
            <Button 
              size="lg" 
              variant="outline" 
              className="gap-2 border-[var(--ecode-border)] hover:border-ecode-accent/50 hover:text-ecode-accent transition-all duration-300"
              onClick={() => navigate('/explore')}
              data-testid="button-explore-projects"
            >
              Explore More Projects
              <ArrowRight className="h-4 w-4" />
            </Button>
          </LazyMotionDiv>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 bg-[var(--ecode-surface-tertiary)]" data-testid="section-features">
        <div className="container-responsive max-w-7xl">
          <LazyMotionDiv 
            className="text-center mb-16"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            <LazyMotionDiv 
              className="text-4xl sm:text-5xl font-bold mb-4 text-[var(--ecode-text)]"
              variants={fadeInUp}
            >
              Enterprise Features, Startup Speed
            </LazyMotionDiv>
            <LazyMotionDiv 
              className="text-xl text-[var(--ecode-text-muted)] max-w-3xl mx-auto"
              variants={fadeInUp}
            >
              Everything you need to build, deploy, and scale production applications
            </LazyMotionDiv>
          </LazyMotionDiv>

          <LazyMotionDiv 
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {features.map((feature, index) => (
              <LazyMotionDiv
                key={index}
                variants={scaleIn}
                whileHover={{ scale: 1.05 }}
                className="group"
                data-testid={`feature-card-${index}`}
              >
                <Card className="h-full border border-[var(--ecode-border)] bg-[var(--ecode-surface)] hover:border-ecode-accent/30 hover:shadow-[0_8px_32px_-8px_rgba(242,98,7,0.2)] transition-all duration-300">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-ecode-accent/15 to-ecode-secondary-accent/15 flex items-center justify-center mb-4 group-hover:scale-110 transition-all duration-300 group-hover:bg-gradient-to-br group-hover:from-ecode-accent/25 group-hover:to-ecode-secondary-accent/25">
                      <div className="text-ecode-accent">
                        {feature.icon}
                      </div>
                    </div>
                    <CardTitle className="text-xl text-[var(--ecode-text)]">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-[var(--ecode-text-muted)]">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </LazyMotionDiv>
            ))}
          </LazyMotionDiv>
        </div>
      </section>

      {/* Showcase Section with Images */}
      <section className="py-20 bg-gradient-to-b from-[var(--ecode-surface-tertiary)] to-[var(--ecode-background)]" data-testid="section-showcase">
        <div className="container-responsive max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center mb-20">
            <LazyMotionDiv
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="order-2 lg:order-1"
            >
              <img 
                src={modernSoftwareImg}
                alt="Team Collaboration"
                className="rounded-2xl shadow-[0_8px_32px_-8px_rgba(242,98,7,0.3)]"
                loading="lazy"
              />
            </LazyMotionDiv>
            
            <LazyMotionDiv
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="space-y-6 order-1 lg:order-2"
            >
              <Badge variant="outline" className="text-ecode-accent border-ecode-accent/20 bg-ecode-accent/5">
                Real-Time Collaboration
              </Badge>
              <h3 className="text-4xl font-bold text-[var(--ecode-text)]">
                Code Together,
                <span className="bg-gradient-to-r from-ecode-orange via-ecode-orange-light to-ecode-yellow bg-clip-text text-transparent"> Ship Faster</span>
              </h3>
              <p className="text-[15px] text-[var(--ecode-text-muted)]">
                Multiple developers can work on the same codebase simultaneously. See changes in real-time, 
                resolve conflicts automatically, and ship features faster than ever before.
              </p>
              <ul className="space-y-3">
                {['Live cursor tracking', 'Instant code sync', 'Voice & video chat', 'Shared debugging'].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-ecode-accent flex-shrink-0" />
                    <span className="text-[var(--ecode-text-secondary)]">{item}</span>
                  </li>
                ))}
              </ul>
              <Button size="lg" className="gap-2 bg-ecode-accent hover:bg-ecode-accent-hover text-white transition-all duration-300 hover:shadow-[0_8px_32px_-8px_rgba(242,98,7,0.4)]" data-testid="button-try-collaboration">
                Try Collaboration
                <ArrowRight className="h-4 w-4" />
              </Button>
            </LazyMotionDiv>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <LazyMotionDiv
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="space-y-6"
            >
              <Badge variant="outline" className="text-ecode-accent border-ecode-accent/20 bg-ecode-accent/5">
                AI Development
              </Badge>
              <h3 className="text-4xl font-bold text-[var(--ecode-text)]">
                Your AI
                <span className="bg-gradient-to-r from-ecode-orange via-ecode-orange-light to-ecode-yellow bg-clip-text text-transparent"> Pair Programmer</span>
              </h3>
              <p className="text-[15px] text-[var(--ecode-text-muted)]">
                Our AI understands your codebase, suggests improvements, writes tests, and even deploys your applications. 
                It's like having a senior developer available 24/7.
              </p>
              <ul className="space-y-3">
                {['Code generation', 'Bug detection & fixes', 'Performance optimization', 'Security scanning'].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-ecode-accent flex-shrink-0" />
                    <span className="text-[var(--ecode-text-secondary)]">{item}</span>
                  </li>
                ))}
              </ul>
              <Button size="lg" className="gap-2 bg-ecode-accent hover:bg-ecode-accent-hover text-white transition-all duration-300 hover:shadow-[0_8px_32px_-8px_rgba(242,98,7,0.4)]" data-testid="button-explore-ai">
                Explore AI Features
                <ArrowRight className="h-4 w-4" />
              </Button>
            </LazyMotionDiv>
            
            <LazyMotionDiv
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <img 
                src={codingWorkspaceImg}
                alt="Developer Workspace"
                className="rounded-2xl shadow-[0_8px_32px_-8px_rgba(242,98,7,0.3)]"
                loading="lazy"
              />
            </LazyMotionDiv>
          </div>
        </div>
      </section>

      {/* Language Support */}
      <section className="py-20 bg-[var(--ecode-background)]" data-testid="section-languages">
        <div className="container-responsive max-w-7xl text-center">
          <LazyMotionDiv
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            <LazyMotionDiv 
              className="text-4xl font-bold mb-4 text-[var(--ecode-text)]"
              variants={fadeInUp}
            >
              Any Language, Any Framework
            </LazyMotionDiv>
            <LazyMotionDiv 
              className="text-xl text-[var(--ecode-text-muted)] mb-12 max-w-3xl mx-auto"
              variants={fadeInUp}
            >
              Build with the tools you love. E-Code supports all major languages and frameworks out of the box.
            </LazyMotionDiv>
            
            <LazyMotionDiv 
              className="flex flex-wrap justify-center gap-6"
              variants={fadeInUp}
            >
              {[
                { Icon: SiPython, name: 'Python', color: 'text-ecode-accent' },
                { Icon: SiJavascript, name: 'JavaScript', color: 'text-ecode-secondary-accent' },
                { Icon: SiTypescript, name: 'TypeScript', color: 'text-ecode-orange-light' },
                { Icon: SiReact, name: 'React', color: 'text-cyan-500' },
                { Icon: SiNodedotjs, name: 'Node.js', color: 'text-green-500' },
                { Icon: SiGo, name: 'Go', color: 'text-cyan-600' },
                { Icon: SiRust, name: 'Rust', color: 'text-ecode-accent' },
                { Icon: SiPhp, name: 'PHP', color: 'text-purple-500' },
                { Icon: SiOpenjdk, name: 'Java', color: 'text-red-600' },
                { Icon: SiDocker, name: 'Docker', color: 'text-ecode-orange-light' },
                { Icon: SiKubernetes, name: 'Kubernetes', color: 'text-ecode-accent' },
                { Icon: SiSpring, name: 'Spring', color: 'text-green-600' }
              ].map(({ Icon, name, color }, index) => (
                <LazyMotionDiv
                  key={name}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-[var(--ecode-surface)] border border-transparent hover:border-ecode-accent/30 hover:shadow-[0_4px_16px_-4px_rgba(242,98,7,0.15)] transition-all duration-300"
                  whileHover={{ scale: 1.1 }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  data-testid={`language-${name.toLowerCase().replace(/\./g, '')}`}
                >
                  <Icon className={`h-12 w-12 ${color}`} />
                  <span className="text-[13px] font-medium text-[var(--ecode-text)]">{name}</span>
                </LazyMotionDiv>
              ))}
            </LazyMotionDiv>
          </LazyMotionDiv>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-gradient-to-b from-[var(--ecode-background)] to-[var(--ecode-surface-tertiary)]" data-testid="section-testimonials">
        <div className="container-responsive max-w-7xl">
          <LazyMotionDiv 
            className="text-center mb-16"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            <LazyMotionDiv 
              className="text-4xl sm:text-5xl font-bold mb-4 text-[var(--ecode-text)]"
              variants={fadeInUp}
            >
              Trusted by Industry Leaders
            </LazyMotionDiv>
            <LazyMotionDiv 
              className="text-xl text-[var(--ecode-text-muted)]"
              variants={fadeInUp}
            >
              See why thousands of companies choose E-Code
            </LazyMotionDiv>
          </LazyMotionDiv>

          <LazyMotionDiv 
            className="grid md:grid-cols-3 gap-8"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            {testimonials.map((testimonial, index) => (
              <LazyMotionDiv key={index} variants={scaleIn} data-testid={`testimonial-${index}`}>
                <Card className="h-full border border-[var(--ecode-border)] bg-[var(--ecode-surface)] hover:border-ecode-accent/30 hover:shadow-[0_8px_32px_-8px_rgba(242,98,7,0.2)] transition-all duration-300">
                  <CardHeader>
                    <div className="flex items-center gap-4 mb-4">
                      <div 
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold bg-gradient-to-br from-ecode-orange via-ecode-orange-light to-ecode-yellow"
                      >
                        {testimonial.avatar}
                      </div>
                      <div>
                        <div className="font-semibold text-[var(--ecode-text)]">{testimonial.author}</div>
                        <div className="text-[13px] text-[var(--ecode-text-muted)]">{testimonial.role}</div>
                        <div className="text-[11px] text-[var(--ecode-text-muted)]">{testimonial.company}</div>
                      </div>
                    </div>
                    <div className="flex gap-1 mb-3">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-ecode-secondary-accent text-ecode-secondary-accent" />
                      ))}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-[var(--ecode-text-muted)] italic">
                      "{testimonial.quote}"
                    </p>
                  </CardContent>
                </Card>
              </LazyMotionDiv>
            ))}
          </LazyMotionDiv>

          {/* Enterprise Logos */}
          <LazyMotionDiv 
            className="mt-16 text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-[13px] text-[var(--ecode-text-muted)] mb-8">
              Trusted by Fortune 500 companies and startups alike
            </p>
            <div className="flex flex-wrap justify-center items-center gap-12 opacity-60 grayscale hover:grayscale-0 transition-all duration-300 hover:opacity-100 text-[var(--ecode-text)]">
              <SiGoogle className="h-8 w-auto" />
              <span className="text-2xl font-bold">Microsoft</span>
              {/* Amazon icon removed */}
              <span className="text-2xl font-bold">IBM</span>
              <span className="text-2xl font-bold">Oracle</span>
              <span className="text-2xl font-bold">Meta</span>
            </div>
          </LazyMotionDiv>
        </div>
      </section>

      {/* CTA Section */}
      <section 
        className="py-20 text-white bg-gradient-to-br from-ecode-orange via-ecode-orange-light to-ecode-yellow"
        data-testid="section-cta"
      >
        <div className="container-responsive max-w-4xl text-center">
          <LazyMotionDiv
            initial={{ scale: 0.9, opacity: 0, y: 30 }}
            whileInView={{ scale: 1, opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
            <h2 className="text-4xl sm:text-5xl font-bold">
              Ready to Build Something Amazing?
            </h2>
            <p className="text-xl opacity-90 max-w-2xl mx-auto">
              Join developers worldwide who are shipping faster with E-Code. 
              Start for free, scale to millions.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mt-8">
              <Button 
                size="lg"
                className="bg-white text-ecode-accent hover:bg-white/95 px-8 py-6 text-[15px] font-semibold shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                onClick={() => {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                  setTimeout(() => {
                    const aiInput = document.querySelector('input[type="text"]') as HTMLInputElement;
                    if (aiInput) {
                      aiInput.focus();
                    }
                  }, 500);
                }}
                data-testid="button-start-building-cta"
              >
                <Sparkles className="mr-2 h-5 w-5" />
                Start Building Free
              </Button>
              <Button 
                size="lg"
                variant="ghost"
                className="text-gray-900 border-2 border-gray-900 bg-white/20 hover:bg-white/40 px-8 py-6 text-[15px] font-semibold transition-all duration-300"
                onClick={() => navigate('/contact-sales')}
                data-testid="button-contact-sales"
              >
                <Building2 className="mr-2 h-5 w-5" />
                Contact Sales
              </Button>
            </div>
          </LazyMotionDiv>
        </div>
      </section>

      {/* Build Mode Selector Dialog */}
      <BuildModeSelector
        open={buildModeDialogOpen}
        onOpenChange={setBuildModeDialogOpen}
        onSelectMode={handleBuildModeSelect}
        projectName={pendingBuildPrompt.slice(0, 50) + (pendingBuildPrompt.length > 50 ? '...' : '')}
      />
    </MarketingLayout>
  );
}