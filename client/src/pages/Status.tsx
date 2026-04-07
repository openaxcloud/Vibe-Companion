import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, XCircle, Clock } from 'lucide-react';

export default function Status() {
  const services = [
    { name: 'Website', status: 'operational', uptime: '99.99%' },
    { name: 'API', status: 'operational', uptime: '99.98%' },
    { name: 'Code Execution', status: 'operational', uptime: '99.95%' },
    { name: 'Database', status: 'operational', uptime: '99.99%' },
    { name: 'Authentication', status: 'operational', uptime: '100%' },
    { name: 'File Storage', status: 'operational', uptime: '99.97%' },
    { name: 'Deployments', status: 'operational', uptime: '99.96%' },
    { name: 'Real-time Collaboration', status: 'operational', uptime: '99.94%' },
  ];

  const incidents = [
    {
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      title: 'Resolved: Brief API latency',
      status: 'resolved',
      duration: '15 minutes',
      description: 'Some users experienced increased API response times.',
    },
    {
      date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      title: 'Resolved: Deployment service interruption',
      status: 'resolved',
      duration: '30 minutes',
      description: 'Deployment service was temporarily unavailable for some regions.',
    },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'degraded':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'outage':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'operational':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Operational</Badge>;
      case 'degraded':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Degraded</Badge>;
      case 'outage':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Outage</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <PublicNavbar />
      
      <main className="flex-1">
        <div className="container-responsive py-responsive">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold mb-4">System Status</h1>
              <p className="text-lg text-muted-foreground">
                Current status and incident history for all E-Code services
              </p>
            </div>

            {/* Overall Status */}
            <Card className="mb-8">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl">All Systems Operational</CardTitle>
                    <CardDescription>
                      Last updated: {new Date().toLocaleTimeString()}
                    </CardDescription>
                  </div>
                  <CheckCircle className="h-12 w-12 text-green-500" />
                </div>
              </CardHeader>
            </Card>

            {/* Services Grid */}
            <div className="grid gap-4 mb-12">
              <h2 className="text-2xl font-semibold mb-4">Service Status</h2>
              {services.map((service) => (
                <Card key={service.name}>
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(service.status)}
                      <div>
                        <p className="font-medium">{service.name}</p>
                        <p className="text-sm text-muted-foreground">Uptime: {service.uptime}</p>
                      </div>
                    </div>
                    {getStatusBadge(service.status)}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Incident History */}
            <div>
              <h2 className="text-2xl font-semibold mb-4">Incident History</h2>
              <div className="space-y-4">
                {incidents.map((incident, index) => (
                  <Card key={index}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{incident.title}</CardTitle>
                          <CardDescription>{incident.date} • Duration: {incident.duration}</CardDescription>
                        </div>
                        <Badge variant={incident.status === 'resolved' ? 'default' : 'destructive'}>
                          {incident.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{incident.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Subscribe Section */}
            <Card className="mt-12">
              <CardHeader>
                <CardTitle>Subscribe to Updates</CardTitle>
                <CardDescription>
                  Get notified about system status changes and planned maintenance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <input
                    type="email"
                    placeholder="Enter your email"
                    className="flex-1 px-4 py-2 border rounded-md"
                  />
                  <button className="px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
                    Subscribe
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}