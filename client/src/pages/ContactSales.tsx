import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import {
  Code, Building2, Users, Mail, Globe, MessageSquare,
  ChevronRight, Check, Calendar, Clock, Shield, Sparkles, ArrowRight
} from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { apiRequest } from '@/lib/queryClient';

export default function ContactSales() {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    company: '',
    companySize: '',
    phone: '',
    message: '',
    interest: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const pagePath = typeof window !== 'undefined' ? window.location.pathname : '/contact-sales';
      const subject = formData.interest
        ? `Enterprise inquiry - ${formData.interest}`
        : 'Enterprise inquiry';

      await apiRequest('POST', '/api/contact/sales', {
        name: `${formData.firstName} ${formData.lastName}`.trim(),
        email: formData.email,
        company: formData.company,
        phone: formData.phone,
        message: formData.message,
        companySize: formData.companySize,
        useCase: formData.interest,
        subject,
        pagePath,
      });
      
      toast({
        title: "Thank you for your interest!",
        description: "Our sales team will contact you within 24 hours.",
      });
        
        // Reset form
        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          company: '',
          companySize: '',
          phone: '',
          message: '',
          interest: ''
        });
        
        // Navigate to home after success
        setTimeout(() => navigate('/'), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to connect to server. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const benefits = [
    {
      icon: <Users className="h-5 w-5" />,
      title: 'Dedicated Support',
      description: 'Get a dedicated success manager and priority support'
    },
    {
      icon: <Shield className="h-5 w-5" />,
      title: 'Enterprise Security',
      description: 'SOC2, HIPAA compliance, SSO, and custom security requirements'
    },
    {
      icon: <Globe className="h-5 w-5" />,
      title: 'Global Scale',
      description: 'Deploy across multiple regions with guaranteed uptime'
    },
    {
      icon: <Building2 className="h-5 w-5" />,
      title: 'Custom Solutions',
      description: 'Tailored features and integrations for your organization'
    }
  ];

  const features = [
    'Unlimited private projects and collaborators',
    'Advanced AI agent capabilities and priority access',
    'Custom deployment configurations',
    'Dedicated infrastructure and resources',
    'SLA guarantees and 24/7 support',
    'Custom training for your team',
    'API access and webhook integrations',
    'White-label options available'
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <PublicNavbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-12 sm:py-16 md:py-20 bg-gradient-to-b from-background to-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-4xl mx-auto">
              <Badge variant="secondary" className="mb-4 sm:mb-6">
                <Building2 className="h-3 w-3 mr-1" />
                Enterprise Sales
              </Badge>
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                Empower your entire organization
              </h1>
              <p className="text-base sm:text-[15px] md:text-xl text-muted-foreground mb-6 sm:mb-8 px-4 sm:px-0">
                Transform how your teams build, deploy, and collaborate with E-Code Enterprise. 
                Get dedicated support, enhanced security, and custom solutions tailored to your needs.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4 sm:px-0">
                <Button 
                  size="lg" 
                  className="min-h-[44px]"
                  onClick={() => document.getElementById('contact-form')?.scrollIntoView({ behavior: 'smooth' })}
                  data-testid="button-contact-sales-cta"
                >
                  Contact Sales
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="min-h-[44px]"
                  onClick={() => navigate('/pricing')}
                  data-testid="button-view-pricing"
                >
                  View Pricing
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-12 sm:py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12">Enterprise Features</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {benefits.map((benefit, index) => (
                  <Card key={index} className="border-none shadow-sm" data-testid={`card-benefit-${index}`}>
                    <CardContent className="pt-4 sm:pt-6 p-4 sm:p-6">
                      <div className="p-2 sm:p-3 bg-primary/10 rounded-lg w-fit mb-3 sm:mb-4">
                        {benefit.icon}
                      </div>
                      <h3 className="font-semibold mb-2 text-[13px] sm:text-base">{benefit.title}</h3>
                      <p className="text-[11px] sm:text-[13px] text-muted-foreground">{benefit.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="mt-8 sm:mt-12 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 max-w-4xl mx-auto">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-2 sm:gap-3">
                    <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 flex-shrink-0" />
                    <span className="text-[11px] sm:text-[13px]">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Contact Form Section */}
        <section className="py-12 sm:py-16" id="contact-form">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 sm:gap-12">
                {/* Contact Form */}
                <div className="lg:col-span-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Contact Our Sales Team</CardTitle>
                      <CardDescription>
                        Fill out the form below and we'll get back to you within 24 hours
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firstName">First Name *</Label>
                        <Input
                          id="firstName"
                          className="min-h-[44px]"
                          value={formData.firstName}
                          onChange={(e) => handleChange('firstName', e.target.value)}
                          required
                          data-testid="input-first-name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="lastName">Last Name *</Label>
                        <Input
                          id="lastName"
                          className="min-h-[44px]"
                          value={formData.lastName}
                          onChange={(e) => handleChange('lastName', e.target.value)}
                          required
                          data-testid="input-last-name"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Work Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        className="min-h-[44px]"
                        value={formData.email}
                        onChange={(e) => handleChange('email', e.target.value)}
                        required
                        data-testid="input-work-email"
                      />
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="company">Company *</Label>
                        <Input
                          id="company"
                          className="min-h-[44px]"
                          value={formData.company}
                          onChange={(e) => handleChange('company', e.target.value)}
                          required
                          data-testid="input-company"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="companySize">Company Size *</Label>
                        <Select
                          value={formData.companySize}
                          onValueChange={(value) => handleChange('companySize', value)}
                        >
                          <SelectTrigger id="companySize" className="min-h-[44px]" data-testid="select-company-size">
                            <SelectValue placeholder="Select size" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1-10" data-testid="option-size-1-10">1-10 employees</SelectItem>
                            <SelectItem value="11-50" data-testid="option-size-11-50">11-50 employees</SelectItem>
                            <SelectItem value="51-200" data-testid="option-size-51-200">51-200 employees</SelectItem>
                            <SelectItem value="201-500" data-testid="option-size-201-500">201-500 employees</SelectItem>
                            <SelectItem value="501-1000" data-testid="option-size-501-1000">501-1000 employees</SelectItem>
                            <SelectItem value="1000+" data-testid="option-size-1000+">1000+ employees</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        type="tel"
                        className="min-h-[44px]"
                        value={formData.phone}
                        onChange={(e) => handleChange('phone', e.target.value)}
                        data-testid="input-phone"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="interest">What are you interested in? *</Label>
                      <Select
                        value={formData.interest}
                        onValueChange={(value) => handleChange('interest', value)}
                      >
                        <SelectTrigger id="interest" className="min-h-[44px]" data-testid="select-interest">
                          <SelectValue placeholder="Select your interest" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="enterprise" data-testid="option-interest-enterprise">Enterprise Plan</SelectItem>
                          <SelectItem value="education" data-testid="option-interest-education">Education License</SelectItem>
                          <SelectItem value="teams" data-testid="option-interest-teams">Teams Plan</SelectItem>
                          <SelectItem value="custom" data-testid="option-interest-custom">Custom Solution</SelectItem>
                          <SelectItem value="demo" data-testid="option-interest-demo">Product Demo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="message">Tell us more about your needs</Label>
                      <Textarea
                        id="message"
                        rows={4}
                        className="min-h-[88px]"
                        value={formData.message}
                        onChange={(e) => handleChange('message', e.target.value)}
                        placeholder="What challenges are you looking to solve? How many developers will be using E-Code?"
                        data-testid="textarea-message"
                      />
                    </div>

                    <Button 
                      type="submit" 
                      size="lg" 
                      className="w-full min-h-[44px]" 
                      disabled={isSubmitting}
                      data-testid="button-submit-sales-request"
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit Request'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-[15px]">Why Choose Enterprise?</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {benefits.map((benefit, index) => (
                    <div key={index} className="flex gap-3">
                      <div className="p-2 bg-primary/10 rounded h-fit">
                        {benefit.icon}
                      </div>
                      <div>
                        <h3 className="font-semibold">{benefit.title}</h3>
                        <p className="text-[13px] text-muted-foreground">{benefit.description}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-[15px]">Talk to Sales</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <span className="text-[13px]">enterprise@e-code.ai</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <span className="text-[13px]">Mon-Fri, 9AM-6PM PST</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-primary text-primary-foreground">
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-2">Ready to get started?</h3>
                  <p className="text-[13px] mb-4 opacity-90">
                    Our team is standing by to help you succeed.
                  </p>
                  <Button variant="secondary" className="w-full min-h-[44px]" data-testid="button-schedule-demo">
                    Schedule a Demo
                    <Calendar className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}