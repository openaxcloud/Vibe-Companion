import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Newspaper, Download, Mail, Calendar } from 'lucide-react';

export default function Press() {
  const pressReleases = [
    {
      date: '2024-11-15',
      title: 'E-Code Announces $100M Series C Funding Round',
      description: 'Leading online IDE platform secures funding to accelerate AI development',
      link: '#',
    },
    {
      date: '2024-09-22',
      title: 'E-Code Launches AI Code Assistant for All Users',
      description: 'Revolutionary AI features now available to millions of developers',
      link: '#',
    },
    {
      date: '2024-07-10',
      title: 'E-Code Partners with Major Universities for CS Education',
      description: 'Bringing cloud-based coding to classrooms worldwide',
      link: '#',
    },
    {
      date: '2024-05-03',
      title: 'E-Code Mobile App Reaches 1 Million Downloads',
      description: 'Mobile coding revolution continues with milestone achievement',
      link: '#',
    },
  ];

  const mediaKit = [
    { name: 'Logo Pack', format: 'ZIP', size: '2.4 MB' },
    { name: 'Brand Guidelines', format: 'PDF', size: '1.8 MB' },
    { name: 'Executive Photos', format: 'ZIP', size: '5.2 MB' },
    { name: 'Product Screenshots', format: 'ZIP', size: '8.7 MB' },
  ];

  const coverage = [
    { outlet: 'TechCrunch', logo: '📰' },
    { outlet: 'The Verge', logo: '📱' },
    { outlet: 'Wired', logo: '🔌' },
    { outlet: 'Forbes', logo: '💼' },
    { outlet: 'VentureBeat', logo: '🚀' },
    { outlet: 'MIT Technology Review', logo: '🎓' },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <PublicNavbar />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-responsive bg-muted">
          <div className="container-responsive">
            <div className="text-center max-w-3xl mx-auto">
              <Newspaper className="h-12 w-12 mx-auto mb-4 text-primary" />
              <h1 className="text-4xl font-bold mb-4">Press & Media</h1>
              <p className="text-lg text-muted-foreground">
                Get the latest news, press releases, and media resources about E-Code
              </p>
            </div>
          </div>
        </section>

        {/* Press Releases */}
        <section className="py-responsive">
          <div className="container-responsive">
            <h2 className="text-3xl font-bold mb-8">Latest Press Releases</h2>
            
            <div className="space-y-4">
              {pressReleases.map((release, index) => (
                <Card key={index}>
                  <CardContent className="flex items-start justify-between p-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-2">
                        <Badge variant="secondary">
                          <Calendar className="h-3 w-3 mr-1" />
                          {new Date(release.date).toLocaleDateString()}
                        </Badge>
                      </div>
                      <h3 className="text-xl font-semibold mb-2">{release.title}</h3>
                      <p className="text-muted-foreground">{release.description}</p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => window.location.href = '/blog'}
                    >
                      Read More
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="mt-8 text-center">
              <Button 
                variant="outline"
                onClick={() => window.location.href = '/blog'}
              >
                View All Press Releases
              </Button>
            </div>
          </div>
        </section>

        {/* Media Kit */}
        <section className="py-responsive bg-muted">
          <div className="container-responsive">
            <h2 className="text-3xl font-bold mb-8">Media Kit</h2>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {mediaKit.map((item) => (
                <Card key={item.name}>
                  <CardContent className="p-6 text-center">
                    <Download className="h-8 w-8 mx-auto mb-4 text-primary" />
                    <h3 className="font-semibold mb-1">{item.name}</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      {item.format} • {item.size}
                    </p>
                    <Button size="sm" className="w-full">
                      Download
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Media Coverage */}
        <section className="py-responsive">
          <div className="container-responsive">
            <h2 className="text-3xl font-bold mb-8 text-center">As Seen In</h2>
            
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8">
              {coverage.map((outlet) => (
                <div key={outlet.outlet} className="text-center">
                  <div className="text-4xl mb-2">{outlet.logo}</div>
                  <p className="text-sm font-medium">{outlet.outlet}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Contact Section */}
        <section className="py-responsive bg-primary text-primary-foreground">
          <div className="container-responsive text-center">
            <Mail className="h-12 w-12 mx-auto mb-4" />
            <h2 className="text-3xl font-bold mb-4">Press Inquiries</h2>
            <p className="text-lg mb-8 opacity-90 max-w-2xl mx-auto">
              For press inquiries, interview requests, or additional information, 
              please contact our media relations team.
            </p>
            <div className="space-y-4">
              <div>
                <p className="font-semibold">Email</p>
                <p>press@replit.com</p>
              </div>
              <div>
                <p className="font-semibold">Phone</p>
                <p>+1 (415) 555-0123</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}