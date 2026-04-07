import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Download,
  Mail,
  Newspaper,
  Calendar,
  Users,
  TrendingUp,
  Award,
  Briefcase,
  Image,
  Video,
  FileText,
  ExternalLink,
  Quote,
  Building,
  Zap,
  Activity,
  Star,
  Rocket
} from 'lucide-react';
import { Link } from 'wouter';

interface PressRelease {
  date: string;
  title: string;
  description: string;
  link: string;
}

interface MediaKit {
  title: string;
  description: string;
  icon: React.ElementType;
  downloadUrl: string;
}

interface Coverage {
  outlet: string;
  date: string;
  title: string;
  quote?: string;
  link: string;
}

export default function Press() {
  const pressReleases: PressRelease[] = [
    {
      date: '2025-07-08',
      title: 'E-Code Exits Stealth with Vibe Coding Beta for Collaborative Teams',
      description:
        'Launch introduces a playful, guided AI building experience tailored for product squads adopting vibe-driven workflows.',
      link: '#'
    },
    {
      date: '2025-06-12',
      title: 'E-Code Ships Live Project Spaces for Rapid Beta Collaboration',
      description:
        'New shared sandboxes let beta users co-create apps with AI in real time, streamlining handoff between design and engineering.',
      link: '#'
    },
    {
      date: '2025-05-20',
      title: 'E-Code Celebrates 1,500 Founding Builders in First Month of Beta',
      description:
        'Momentum from early adopters showcases demand for a more joyful way to ship software with AI.',
      link: '#'
    },
  ];

  const mediaKit: MediaKit[] = [
    {
      title: 'Logo Package',
      description: 'High-resolution logos in various formats',
      icon: Image,
      downloadUrl: '#'
    },
    {
      title: 'Product Screenshots',
      description: 'UI screenshots and product demos',
      icon: Image,
      downloadUrl: '#'
    },
    {
      title: 'Executive Bios',
      description: 'Leadership team biographies and headshots',
      icon: Users,
      downloadUrl: '#'
    },
    {
      title: 'Company Fact Sheet',
      description: 'Key statistics and company information',
      icon: FileText,
      downloadUrl: '#'
    },
    {
      title: 'Brand Guidelines',
      description: 'Visual identity and usage guidelines',
      icon: Briefcase,
      downloadUrl: '#'
    },
    {
      title: 'Product Videos',
      description: 'Demo videos and promotional content',
      icon: Video,
      downloadUrl: '#'
    }
  ];

  const coverage: Coverage[] = [
    {
      outlet: 'BetaList',
      date: '2025-07-10',
      title: 'E-Code Introduces “Vibe Coding” for the Next Wave of Makers',
      quote: 'E-Code\'s friendly AI feels like pairing with your most creative teammate.',
      link: '#'
    },
    {
      outlet: 'Product Hunt',
      date: '2025-07-05',
      title: 'Early Teams Are Shipping Faster with E-Code\'s Beta Workspaces',
      quote: 'A surprisingly delightful balance of autonomy and guardrails for AI-assisted coding.',
      link: '#'
    },
    {
      outlet: 'Future of Coding',
      date: '2025-06-18',
      title: 'Inside E-Code\'s Playful Take on Collaborative AI Development',
      link: '#'
    },
    {
      outlet: 'Indie Hackers',
      date: '2025-05-29',
      title: 'How Vibe Coding Helps Small Teams Feel 10x Bigger',
      quote: 'This is the first AI workspace that feels built for the creative energy of shipping together.',
      link: '#'
    }
  ];

  const stats = [
    {
      value: '1,900+',
      label: 'Beta Builders',
      description: 'Early teams crafting AI-assisted workflows each week',
      icon: Users
    },
    {
      value: '150',
      label: 'Daily Projects',
      description: 'Average vibe-coded launches happening across beta',
      icon: Zap
    },
    {
      value: '85%',
      label: '30-Day Retention',
      description: 'Builders who return after their first collaborative sprint',
      icon: Activity
    },
    {
      value: '15%',
      label: 'MoM Growth',
      description: 'Consistent momentum since launch three months ago',
      icon: TrendingUp
    },
    {
      value: '4.8/5',
      label: 'User Rating',
      description: 'Across 200+ thoughtful reviews from our beta community',
      icon: Star
    },
    {
      value: '3 months',
      label: 'Since Beta Launch',
      description: 'Continuously shipping new magic for early partners',
      icon: Calendar
    }
  ];

  const highlights = [
    {
      title: 'Built for creative shipping squads',
      description:
        'Teams use guided prompts, saved rituals, and realtime pair-building to keep momentum high without losing the vibe.',
      icon: Rocket
    },
    {
      title: 'Human-in-the-loop by design',
      description:
        'Every AI suggestion is transparent and editable, helping product leads and engineers stay aligned while iterating quickly.',
      icon: Award
    },
    {
      title: 'Seamless press-friendly stories',
      description:
        'From launch decks to beta access, our team partners with storytellers to showcase what modern collaborative coding feels like.',
      icon: Briefcase
    }
  ];

  return (
    <div className="min-h-screen bg-background" data-testid="page-press">
      <PublicNavbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-primary/10 via-background to-background">
        <div className="absolute inset-x-0 -top-40 -z-10 h-80 bg-gradient-to-b from-primary/30 via-transparent to-transparent blur-3xl opacity-60" />
        <div className="container-responsive py-20">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <Badge className="mx-auto w-fit" variant="secondary">
              Beta launched 3 months ago
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight" data-testid="heading-press">
              Press Center
            </h1>
            <p className="text-[15px] md:text-xl text-muted-foreground">
              Explore the latest stories, milestones, and resources from E-Code — the vibe coding
              platform helping small teams feel like crews of 50.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="min-h-[44px]" asChild data-testid="button-press-contact">
                <a href="mailto:press@e-code.ai">
                  <Mail className="mr-2 h-5 w-5" />
                  Contact Press Team
                </a>
              </Button>
              <Button size="lg" variant="outline" className="min-h-[44px]" asChild data-testid="button-press-media-kit">
                <Link href="#media-kit">
                  <Download className="mr-2 h-5 w-5" />
                  Download Media Kit
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Highlights */}
      <section className="py-16 border-b bg-muted/20">
        <div className="container-responsive">
          <div className="grid gap-6 md:grid-cols-3">
            {highlights.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.title} className="h-full border-muted/60 bg-background/80 backdrop-blur">
                  <CardContent className="pt-8 space-y-4">
                    <div className="inline-flex items-center justify-center rounded-full bg-primary/10 p-3 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-[15px] font-semibold">{item.title}</h3>
                      <p className="text-[13px] text-muted-foreground leading-relaxed">{item.description}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Company Stats */}
      <section className="py-16 border-b">
        <div className="container-responsive">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label} className="relative overflow-hidden h-full transition-all hover:-translate-y-1 hover:shadow-xl">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-purple-200/20 opacity-0 hover:opacity-100 transition-opacity" />
                  <CardContent className="relative p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="rounded-full bg-primary/10 p-3 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <Badge variant="outline" className="uppercase tracking-wide text-[11px] font-medium">
                        Beta metric
                      </Badge>
                    </div>
                    <div>
                      <p className="text-3xl font-bold">{stat.value}</p>
                      <p className="text-[13px] font-medium text-muted-foreground">{stat.label}</p>
                    </div>
                    <p className="text-[13px] text-muted-foreground leading-relaxed">{stat.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Latest Press Releases */}
      <section className="py-20">
        <div className="container-responsive">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Latest Press Releases
            </h2>
            <p className="text-[15px] text-muted-foreground">
              Official announcements and company news
            </p>
          </div>

          <div className="space-y-4 max-w-4xl mx-auto">
            {pressReleases.map((release) => (
              <Card key={release.title} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardDescription className="flex items-center gap-2 mb-2">
                        <Calendar className="h-4 w-4" />
                        {new Date(release.date).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </CardDescription>
                      <CardTitle className="text-xl mb-2">{release.title}</CardTitle>
                      <CardDescription>{release.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button variant="link" asChild className="p-0">
                    <a href={release.link} className="flex items-center gap-1">
                      Read Full Release
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="text-center mt-8">
            <Button variant="outline" asChild>
              <Link href="/press/releases">
                View All Press Releases
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Media Coverage */}
      <section className="py-20 bg-muted/30">
        <div className="container-responsive">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              In the News
            </h2>
            <p className="text-[15px] text-muted-foreground">
              What the media is saying about E-Code
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {coverage.map((article) => (
              <Card key={article.title} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary">{article.outlet}</Badge>
                    <span className="text-[13px] text-muted-foreground">
                      {new Date(article.date).toLocaleDateString()}
                    </span>
                  </div>
                  <CardTitle className="text-[15px]">{article.title}</CardTitle>
                  {article.quote && (
                    <div className="mt-3 flex gap-2">
                      <Quote className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
                      <CardDescription className="italic">
                        "{article.quote}"
                      </CardDescription>
                    </div>
                  )}
                </CardHeader>
                <CardContent>
                  <Button variant="link" asChild className="p-0">
                    <a href={article.link} className="flex items-center gap-1">
                      Read Article
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* About E-Code Section */}
      <section className="py-20">
        <div className="container-responsive">
          <Card className="max-w-4xl mx-auto">
            <CardHeader>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Building className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-2xl">About E-Code</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                E-Code is the vibe coding platform pairing human creativity with joyful AI rituals.
                We launched our private beta just three months ago to help small, ambitious teams
                co-create production-ready software without losing their unique flavor.
              </p>
              <p>
                Instead of replacing product squads, E-Code amplifies them. Builders orchestrate AI
                workflows, remix reusable rituals, and ship confidently with full transparency into
                every generated change. Our focus is on crafting an expressive, collaborative space
                that keeps shipping fun.
              </p>
              <div className="grid md:grid-cols-2 gap-6 mt-6">
                <div>
                  <h4 className="font-semibold mb-2">Key Features</h4>
                  <ul className="space-y-1 text-[13px] text-muted-foreground">
                    <li>• Guided vibe prompts tuned for each team ritual</li>
                    <li>• Live co-building with clear diff reviews</li>
                    <li>• Instant previews and hosted sandboxes</li>
                    <li>• Shared knowledge base of reusable flows</li>
                    <li>• Enterprise-ready guardrails from day one</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Company Facts</h4>
                  <ul className="space-y-1 text-[13px] text-muted-foreground">
                    <li>• Founded: 2025</li>
                    <li>• Headquarters: Remote-first (SF + NYC hubs)</li>
                    <li>• Team: 18 humans & a very opinionated AI</li>
                    <li>• Beta Launch: Spring 2025</li>
                    <li>• Mission: Make shipping software feel like a jam session</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Media Kit */}
      <section id="media-kit" className="py-20 bg-muted/30">
        <div className="container-responsive">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Media Kit
            </h2>
            <p className="text-[15px] text-muted-foreground">
              Download our brand assets and media resources
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {mediaKit.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.title} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-muted rounded-lg">
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <CardTitle className="text-[15px]">{item.title}</CardTitle>
                        <CardDescription>{item.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Button variant="outline" size="sm" className="w-full" asChild>
                      <a href={item.downloadUrl}>
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="text-center mt-8">
            <p className="text-[13px] text-muted-foreground">
              For custom assets or additional resources, please contact{' '}
              <a href="mailto:press@e-code.ai" className="text-primary hover:underline">
                press@e-code.ai
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-20">
        <div className="container-responsive">
          <Card className="max-w-3xl mx-auto text-center">
            <CardContent className="py-12">
              <Newspaper className="h-12 w-12 mx-auto mb-6 text-primary" />
              <h3 className="text-2xl font-bold mb-4">Press Inquiries</h3>
              <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
                For media inquiries, interview requests, or additional information, 
                please contact our press team.
              </p>
              <div className="space-y-4">
                <div>
                  <p className="font-semibold">Email</p>
                  <a href="mailto:press@e-code.ai" className="text-primary hover:underline">
                    press@e-code.ai
                  </a>
                </div>
                <div>
                  <p className="font-semibold">Press Kit Password</p>
                  <p className="text-[13px] text-muted-foreground">
                    Contact us for access to password-protected resources
                  </p>
                </div>
              </div>
              <Button className="mt-8" asChild>
                <a href="mailto:press@e-code.ai">
                  <Mail className="mr-2 h-5 w-5" />
                  Contact Press Team
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}