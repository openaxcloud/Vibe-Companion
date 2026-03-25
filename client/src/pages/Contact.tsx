import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Mail, MessageCircle, Phone, MapPin,
  Send, Loader2, CheckCircle, Building2,
  HelpCircle, Users, Briefcase
} from "lucide-react";
import { Link } from "wouter";
import PublicLayout from "@/components/layout/PublicLayout";
import { SEOHead, structuredData } from "@/components/seo/SEOHead";
import { getSEOConfig } from "@/config/seo.config";
import { useToast } from "@/hooks/use-toast";

const seo = getSEOConfig('contact');

const contactReasons = [
  { value: "general", label: "General Inquiry" },
  { value: "sales", label: "Sales & Pricing" },
  { value: "support", label: "Technical Support" },
  { value: "partnership", label: "Partnership Opportunity" },
  { value: "press", label: "Press & Media" },
  { value: "careers", label: "Careers" }
];

const offices = [
  {
    city: "San Francisco",
    address: "100 Innovation Drive, Suite 500",
    region: "San Francisco, CA 94105",
    country: "United States",
    type: "Headquarters"
  },
  {
    city: "London",
    address: "30 Finsbury Square",
    region: "London, EC2A 1AG",
    country: "United Kingdom",
    type: "EMEA Office"
  },
  {
    city: "Singapore",
    address: "1 Raffles Place, Tower 2",
    region: "Singapore 048616",
    country: "Singapore",
    type: "APAC Office"
  }
];

export default function Contact() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    reason: "",
    message: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await apiRequest('POST', '/api/contact', formData);

      setIsSubmitted(true);
      toast({
        title: "Message Sent",
        description: "We'll get back to you within 24 hours.",
        variant: "default"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PublicLayout>
      <SEOHead
        {...seo}
        structuredData={structuredData.localBusiness()}
      />

      <div className="container mx-auto px-4 py-12 sm:py-16 md:py-10">
        <div className="text-center max-w-4xl mx-auto mb-12 sm:mb-16">
          <Badge className="mb-4 px-4 py-1.5 text-[13px] font-medium bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-0">
            Contact Us
          </Badge>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent" data-testid="text-contact-title">
            Get in Touch
          </h1>
          <p className="text-[15px] sm:text-xl text-muted-foreground max-w-3xl mx-auto" data-testid="text-contact-subtitle">
            Have a question, want a demo, or ready to get started? We'd love to hear from you.
          </p>
        </div>

        <div className="grid sm:grid-cols-1 md:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-16 max-w-4xl mx-auto">
          <Link href="/contact-sales" data-testid="link-contact-sales">
            <Card className="p-6 hover:shadow-lg transition-all duration-300 cursor-pointer group text-center" data-testid="card-contact-sales">
              <Building2 className="h-8 w-8 mx-auto mb-3 text-blue-600 group-hover:scale-110 transition-transform" />
              <h3 className="font-semibold mb-1">Sales</h3>
              <p className="text-[13px] text-muted-foreground">Enterprise pricing & demos</p>
            </Card>
          </Link>
          <Link href="/help-center" data-testid="link-contact-support">
            <Card className="p-6 hover:shadow-lg transition-all duration-300 cursor-pointer group text-center" data-testid="card-contact-support">
              <HelpCircle className="h-8 w-8 mx-auto mb-3 text-purple-600 group-hover:scale-110 transition-transform" />
              <h3 className="font-semibold mb-1">Support</h3>
              <p className="text-[13px] text-muted-foreground">Help center & documentation</p>
            </Card>
          </Link>
          <Link href="/partners" data-testid="link-contact-partners">
            <Card className="p-6 hover:shadow-lg transition-all duration-300 cursor-pointer group text-center" data-testid="card-contact-partners">
              <Users className="h-8 w-8 mx-auto mb-3 text-green-600 group-hover:scale-110 transition-transform" />
              <h3 className="font-semibold mb-1">Partnerships</h3>
              <p className="text-[13px] text-muted-foreground">Become a partner</p>
            </Card>
          </Link>
        </div>

        <div className="grid lg:grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl mx-auto">
          <div>
            <h2 className="text-2xl font-bold mb-6">Send us a message</h2>

            {isSubmitted ? (
              <Card className="p-12 text-center" data-testid="card-contact-success">
                <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-6" />
                <h3 className="text-2xl font-bold mb-2">Message Sent!</h3>
                <p className="text-muted-foreground mb-6">
                  Thank you for reaching out. We'll get back to you within 24 hours.
                </p>
                <Button variant="outline" onClick={() => setIsSubmitted(false)} data-testid="button-send-another">
                  Send Another Message
                </Button>
              </Card>
            ) : (
              <Card className="p-6 md:p-8">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid sm:grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name *</Label>
                      <Input
                        id="name"
                        required
                        placeholder="John Doe"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        data-testid="input-contact-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        placeholder="john@company.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        data-testid="input-contact-email"
                      />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="company">Company</Label>
                      <Input
                        id="company"
                        placeholder="Company name"
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        data-testid="input-contact-company"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reason">Reason *</Label>
                      <Select
                        value={formData.reason}
                        onValueChange={(value) => setFormData({ ...formData, reason: value })}
                      >
                        <SelectTrigger data-testid="select-contact-reason">
                          <SelectValue placeholder="Select a reason" />
                        </SelectTrigger>
                        <SelectContent>
                          {contactReasons.map((reason) => (
                            <SelectItem key={reason.value} value={reason.value} data-testid={`select-option-${reason.value}`}>
                              {reason.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">Message *</Label>
                    <Textarea
                      id="message"
                      required
                      placeholder="How can we help you?"
                      rows={5}
                      value={formData.message}
                      onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                      data-testid="textarea-contact-message"
                    />
                  </div>

                  <Button
                    type="submit"
                    size="lg"
                    className="w-full gap-2"
                    disabled={isSubmitting}
                    data-testid="button-contact-submit"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-5 w-5" />
                        Send Message
                      </>
                    )}
                  </Button>
                </form>
              </Card>
            )}
          </div>

          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold mb-6">Other ways to reach us</h2>
              <div className="space-y-4">
                <Card className="p-4 flex items-center gap-4">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                    <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <div className="font-semibold">Email</div>
                    <a href="mailto:hello@e-code.ai" className="text-muted-foreground hover:text-primary">
                      hello@e-code.ai
                    </a>
                  </div>
                </Card>
                <Card className="p-4 flex items-center gap-4">
                  <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                    <MessageCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <div className="font-semibold">Live Chat</div>
                    <p className="text-muted-foreground">Available Mon-Fri, 9am-6pm PT</p>
                  </div>
                </Card>
                <Card className="p-4 flex items-center gap-4">
                  <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <Phone className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <div className="font-semibold">Phone (Enterprise)</div>
                    <a href="tel:+1-800-ECODE" className="text-muted-foreground hover:text-primary">
                      +1-800-ECODE
                    </a>
                  </div>
                </Card>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold mb-6">Our Offices</h2>
              <div className="space-y-4">
                {offices.map((office) => (
                  <Card key={office.city} className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                        <MapPin className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold">{office.city}</span>
                          <Badge variant="outline" className="text-[11px]">{office.type}</Badge>
                        </div>
                        <p className="text-[13px] text-muted-foreground">
                          {office.address}<br />
                          {office.region}<br />
                          {office.country}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
