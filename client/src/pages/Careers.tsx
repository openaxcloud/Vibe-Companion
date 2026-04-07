import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { 
  Code, Users, Globe, Rocket, Heart, Coffee, Gift, Home,
  ChevronRight, ArrowRight, MapPin, Clock, DollarSign,
  Briefcase, GraduationCap, Sparkles
} from 'lucide-react';

interface Job {
  id: string;
  title: string;
  department: string;
  location: string;
  type: string;
  experience: string;
  description: string;
}

export default function Careers() {
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const benefits = [
    {
      icon: <DollarSign className="h-6 w-6" />,
      title: 'Competitive Compensation',
      description: 'Top-tier salaries and equity packages'
    },
    {
      icon: <Heart className="h-6 w-6" />,
      title: 'Health & Wellness',
      description: '100% covered health, dental, and vision insurance'
    },
    {
      icon: <Home className="h-6 w-6" />,
      title: 'Remote First',
      description: 'Work from anywhere in the world'
    },
    {
      icon: <Coffee className="h-6 w-6" />,
      title: 'Unlimited PTO',
      description: 'Take the time you need to recharge'
    },
    {
      icon: <GraduationCap className="h-6 w-6" />,
      title: 'Learning Budget',
      description: '$2,000 annual budget for courses and conferences'
    },
    {
      icon: <Gift className="h-6 w-6" />,
      title: 'Equipment',
      description: 'Top-of-the-line equipment of your choice'
    }
  ];

  const jobs: Job[] = [
    {
      id: '1',
      title: 'Senior Frontend Engineer',
      department: 'Engineering',
      location: 'Remote',
      type: 'Full-time',
      experience: '5+ years',
      description: 'Build the future of browser-based development with React and TypeScript'
    },
    {
      id: '2',
      title: 'Backend Engineer',
      department: 'Engineering',
      location: 'Remote',
      type: 'Full-time',
      experience: '3+ years',
      description: 'Scale our infrastructure to support millions of developers'
    },
    {
      id: '3',
      title: 'Product Designer',
      department: 'Design',
      location: 'Remote',
      type: 'Full-time',
      experience: '4+ years',
      description: 'Design intuitive experiences for developers worldwide'
    },
    {
      id: '4',
      title: 'Developer Advocate',
      department: 'Marketing',
      location: 'Remote',
      type: 'Full-time',
      experience: '3+ years',
      description: 'Build and nurture our developer community'
    },
    {
      id: '5',
      title: 'Site Reliability Engineer',
      department: 'Engineering',
      location: 'Remote',
      type: 'Full-time',
      experience: '5+ years',
      description: 'Ensure our platform runs smoothly 24/7'
    },
    {
      id: '6',
      title: 'Product Manager',
      department: 'Product',
      location: 'Remote',
      type: 'Full-time',
      experience: '4+ years',
      description: 'Define and ship features that developers love'
    }
  ];

  const values = [
    {
      title: 'Move Fast',
      description: 'We ship quickly and iterate based on feedback'
    },
    {
      title: 'Be Curious',
      description: 'We constantly learn and explore new ideas'
    },
    {
      title: 'Think Big',
      description: 'We aim to impact billions of people'
    },
    {
      title: 'Stay Humble',
      description: 'We listen, learn, and grow together'
    }
  ];

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <div 
                className="flex items-center gap-2 cursor-pointer"
                onClick={() => navigate('/')}
              >
                <Code className="h-6 w-6" />
                <span className="font-bold text-xl">E-Code</span>
              </div>
              <div className="hidden md:flex items-center gap-6">
                <Button variant="ghost" size="sm" onClick={() => navigate('/about')}>
                  About
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate('/careers')}>
                  Careers
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate('/blog')}>
                  Blog
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate('/auth')}>
                Log in
              </Button>
              <Button onClick={() => navigate(user ? '/dashboard' : '/auth')}>
                {user ? 'Dashboard' : 'Sign up'}
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 px-4 bg-gradient-to-b from-primary/5 to-transparent">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-6">
            <Badge variant="secondary" className="mb-4">
              <Sparkles className="h-3 w-3 mr-1" />
              We're hiring!
            </Badge>
            <h1 className="text-4xl md:text-5xl font-bold">
              Join us in making coding{' '}
              <span className="text-primary">accessible to everyone</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Help us build the future of software development. 
              We're looking for passionate people who want to make a difference.
            </p>
            <Button size="lg" onClick={() => document.getElementById('open-positions')?.scrollIntoView({ behavior: 'smooth' })}>
              View open positions
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Culture Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <Badge variant="outline" className="mb-4">
                <Users className="h-3 w-3 mr-1" />
                Our Culture
              </Badge>
              <h2 className="text-3xl font-bold mb-4">
                A place where you can do your best work
              </h2>
              <p className="text-lg text-muted-foreground mb-6">
                We're building a company where talented people can do their best work. 
                Our culture is built on trust, autonomy, and a shared mission to make 
                programming more accessible.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {values.map((value, index) => (
                  <div key={index}>
                    <h3 className="font-semibold mb-1">{value.title}</h3>
                    <p className="text-sm text-muted-foreground">{value.description}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-purple-600/20 blur-3xl" />
              <Card className="relative">
                <CardHeader>
                  <CardTitle>Life at E-Code</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <Globe className="h-5 w-5 text-primary" />
                      <span>Team members in 25+ countries</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-primary" />
                      <span>150+ talented individuals</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Rocket className="h-5 w-5 text-primary" />
                      <span>Shipping features daily</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Heart className="h-5 w-5 text-primary" />
                      <span>4.8/5 employee satisfaction</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Benefits & Perks</h2>
            <p className="text-lg text-muted-foreground">
              We take care of our team so they can take care of our users
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((benefit, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="p-2 bg-primary/10 rounded-lg w-fit mb-2">
                    {benefit.icon}
                  </div>
                  <CardTitle className="text-lg">{benefit.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{benefit.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Open Positions */}
      <section id="open-positions" className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Open Positions</h2>
            <p className="text-lg text-muted-foreground">
              Find your next role and help us build the future
            </p>
          </div>
          <div className="space-y-4">
            {jobs.map((job) => (
              <Card key={job.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{job.title}</CardTitle>
                      <CardDescription className="mt-2">
                        {job.description}
                      </CardDescription>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Briefcase className="h-4 w-4 text-muted-foreground" />
                      <span>{job.department}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{job.location}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>{job.type}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <GraduationCap className="h-4 w-4 text-muted-foreground" />
                      <span>{job.experience}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="text-center mt-8">
            <p className="text-muted-foreground mb-4">
              Don't see a perfect fit? We're always looking for talented people.
            </p>
            <Button variant="outline">
              Send us your resume
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to make an impact?
          </h2>
          <p className="text-lg mb-8 opacity-90">
            Join us in our mission to bring the next billion software creators online
          </p>
          <div className="flex gap-4 justify-center">
            <Button 
              size="lg" 
              variant="secondary"
              onClick={() => document.getElementById('open-positions')?.scrollIntoView({ behavior: 'smooth' })}
            >
              View all positions
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              className="bg-transparent text-primary-foreground border-primary-foreground hover:bg-primary-foreground/10"
              onClick={() => navigate('/about')}
            >
              Learn about us
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          <p>&copy; 2024 E-Code Clone. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}