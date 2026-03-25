import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { 
  Code, Users, Globe, Target, Lightbulb, Heart, Rocket,
  ChevronRight, ArrowRight, Building2, GraduationCap, Sparkles, Shield
} from 'lucide-react';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { useQuery } from '@tanstack/react-query';
import { Spinner } from '@/components/ui/spinner';

interface AboutData {
  values: Array<{
    icon: string;
    title: string;
    description: string;
  }>;
  milestones: Array<{
    year: string;
    event: string;
  }>;
  team: Array<{
    name: string;
    role: string;
    avatar: string;
  }>;
  stats: Array<{
    icon: string;
    label: string;
    value: string;
    description: string;
  }>;
}

export default function About() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  
  // Fetch about data from backend
  const { data: aboutData, isLoading, error } = useQuery<AboutData>({
    queryKey: ['/api/about']
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <PublicNavbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Spinner className="size-8 mb-4" />
            <p className="text-muted-foreground">Loading about information...</p>
          </div>
        </div>
        <PublicFooter />
      </div>
    );
  }

  if (error || !aboutData) {
    const fallbackData: AboutData = {
      values: [
        { icon: 'Lightbulb', title: 'Innovation', description: 'We push the boundaries of what is possible with AI.' },
        { icon: 'Users', title: 'Collaboration', description: 'Building software is a team sport.' },
        { icon: 'Shield', title: 'Security', description: 'Enterprise-grade protection for your code and data.' },
        { icon: 'Target', title: 'Focus', description: 'Zero friction from idea to deployment.' }
      ],
      milestones: [
        { year: '2024', event: 'E-Code founded with a vision to democratize software creation.' },
        { year: '2025', event: 'Global launch of the Vibe platform.' }
      ],
      team: [
        { name: 'Sarah Chen', role: 'CEO & Founder', avatar: 'SC' },
        { name: 'Michael Rodriguez', role: 'CTO', avatar: 'MR' }
      ],
      stats: [
        { icon: 'Users', label: 'Developers', value: '2M+', description: 'Active developers on the platform.' },
        { icon: 'Rocket', label: 'Apps', value: '10M+', description: 'Applications deployed globally.' }
      ]
    };

    return (
      <div className="min-h-screen flex flex-col">
        <PublicNavbar />
        <AboutContent data={fallbackData} navigate={navigate} user={user} />
        <PublicFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <PublicNavbar />
      <AboutContent data={aboutData} navigate={navigate} user={user} />
      <PublicFooter />
    </div>
  );
}

function AboutContent({ data, navigate, user }: { data: AboutData, navigate: any, user: any }) {
  const { values, milestones, team, stats } = data;

  const iconComponents: Record<string, React.ComponentType<{ className?: string }>> = {
    'Lightbulb': Lightbulb,
    'Users': Users,
    'Globe': Globe,
    'Heart': Heart,
    'Target': Target,
    'Rocket': Rocket,
    'Building2': Building2,
    'GraduationCap': GraduationCap,
    'Sparkles': Sparkles,
    'Shield': Shield
  };

  const renderIcon = (iconName: string, className = 'h-6 w-6') => {
    const IconComponent = iconComponents[iconName] || Lightbulb;
    return <IconComponent className={className} />;
  };

  const valuesWithIcons = values.map((value) => ({
    ...value,
    icon: renderIcon(value.icon)
  }));

  return (
    <>
      {/* Hero Section */}
      <section className="py-12 sm:py-16 md:py-10 px-4 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-5 sm:space-y-7">
            <Badge variant="secondary" className="mb-2 sm:mb-4 text-[11px] sm:text-[13px]">
              <Sparkles className="h-3 w-3 mr-1" />
              Series A raise in progress · Targeting $25M for global launch
            </Badge>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold">
              Orchestrating the <span className="text-primary">Vibe coding era</span> for global enterprises
            </h1>
            <p className="text-base sm:text-[15px] md:text-xl text-muted-foreground max-w-3xl mx-auto px-4 sm:px-0">
              E-Code partners with the world’s most ambitious engineering, product, and data teams to choreograph
              creation in the cloud. Our Vibe platform blends human craft with adaptive AI so leaders can launch
              resilient software, govern responsibly, and scale talent with confidence.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <Button size="lg" onClick={() => navigate('/ai-agent')} data-testid="button-about-discover-platform">
                Discover the Vibe platform
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate('/contact-sales')}
                className="w-full sm:w-auto"
                data-testid="button-about-talk-team"
              >
                Talk with our team
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-10 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div>
              <Badge variant="outline" className="mb-4">
                <Target className="h-3 w-3 mr-1" />
                Our mandate
              </Badge>
              <h2 className="text-3xl font-bold mb-4">
                Building the enterprise home for expressive software teams
              </h2>
              <p className="text-[15px] text-muted-foreground mb-6">
                Vibe is engineered for leaders who need velocity without compromise. We eliminate friction from
                discovery to deployment so multidisciplinary teams can ideate, orchestrate, and scale modern
                applications in one secure operating environment.
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-1 bg-green-100 dark:bg-green-900/20 rounded">
                    <Code className="h-4 w-4 text-green-600 dark:text-green-400" />
                  </div>
                  <p className="text-[13px]">
                    <strong>Adaptive AI co-creators</strong> accelerate architecture reviews, compliance, and delivery.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-1 bg-blue-100 dark:bg-blue-900/20 rounded">
                    <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <p className="text-[13px]">
                    <strong>Enterprise-grade governance</strong> unifies audit trails, secrets, and policy automation.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="p-1 bg-purple-100 dark:bg-purple-900/20 rounded">
                    <Globe className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <p className="text-[13px]">
                    <strong>Global reach</strong> with sovereign-ready regions and 24/7 multilingual customer success.
                  </p>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-purple-600/20 blur-3xl" />
              <Card className="relative">
                <CardContent className="p-8">
                  <div className="text-center space-y-6">
                    <div className="text-6xl font-bold text-primary">$25M</div>
                    <p className="text-xl font-semibold">Series A growth capital powering the Vibe platform</p>
                    <p className="text-[13px] text-muted-foreground max-w-md mx-auto">
                      The raise accelerates enterprise go-to-market, compliance automation, and sovereign-ready
                      infrastructure investments so customers can scale with confidence.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
                      <div>
                        <div className="text-2xl font-bold">2025</div>
                        <p className="text-[13px] text-muted-foreground">Global launch</p>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">6</div>
                        <p className="text-[13px] text-muted-foreground">Enterprise regions</p>
                      </div>
                      <div>
                        <div className="text-2xl font-bold">80+</div>
                        <p className="text-[13px] text-muted-foreground">Strategic partners</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* AI Agent Innovation Section */}
      <section className="py-10 px-4 bg-gradient-to-b from-transparent via-violet-50/10 to-transparent dark:via-violet-950/20">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <Badge variant="default" className="mb-4 text-[13px] px-4 py-1">
              <Sparkles className="h-4 w-4 mr-1" />
              The Vibe platform
            </Badge>
            <h2 className="text-4xl font-bold mb-6">
              Where human rhythm meets autonomous software creation
            </h2>
            <p className="text-[15px] text-muted-foreground max-w-3xl mx-auto">
              Vibe synchronizes secure environments, collaborative workspaces, and adaptive AI agents so every ship
              cycle feels orchestrated. From regulated industries to global studios, teams compose software with the
              reliability of an enterprise system and the energy of a creative hub.
            </p>
          </div>

          <div className="grid md:grid-cols-1 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
            <Card className="border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-50/50 to-transparent dark:from-violet-950/20">
              <CardHeader>
                <div className="p-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-lg w-fit mb-3">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <CardTitle>Intelligent workstreams</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  AI conductors coordinate planning, build, and release rituals while respecting your guardrails and
                  domain expertise.
                </p>
              </CardContent>
            </Card>

            <Card className="border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-50/50 to-transparent dark:from-violet-950/20">
              <CardHeader>
                <div className="p-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-lg w-fit mb-3">
                  <Code className="h-6 w-6 text-white" />
                </div>
                <CardTitle>Enterprise fabric</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Unified security, observability, and policy automation create a trusted surface for Fortune 500
                  collaboration.
                </p>
              </CardContent>
            </Card>

            <Card className="border-violet-200 dark:border-violet-800 bg-gradient-to-br from-violet-50/50 to-transparent dark:from-violet-950/20">
              <CardHeader>
                <div className="p-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-lg w-fit mb-3">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <CardTitle>Global community</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Builders, analysts, and designers co-create in shared studios with localized compliance and
                  round-the-clock support.
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="text-center">
            <div className="inline-flex flex-col sm:flex-row gap-4">
              <Button
                size="lg"
                className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white"
                onClick={() => navigate('/solutions/app-builder')}
                data-testid="button-about-solution-suites"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                See solution suites
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => (user ? navigate('/dashboard') : navigate('/login'))}
                data-testid="button-about-start-building"
              >
                Start building now
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 sm:py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid gap-6 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-1 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <Card key={stat.label} className="h-full border-primary/20">
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-3xl font-bold text-primary">{stat.value}</CardTitle>
                    <CardDescription className="text-base font-semibold text-foreground/80">
                      {stat.label}
                    </CardDescription>
                  </div>
                  <div className="p-2 rounded-full bg-primary/10 text-primary">
                    {renderIcon(stat.icon, 'h-6 w-6')}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-[13px] text-muted-foreground leading-relaxed">{stat.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-10 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Our leadership principles</h2>
            <p className="text-[15px] text-muted-foreground">
              The beliefs that shape every line of code, every partnership, and every promise we make.
            </p>
          </div>
          <div className="grid md:grid-cols-1 md:grid-cols-2 lg:grid-cols-1 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {valuesWithIcons.map((value, index: number) => (
              <Card key={index}>
                <CardHeader>
                  <div className="p-2 bg-primary/10 rounded-lg w-fit mb-2">
                    {value.icon}
                  </div>
                  <CardTitle className="text-[15px]">{value.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-[13px] text-muted-foreground leading-relaxed">{value.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline Section */}
      <section className="py-10 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Milestones on our climb</h2>
            <p className="text-[15px] text-muted-foreground">
              Strategic moments that shaped Vibe into a trusted platform for enterprise creation.
            </p>
          </div>
          <div className="space-y-8">
            {milestones.map((milestone, index: number) => (
              <div key={index} className="flex gap-8 items-start">
                <div className="flex-shrink-0">
                  <Badge variant="outline" className="px-4 py-2">
                    {milestone.year}
                  </Badge>
                </div>
                <div className="flex-1">
                  <div className="h-full border-l-2 border-muted pl-8 pb-8">
                    <div className="relative">
                      <div className="absolute -left-[41px] w-4 h-4 bg-primary rounded-full" />
                      <p className="text-[15px] leading-relaxed">{milestone.event}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-10 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Executive leadership</h2>
            <p className="text-[15px] text-muted-foreground">
              Operators, technologists, and designers united by a mission to make expressive building a strategic
              advantage for every enterprise.
            </p>
          </div>
          <div className="grid md:grid-cols-1 md:grid-cols-2 lg:grid-cols-1 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {team.map((member, index: number) => (
              <Card key={index}>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-xl font-semibold">
                      {member.avatar || member.name?.charAt(0) || 'U'}
                    </div>
                    <div>
                      <h3 className="font-semibold text-[15px]">{member.name || 'Team Member'}</h3>
                      <p className="text-[13px] text-muted-foreground leading-relaxed">{member.role || 'Contributor'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="text-center mt-8">
            <Button variant="outline" onClick={() => navigate('/careers')} data-testid="button-about-careers">
              Explore careers at E-Code
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-10 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold mb-4">
            Set a new rhythm for your builders
          </h2>
          <p className="text-[15px] text-muted-foreground mb-8">
            Partner with E-Code to orchestrate secure, expressive creation across your organization—from the first
            whiteboard sketch to global deployment.
          </p>
          <div className="flex gap-4 justify-center flex-col sm:flex-row">
            <Button size="lg" onClick={() => navigate(user ? '/dashboard' : '/login')} data-testid="button-about-launch-workspace">
              Launch your workspace
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/contact-sales')} data-testid="button-about-executive-briefing">
              Request an executive briefing
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
