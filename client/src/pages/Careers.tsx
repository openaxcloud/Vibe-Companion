import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { 
  Code, Users, Globe, Rocket, Heart, Coffee, Gift, Home,
  ChevronRight, ArrowRight, MapPin, Clock, DollarSign,
  Briefcase, GraduationCap, Sparkles, TrendingUp,
  Shield, Zap, Trophy, Target, Building2, Laptop,
  Palette, Megaphone, HeartHandshake, ExternalLink
} from 'lucide-react';

interface Job {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  experience: string;
  salary?: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  niceToHave?: string[];
  team: string;
}

export default function Careers() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const benefits = [
    {
      icon: <DollarSign className="h-8 w-8" />,
      title: 'Competitive Compensation',
      description: 'Top-tier salaries and equity packages that reflect your impact'
    },
    {
      icon: <Heart className="h-8 w-8" />,
      title: 'Health & Wellness',
      description: '100% covered health, dental, vision, and mental health support'
    },
    {
      icon: <Home className="h-8 w-8" />,
      title: 'Remote First',
      description: 'Work from anywhere with quarterly team meetups'
    },
    {
      icon: <Coffee className="h-8 w-8" />,
      title: 'Unlimited PTO',
      description: 'Plus company-wide breaks to recharge together'
    },
    {
      icon: <GraduationCap className="h-8 w-8" />,
      title: 'Learning Budget',
      description: '$3,000 annual budget for growth and development'
    },
    {
      icon: <Gift className="h-8 w-8" />,
      title: 'Equipment & Perks',
      description: 'Top equipment, co-working stipend, and more'
    }
  ];

  const jobs: Job[] = [
    {
      id: '1',
      title: 'Senior Frontend Engineer',
      department: 'Engineering',
      location: 'Remote (Global)',
      type: 'Full-time',
      experience: '5+ years',
      salary: '$180k - $250k + equity',
      team: 'IDE Platform',
      description: 'Build the future of browser-based development. You\'ll work on our core editor, real-time collaboration, and performance-critical features that millions of developers use daily.',
      responsibilities: [
        'Architect and implement complex frontend features using React, TypeScript, and WebAssembly',
        'Optimize performance for our browser-based IDE handling large codebases',
        'Lead technical design discussions and mentor junior engineers',
        'Collaborate with backend teams to design efficient APIs',
        'Champion best practices in code quality, testing, and documentation'
      ],
      requirements: [
        '5+ years of experience building production web applications',
        'Expert knowledge of React, TypeScript, and modern web technologies',
        'Experience with performance optimization and browser APIs',
        'Strong understanding of data structures and algorithms',
        'Excellent communication skills and ability to work autonomously'
      ],
      niceToHave: [
        'Experience with WebAssembly or language parsers',
        'Contributions to open source projects',
        'Experience with real-time collaboration systems',
        'Background in developer tools or IDEs'
      ]
    },
    {
      id: '2',
      title: 'Staff Backend Engineer',
      department: 'Engineering',
      location: 'Remote (US/EU)',
      type: 'Full-time',
      experience: '6+ years',
      salary: '$200k - $280k + equity',
      team: 'Infrastructure',
      description: 'Scale our infrastructure to support millions of concurrent users. You\'ll work on distributed systems, container orchestration, and build the foundation that powers E-Code.',
      responsibilities: [
        'Design and implement highly scalable distributed systems',
        'Lead architecture decisions for critical infrastructure components',
        'Optimize database performance and implement efficient caching strategies',
        'Build robust monitoring and observability systems',
        'Mentor engineers and drive technical excellence across teams'
      ],
      requirements: [
        '6+ years building and operating distributed systems at scale',
        'Deep expertise in Go, Rust, or similar systems languages',
        'Experience with Kubernetes, container orchestration, and cloud platforms',
        'Strong understanding of networking, security, and system design',
        'Track record of leading complex technical projects'
      ],
      niceToHave: [
        'Experience with WebRTC or real-time systems',
        'Knowledge of compiler design or language runtimes',
        'Contributions to infrastructure open source projects',
        'Experience at high-growth startups'
      ]
    },
    {
      id: '3',
      title: 'Senior Product Designer',
      department: 'Design',
      location: 'Remote (Global)',
      type: 'Full-time',
      experience: '4+ years',
      salary: '$150k - $200k + equity',
      team: 'Product Design',
      description: 'Design the future of how millions learn to code and build software. You\'ll create intuitive, accessible experiences that make programming feel magical.',
      responsibilities: [
        'Lead end-to-end design for major product features',
        'Conduct user research and translate insights into design solutions',
        'Create and maintain our design system and component library',
        'Collaborate closely with engineers to ensure pixel-perfect implementation',
        'Present design work and rationale to stakeholders'
      ],
      requirements: [
        '4+ years of product design experience in consumer or developer tools',
        'Strong portfolio demonstrating UI/UX excellence and design thinking',
        'Proficiency in Figma and modern design tools',
        'Experience conducting user research and usability testing',
        'Excellent visual design skills with attention to detail'
      ],
      niceToHave: [
        'Experience designing developer tools or educational products',
        'Background in computer science or programming',
        'Experience with design systems at scale',
        'Passion for making technology accessible'
      ]
    },
    {
      id: '4',
      title: 'Developer Advocate',
      department: 'Developer Relations',
      location: 'Remote (US/EU)',
      type: 'Full-time',
      experience: '3+ years',
      salary: '$130k - $180k + equity',
      team: 'Community',
      description: 'Be the voice of millions of developers using E-Code. Create content, build demos, and help developers succeed with our platform.',
      responsibilities: [
        'Create technical content including tutorials, videos, and documentation',
        'Build impressive demos showcasing E-Code capabilities',
        'Engage with the community on social media and forums',
        'Speak at conferences and host workshops',
        'Gather feedback and advocate for developer needs internally'
      ],
      requirements: [
        '3+ years of software development or developer relations experience',
        'Excellent written and verbal communication skills',
        'Strong programming skills in multiple languages',
        'Experience creating technical content and public speaking',
        'Passion for teaching and helping others succeed'
      ],
      niceToHave: [
        'Existing audience or following in developer community',
        'Experience with video production and streaming',
        'Background in education or training',
        'Multiple language fluency'
      ]
    },
    {
      id: '5',
      title: 'Security Engineer',
      department: 'Security',
      location: 'Remote (Global)',
      type: 'Full-time',
      experience: '5+ years',
      salary: '$170k - $230k + equity',
      team: 'Security & Trust',
      description: 'Protect millions of developers and their code. You\'ll build security into every layer of our platform and lead our security initiatives.',
      responsibilities: [
        'Design and implement security architecture for our platform',
        'Conduct security reviews and threat modeling',
        'Build automated security testing and monitoring systems',
        'Lead incident response and security investigations',
        'Develop security policies and best practices'
      ],
      requirements: [
        '5+ years in application or infrastructure security',
        'Deep knowledge of web security, cryptography, and secure coding',
        'Experience with container and cloud security',
        'Strong programming skills in Go, Python, or similar',
        'Security certifications (CISSP, CEH) are a plus'
      ],
      niceToHave: [
        'Experience at a high-growth SaaS company',
        'Background in sandbox or isolation technologies',
        'Contributions to security tools or research',
        'Experience with compliance frameworks'
      ]
    },
    {
      id: '6',
      title: 'Engineering Manager',
      department: 'Engineering',
      location: 'Remote (US)',
      type: 'Full-time',
      experience: '2+ years management',
      salary: '$190k - $260k + equity',
      team: 'Various Teams',
      description: 'Lead and grow world-class engineering teams. You\'ll drive technical excellence while building an inclusive, high-performing culture.',
      responsibilities: [
        'Manage and mentor a team of 6-8 engineers',
        'Drive team productivity and technical excellence',
        'Partner with product managers to define and deliver roadmap',
        'Handle recruiting, performance management, and career development',
        'Foster an inclusive team culture and psychological safety'
      ],
      requirements: [
        '5+ years software engineering with 2+ years management experience',
        'Track record of building and scaling engineering teams',
        'Strong technical background with ability to review code and architecture',
        'Excellent communication and stakeholder management skills',
        'Experience with agile development and modern engineering practices'
      ],
      niceToHave: [
        'Experience at a fast-growing startup',
        'Background in distributed systems or developer tools',
        'Experience managing remote teams',
        'MBA or advanced technical degree'
      ]
    }
  ];

  const values = [
    {
      icon: <Rocket className="h-6 w-6" />,
      title: 'Move Fast',
      description: 'We ship quickly and iterate based on feedback'
    },
    {
      icon: <Target className="h-6 w-6" />,
      title: 'Be Curious',
      description: 'We constantly learn and explore new ideas'
    },
    {
      icon: <TrendingUp className="h-6 w-6" />,
      title: 'Think Big',
      description: 'We aim to impact billions of people'
    },
    {
      icon: <HeartHandshake className="h-6 w-6" />,
      title: 'Stay Humble',
      description: 'We listen, learn, and grow together'
    }
  ];

  const handleJobClick = (job: Job) => {
    setSelectedJob(job);
    setIsDialogOpen(true);
  };

  const getDepartmentIcon = (department: string) => {
    switch (department) {
      case 'Engineering': return <Code className="h-5 w-5" />;
      case 'Design': return <Palette className="h-5 w-5" />;
      case 'Developer Relations': return <Megaphone className="h-5 w-5" />;
      case 'Security': return <Shield className="h-5 w-5" />;
      case 'Product': return <Briefcase className="h-5 w-5" />;
      default: return <Building2 className="h-5 w-5" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PublicNavbar />

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-purple-600/10 to-pink-600/10" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(var(--primary),0.1),transparent_50%)]" />
        
        <div className="relative py-24 px-4">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-[13px] font-medium">We're hiring globally</span>
              </div>
              
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold">
                Build the future of
                <span className="block mt-2 bg-gradient-to-r from-primary via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  software creation
                </span>
              </h1>
              
              <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                Join our mission to bring the next billion software creators online. 
                We're looking for exceptional people who want to democratize programming.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg" 
                  className="text-[15px] px-8"
                  onClick={() => document.getElementById('open-positions')?.scrollIntoView({ behavior: 'smooth' })}
                  data-testid="button-careers-view-roles"
                >
                  View open roles
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  className="text-[15px] px-8"
                  onClick={() => navigate('/about')}
                  data-testid="button-careers-learn-about"
                >
                  Learn about us
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Culture Section */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted text-[13px] font-medium mb-4">
                  <Users className="h-4 w-4" />
                  Our Culture
                </div>
                <h2 className="text-4xl md:text-5xl font-bold mb-6">
                  Where talent meets
                  <span className="text-primary"> purpose</span>
                </h2>
                <p className="text-[15px] text-muted-foreground leading-relaxed">
                  We're building more than a product – we're creating a movement to democratize 
                  software creation. Our culture celebrates innovation, embraces challenges, 
                  and values every perspective.
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                {values.map((value, index) => (
                  <div key={index} className="space-y-3">
                    <div className="p-2 bg-primary/10 rounded-lg w-fit">
                      {value.icon}
                    </div>
                    <h3 className="font-semibold text-[15px]">{value.title}</h3>
                    <p className="text-[13px] text-muted-foreground leading-relaxed">
                      {value.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 via-purple-600/20 to-pink-600/20 blur-3xl opacity-70" />
              <div className="relative space-y-6">
                <Card className="border-2">
                  <CardHeader>
                    <CardTitle className="text-2xl">Life at E-Code</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="text-3xl font-bold text-primary">150+</div>
                        <p className="text-[13px] text-muted-foreground">Team members</p>
                      </div>
                      <div className="space-y-2">
                        <div className="text-3xl font-bold text-primary">25+</div>
                        <p className="text-[13px] text-muted-foreground">Countries</p>
                      </div>
                      <div className="space-y-2">
                        <div className="text-3xl font-bold text-primary">4.8/5</div>
                        <p className="text-[13px] text-muted-foreground">Employee rating</p>
                      </div>
                      <div className="space-y-2">
                        <div className="text-3xl font-bold text-primary">100%</div>
                        <p className="text-[13px] text-muted-foreground">Remote friendly</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-primary text-primary-foreground">
                  <CardContent className="pt-6">
                    <Trophy className="h-8 w-8 mb-4" />
                    <p className="text-[15px] font-medium mb-2">Best Places to Work 2024</p>
                    <p className="text-[13px] opacity-90">
                      Recognized as one of the top remote-first companies
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-24 px-4 bg-gradient-to-b from-muted/50 to-background">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted text-[13px] font-medium mb-4">
              <Gift className="h-4 w-4" />
              Benefits & Perks
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              We invest in <span className="text-primary">your success</span>
            </h2>
            <p className="text-[15px] text-muted-foreground max-w-2xl mx-auto">
              Competitive compensation is just the start. We provide everything you need to thrive personally and professionally.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {benefits.map((benefit, index) => (
              <Card key={index} className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
                <CardHeader>
                  <div className="p-3 bg-gradient-to-br from-primary/20 to-purple-600/20 rounded-xl w-fit mb-4 group-hover:scale-110 transition-transform">
                    {benefit.icon}
                  </div>
                  <CardTitle className="text-xl">{benefit.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <div className="mt-12 text-center">
            <p className="text-[13px] text-muted-foreground">
              Plus many more perks including team retreats, learning stipends, and wellness programs
            </p>
          </div>
        </div>
      </section>

      {/* Open Positions */}
      <section id="open-positions" className="py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted text-[13px] font-medium mb-4">
              <Briefcase className="h-4 w-4" />
              Open Positions
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Find your <span className="text-primary">dream role</span>
            </h2>
            <p className="text-[15px] text-muted-foreground max-w-2xl mx-auto">
              Join us in our mission to democratize software creation. We have openings across all departments.
            </p>
          </div>
          
          <div className="space-y-6">
            {jobs.map((job) => (
              <Card 
                key={job.id} 
                className="group hover:shadow-xl transition-all duration-300 cursor-pointer hover:scale-[1.01]"
                onClick={() => handleJobClick(job)}
                data-testid={`card-job-${job.id}`}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          {getDepartmentIcon(job.department)}
                        </div>
                        <div>
                          <CardTitle className="text-xl group-hover:text-primary transition-colors">
                            {job.title}
                          </CardTitle>
                          <p className="text-[13px] text-muted-foreground">{job.team}</p>
                        </div>
                      </div>
                      <CardDescription className="text-base leading-relaxed">
                        {job.description}
                      </CardDescription>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors mt-1" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    <Badge variant="secondary" className="gap-1">
                      <MapPin className="h-3 w-3" />
                      {job.location}
                    </Badge>
                    <Badge variant="secondary" className="gap-1">
                      <Clock className="h-3 w-3" />
                      {job.type}
                    </Badge>
                    <Badge variant="secondary" className="gap-1">
                      <GraduationCap className="h-3 w-3" />
                      {job.experience}
                    </Badge>
                    {job.salary && (
                      <Badge variant="outline" className="gap-1">
                        <DollarSign className="h-3 w-3" />
                        {job.salary}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <div className="mt-16 text-center space-y-6">
            <div className="p-8 bg-gradient-to-r from-primary/10 to-purple-600/10 rounded-2xl">
              <h3 className="text-2xl font-bold mb-4">Don't see the perfect role?</h3>
              <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                We're always looking for exceptional talent. If you're passionate about our mission, 
                we'd love to hear from you.
              </p>
              <Button variant="outline" size="lg" className="gap-2" data-testid="button-careers-general-application">
                <ExternalLink className="h-4 w-4" />
                Submit general application
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to make an impact?
          </h2>
          <p className="text-[15px] mb-8 opacity-90">
            Join us in our mission to bring the next billion software creators online
          </p>
          <div className="flex gap-4 justify-center">
            <Button 
              size="lg" 
              variant="secondary"
              onClick={() => document.getElementById('open-positions')?.scrollIntoView({ behavior: 'smooth' })}
              data-testid="button-careers-cta-view-positions"
            >
              View all positions
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="bg-transparent text-primary-foreground border-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => navigate('/about')}
              data-testid="button-careers-cta-learn-about"
            >
              Learn about us
            </Button>
          </div>
        </div>
      </section>

      <PublicFooter />

      {/* Job Details Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedJob && (
            <>
              <DialogHeader>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 rounded-lg">
                      {getDepartmentIcon(selectedJob.department)}
                    </div>
                    <div>
                      <DialogTitle className="text-2xl">{selectedJob.title}</DialogTitle>
                      <p className="text-muted-foreground">{selectedJob.team} Team</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Badge variant="secondary" className="gap-1">
                      <MapPin className="h-3 w-3" />
                      {selectedJob.location}
                    </Badge>
                    <Badge variant="secondary" className="gap-1">
                      <Clock className="h-3 w-3" />
                      {selectedJob.type}
                    </Badge>
                    <Badge variant="secondary" className="gap-1">
                      <GraduationCap className="h-3 w-3" />
                      {selectedJob.experience}
                    </Badge>
                    {selectedJob.salary && (
                      <Badge variant="outline" className="gap-1 font-semibold">
                        <DollarSign className="h-3 w-3" />
                        {selectedJob.salary}
                      </Badge>
                    )}
                  </div>
                </div>
              </DialogHeader>
              
              <div className="mt-6 space-y-8">
                <div>
                  <DialogDescription className="text-base leading-relaxed text-foreground">
                    {selectedJob.description}
                  </DialogDescription>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="text-[15px] font-semibold flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    Responsibilities
                  </h3>
                  <ul className="space-y-2">
                    {selectedJob.responsibilities.map((resp, index) => (
                      <li key={index} className="flex gap-2 text-muted-foreground">
                        <span className="text-primary mt-1.5">•</span>
                        <span>{resp}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h3 className="text-[15px] font-semibold flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Requirements
                  </h3>
                  <ul className="space-y-2">
                    {selectedJob.requirements.map((req, index) => (
                      <li key={index} className="flex gap-2 text-muted-foreground">
                        <span className="text-primary mt-1.5">•</span>
                        <span>{req}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {selectedJob.niceToHave && selectedJob.niceToHave.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <h3 className="text-[15px] font-semibold flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        Nice to Have
                      </h3>
                      <ul className="space-y-2">
                        {selectedJob.niceToHave.map((nice, index) => (
                          <li key={index} className="flex gap-2 text-muted-foreground">
                            <span className="text-primary mt-1.5">•</span>
                            <span>{nice}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}

                <Separator />

                <div className="flex flex-col sm:flex-row gap-4">
                  <Button 
                    size="lg" 
                    className="flex-1 gap-2"
                    onClick={() => {
                      // In a real app, this would open an application form
                      window.open(`mailto:careers@e-code.ai?subject=Application for ${selectedJob.title}`, '_blank');
                    }}
                    data-testid="button-job-apply"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Apply for this role
                  </Button>
                  <Button 
                    size="lg" 
                    variant="outline"
                    className="flex-1"
                    onClick={() => setIsDialogOpen(false)}
                    data-testid="button-job-close"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}