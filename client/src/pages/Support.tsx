import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { 
  HelpCircle, MessageSquare, Book, Mail, 
  ChevronRight, Search, Clock, CheckCircle,
  AlertCircle, Phone, Video, Globe, Users,
  Zap, Code, Shield, CreditCard, Server,
  ChevronDown, ChevronUp, ExternalLink
} from 'lucide-react';

export default function Support() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [ticketType, setTicketType] = useState('');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketDescription, setTicketDescription] = useState('');

  const faqs = [
    {
      id: 1,
      category: 'Getting Started',
      question: 'How do I create my first Repl?',
      answer: 'To create your first Repl, click the "Create Repl" button on your dashboard. Choose a language template or start from scratch. Give your Repl a name and click "Create". Your coding environment will be ready in seconds!'
    },
    {
      id: 2,
      category: 'Billing',
      question: 'How do Cycles work?',
      answer: 'Cycles are our virtual currency used to power features like Always On, Boost, and custom domains. You can purchase Cycles or earn them through various activities. 1 Cycle = $0.01 USD.'
    },
    {
      id: 3,
      category: 'Technical',
      question: 'What languages are supported?',
      answer: 'E-Code supports over 50 programming languages including Python, JavaScript, TypeScript, Java, C++, Go, Rust, Ruby, PHP, and many more. Each language comes with pre-configured environments.'
    },
    {
      id: 4,
      category: 'Collaboration',
      question: 'How do I invite collaborators to my Repl?',
      answer: 'Open your Repl and click the "Invite" button. You can share a link or invite specific users by username or email. Collaborators can edit code in real-time with you.'
    },
    {
      id: 5,
      category: 'Deployment',
      question: 'How do I deploy my application?',
      answer: 'Click the "Deploy" button in your Repl. Choose between static hosting or dynamic deployments. Configure your domain settings and click "Deploy". Your app will be live with HTTPS enabled.'
    }
  ];

  const commonIssues = [
    {
      title: 'Repl not running',
      icon: <AlertCircle className="h-5 w-5" />,
      solutions: ['Check console for errors', 'Restart the Repl', 'Verify package installations']
    },
    {
      title: 'Cannot connect to database',
      icon: <Server className="h-5 w-5" />,
      solutions: ['Check connection string', 'Verify database is running', 'Check firewall settings']
    },
    {
      title: 'Deployment failed',
      icon: <Globe className="h-5 w-5" />,
      solutions: ['Check build logs', 'Verify environment variables', 'Ensure port configuration']
    },
    {
      title: 'Billing issues',
      icon: <CreditCard className="h-5 w-5" />,
      solutions: ['Update payment method', 'Check subscription status', 'Contact billing support']
    }
  ];

  const supportChannels = [
    {
      title: 'Documentation',
      description: 'Browse our comprehensive guides',
      icon: <Book className="h-6 w-6" />,
      action: 'View Docs',
      time: 'Available 24/7'
    },
    {
      title: 'Community Forum',
      description: 'Get help from the community',
      icon: <Users className="h-6 w-6" />,
      action: 'Visit Forum',
      time: 'Active community'
    },
    {
      title: 'Email Support',
      description: 'Get help via email',
      icon: <Mail className="h-6 w-6" />,
      action: 'Send Email',
      time: '48hr response'
    },
    {
      title: 'Priority Support',
      description: 'For Pro and Team users',
      icon: <Zap className="h-6 w-6" />,
      action: 'Get Priority',
      time: '< 4hr response'
    }
  ];

  const handleSubmitTicket = (e: React.FormEvent) => {
    e.preventDefault();
    toast({
      title: "Support ticket created",
      description: "We'll get back to you within 24-48 hours."
    });
    // Reset form
    setTicketType('');
    setTicketSubject('');
    setTicketDescription('');
  };

  const toggleFaq = (id: number) => {
    setExpandedFaq(expandedFaq === id ? null : id);
  };

  return (
    <div className="container mx-auto max-w-6xl py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <HelpCircle className="h-8 w-8 text-primary" />
          Support Center
        </h1>
        <p className="text-muted-foreground mt-2">
          Get help with your E-Code account and projects
        </p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {supportChannels.map((channel, index) => (
          <Card key={index} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                <div className="p-3 bg-primary/10 rounded-lg mb-3">
                  {channel.icon}
                </div>
                <h3 className="font-semibold mb-1">{channel.title}</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {channel.description}
                </p>
                <Badge variant="secondary" className="mb-3">
                  {channel.time}
                </Badge>
                <Button size="sm" className="w-full">
                  {channel.action}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="help" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="help">Help Articles</TabsTrigger>
          <TabsTrigger value="faqs">FAQs</TabsTrigger>
          <TabsTrigger value="contact">Contact Us</TabsTrigger>
          <TabsTrigger value="status">System Status</TabsTrigger>
        </TabsList>

        {/* Help Articles Tab */}
        <TabsContent value="help" className="space-y-4">
          {/* Search */}
          <Card>
            <CardContent className="pt-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search help articles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardContent>
          </Card>

          {/* Common Issues */}
          <Card>
            <CardHeader>
              <CardTitle>Common Issues & Solutions</CardTitle>
              <CardDescription>
                Quick solutions to frequently encountered problems
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                {commonIssues.map((issue, index) => (
                  <Card key={index}>
                    <CardContent className="pt-6">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-orange-100 text-orange-600 rounded">
                          {issue.icon}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold mb-2">{issue.title}</h4>
                          <ul className="space-y-1">
                            {issue.solutions.map((solution, idx) => (
                              <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                                <CheckCircle className="h-3 w-3 text-green-500 mt-0.5" />
                                <span>{solution}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Help Categories */}
          <Card>
            <CardHeader>
              <CardTitle>Browse by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-3">
                {[
                  { name: 'Getting Started', icon: <Zap />, count: 24 },
                  { name: 'Account & Billing', icon: <CreditCard />, count: 18 },
                  { name: 'Languages & Frameworks', icon: <Code />, count: 45 },
                  { name: 'Deployment & Hosting', icon: <Globe />, count: 22 },
                  { name: 'Collaboration', icon: <Users />, count: 15 },
                  { name: 'Security & Privacy', icon: <Shield />, count: 12 }
                ].map((category, index) => (
                  <Button key={index} variant="outline" className="justify-start">
                    {category.icon}
                    <span className="ml-2 flex-1 text-left">{category.name}</span>
                    <Badge variant="secondary">{category.count}</Badge>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* FAQs Tab */}
        <TabsContent value="faqs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Frequently Asked Questions</CardTitle>
              <CardDescription>
                Find answers to common questions about E-Code
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {faqs.map((faq) => (
                <div key={faq.id} className="border rounded-lg">
                  <button
                    className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-muted/50 transition-colors"
                    onClick={() => toggleFaq(faq.id)}
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">{faq.category}</Badge>
                      <span className="font-medium">{faq.question}</span>
                    </div>
                    {expandedFaq === faq.id ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>
                  {expandedFaq === faq.id && (
                    <div className="px-4 pb-3">
                      <p className="text-sm text-muted-foreground">{faq.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contact Tab */}
        <TabsContent value="contact" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Create Support Ticket</CardTitle>
              <CardDescription>
                Can't find what you're looking for? Submit a support request
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmitTicket} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ticket-type">Issue Type</Label>
                  <select
                    id="ticket-type"
                    className="w-full px-3 py-2 text-sm rounded-md border bg-background"
                    value={ticketType}
                    onChange={(e) => setTicketType(e.target.value)}
                    required
                  >
                    <option value="">Select issue type</option>
                    <option value="technical">Technical Issue</option>
                    <option value="billing">Billing & Subscription</option>
                    <option value="account">Account Management</option>
                    <option value="feature">Feature Request</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    value={ticketSubject}
                    onChange={(e) => setTicketSubject(e.target.value)}
                    placeholder="Brief description of your issue"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <textarea
                    id="description"
                    className="w-full min-h-[150px] px-3 py-2 text-sm rounded-md border bg-background"
                    value={ticketDescription}
                    onChange={(e) => setTicketDescription(e.target.value)}
                    placeholder="Please provide as much detail as possible..."
                    required
                  />
                </div>

                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-2">Before submitting:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Check our FAQ section for quick answers</li>
                    <li>• Search our documentation for guides</li>
                    <li>• Include error messages or screenshots if applicable</li>
                  </ul>
                </div>

                <Button type="submit" className="w-full">
                  Submit Support Ticket
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Other Ways to Get Help</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-5 w-5" />
                  <div>
                    <p className="font-medium">Community Discord</p>
                    <p className="text-sm text-muted-foreground">Join 50k+ developers</p>
                  </div>
                </div>
                <Button size="sm" variant="outline">
                  Join
                  <ExternalLink className="ml-1 h-3 w-3" />
                </Button>
              </div>
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Video className="h-5 w-5" />
                  <div>
                    <p className="font-medium">Video Tutorials</p>
                    <p className="text-sm text-muted-foreground">Learn with video guides</p>
                  </div>
                </div>
                <Button size="sm" variant="outline">
                  Watch
                  <ExternalLink className="ml-1 h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* System Status Tab */}
        <TabsContent value="status" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Status</CardTitle>
              <CardDescription>
                Current status of E-Code services
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
                <div>
                  <p className="font-semibold text-green-800">All Systems Operational</p>
                  <p className="text-sm text-green-700">Last updated 2 minutes ago</p>
                </div>
              </div>

              <div className="space-y-3">
                {[
                  { service: 'Website', status: 'operational', uptime: 99.99 },
                  { service: 'API', status: 'operational', uptime: 99.95 },
                  { service: 'Code Execution', status: 'operational', uptime: 99.90 },
                  { service: 'Deployments', status: 'operational', uptime: 99.97 },
                  { service: 'Database', status: 'operational', uptime: 99.98 },
                  { service: 'Real-time Collaboration', status: 'operational', uptime: 99.92 }
                ].map((service, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="font-medium">{service.service}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">{service.uptime}% uptime</Badge>
                      <Badge className="bg-green-100 text-green-800">
                        Operational
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Recent Incidents</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Jan 28 - Database maintenance completed</p>
                      <p className="text-muted-foreground">
                        Scheduled maintenance was completed successfully with no issues.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">Jan 25 - API latency resolved</p>
                      <p className="text-muted-foreground">
                        Brief API latency issues were identified and resolved.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}