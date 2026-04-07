import { useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { PageShell, PageHeader } from '@/components/layout/PageShell';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Users,
  Plus,
  Upload,
  Globe,
  Lock,
  Crown,
  Zap,
  Building2,
  Mail,
  X,
  Check,
  CreditCard,
  Shield,
  ArrowLeft,
  ArrowRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  UserPlus,
  Sparkles,
  Rocket,
  Star,
  HelpCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface TeamFormData {
  name: string;
  description: string;
  avatarUrl: string;
  plan: 'free' | 'pro' | 'enterprise';
  visibility: 'public' | 'private';
  inviteEmails: string[];
  acceptTerms: boolean;
}

interface BillingInfo {
  cardNumber: string;
  expiryDate: string;
  cvv: string;
  cardholderName: string;
  billingAddress: string;
  city: string;
  postalCode: string;
  country: string;
}

interface PlanFeature {
  name: string;
  free: boolean | string;
  pro: boolean | string;
  enterprise: boolean | string;
}

interface TeamPlan {
  id: 'free' | 'pro' | 'enterprise';
  name: string;
  price: string;
  period: string;
  description: string;
  icon: typeof Crown;
  popular?: boolean;
  features: string[];
}

const TEAM_PLANS: TeamPlan[] = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: '/month',
    description: 'Perfect for small teams getting started',
    icon: Users,
    features: [
      'Up to 5 team members',
      '3 active projects',
      'Basic collaboration',
      'Community support',
      '1GB storage',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$15',
    period: '/user/month',
    description: 'For growing teams with advanced needs',
    icon: Zap,
    popular: true,
    features: [
      'Unlimited team members',
      'Unlimited projects',
      'Real-time collaboration',
      'Priority support',
      '100GB storage',
      'Advanced analytics',
      'Custom domains',
      'Team roles & permissions',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For large organizations with custom needs',
    icon: Building2,
    features: [
      'Everything in Pro',
      'SSO/SAML authentication',
      'Dedicated account manager',
      'Custom SLA',
      'Unlimited storage',
      'Advanced security',
      'Audit logs',
      'On-premise deployment',
      'Custom integrations',
    ],
  },
];

const PLAN_FEATURES: PlanFeature[] = [
  { name: 'Team members', free: 'Up to 5', pro: 'Unlimited', enterprise: 'Unlimited' },
  { name: 'Projects', free: '3', pro: 'Unlimited', enterprise: 'Unlimited' },
  { name: 'Storage', free: '1GB', pro: '100GB', enterprise: 'Unlimited' },
  { name: 'Real-time collaboration', free: false, pro: true, enterprise: true },
  { name: 'Team analytics', free: false, pro: true, enterprise: true },
  { name: 'Custom domains', free: false, pro: true, enterprise: true },
  { name: 'SSO/SAML', free: false, pro: false, enterprise: true },
  { name: 'Audit logs', free: false, pro: false, enterprise: true },
  { name: 'Dedicated support', free: false, pro: false, enterprise: true },
];

const COUNTRIES = [
  { value: 'us', label: 'United States' },
  { value: 'uk', label: 'United Kingdom' },
  { value: 'ca', label: 'Canada' },
  { value: 'de', label: 'Germany' },
  { value: 'fr', label: 'France' },
  { value: 'au', label: 'Australia' },
  { value: 'jp', label: 'Japan' },
  { value: 'sg', label: 'Singapore' },
];

export default function NewTeamPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<TeamFormData>({
    name: '',
    description: '',
    avatarUrl: '',
    plan: 'free',
    visibility: 'private',
    inviteEmails: [],
    acceptTerms: false,
  });

  const [billingInfo, setBillingInfo] = useState<BillingInfo>({
    cardNumber: '',
    expiryDate: '',
    cvv: '',
    cardholderName: '',
    billingAddress: '',
    city: '',
    postalCode: '',
    country: 'us',
  });

  const [emailInput, setEmailInput] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const totalSteps = formData.plan === 'free' ? 3 : 4;

  const createTeamMutation = useMutation({
    mutationFn: async (data: TeamFormData) => {
      return apiRequest('POST', '/api/teams', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/teams'] });
      toast({
        title: 'Team Created!',
        description: `Your team "${formData.name}" has been created successfully.`,
      });
      navigate('/teams');
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create team. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleAvatarUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Avatar image must be less than 5MB',
          variant: 'destructive',
        });
        return;
      }
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
        setFormData(prev => ({ ...prev, avatarUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  }, [toast]);

  const addEmail = useCallback(() => {
    const email = emailInput.trim().toLowerCase();
    if (!email) return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setErrors(prev => ({ ...prev, email: 'Please enter a valid email address' }));
      return;
    }

    if (formData.inviteEmails.includes(email)) {
      setErrors(prev => ({ ...prev, email: 'This email has already been added' }));
      return;
    }

    setFormData(prev => ({
      ...prev,
      inviteEmails: [...prev.inviteEmails, email],
    }));
    setEmailInput('');
    setErrors(prev => ({ ...prev, email: '' }));
  }, [emailInput, formData.inviteEmails]);

  const removeEmail = useCallback((emailToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      inviteEmails: prev.inviteEmails.filter(e => e !== emailToRemove),
    }));
  }, []);

  const validateStep = useCallback((step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.name.trim()) {
        newErrors.name = 'Team name is required';
      } else if (formData.name.length < 3) {
        newErrors.name = 'Team name must be at least 3 characters';
      }
    }

    if (step === 3 && formData.plan !== 'free') {
      if (!billingInfo.cardNumber.replace(/\s/g, '').match(/^\d{16}$/)) {
        newErrors.cardNumber = 'Please enter a valid card number';
      }
      if (!billingInfo.expiryDate.match(/^\d{2}\/\d{2}$/)) {
        newErrors.expiryDate = 'Please use MM/YY format';
      }
      if (!billingInfo.cvv.match(/^\d{3,4}$/)) {
        newErrors.cvv = 'Please enter a valid CVV';
      }
      if (!billingInfo.cardholderName.trim()) {
        newErrors.cardholderName = 'Cardholder name is required';
      }
    }

    const finalStep = formData.plan === 'free' ? 3 : 4;
    if (step === finalStep && !formData.acceptTerms) {
      newErrors.terms = 'You must accept the terms and conditions';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, billingInfo]);

  const handleNext = useCallback(() => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, totalSteps));
    }
  }, [currentStep, totalSteps, validateStep]);

  const handleBack = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  }, []);

  const handleSubmit = useCallback(() => {
    if (!validateStep(totalSteps)) return;
    createTeamMutation.mutate(formData);
  }, [formData, totalSteps, validateStep, createTeamMutation]);

  const formatCardNumber = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/(\d{4})(?=\d)/g, '$1 ').trim().slice(0, 19);
  };

  const formatExpiryDate = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length >= 2) {
      return `${numbers.slice(0, 2)}/${numbers.slice(2, 4)}`;
    }
    return numbers;
  };

  const selectedPlan = TEAM_PLANS.find(p => p.id === formData.plan)!;
  const cardClassName = "border border-border bg-card shadow-sm";
  const inputClassName = "min-h-[44px] border-border bg-card text-foreground placeholder:text-muted-foreground focus:ring-primary/20 focus:border-primary/40 focus:ring-2 transition-all duration-200";

  return (
    <PageShell>
      <PageHeader
        title="Create a New Team"
        description="Build your team workspace and start collaborating with your organization."
        icon={UserPlus}
        actions={(
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => navigate('/teams')}
            data-testid="button-back-to-teams"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Teams
          </Button>
        )}
      />

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[13px] text-muted-foreground">Step {currentStep} of {totalSteps}</span>
          <span className="text-[13px] font-medium">{Math.round((currentStep / totalSteps) * 100)}% Complete</span>
        </div>
        <Progress value={(currentStep / totalSteps) * 100} className="h-2" data-testid="progress-steps" />
        <div className="flex justify-between mt-2">
          <span className="text-[11px] text-muted-foreground">Team Details</span>
          <span className="text-[11px] text-muted-foreground">Select Plan</span>
          {formData.plan !== 'free' && <span className="text-[11px] text-muted-foreground">Billing</span>}
          <span className="text-[11px] text-muted-foreground">Review & Create</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {currentStep === 1 && (
            <Card className={cardClassName} data-testid="card-team-details">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Team Details
                </CardTitle>
                <CardDescription>
                  Set up your team's basic information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-start gap-6">
                  <div className="flex flex-col items-center gap-2">
                    <Label className="text-[13px] mb-2">Team Avatar</Label>
                    <div className="relative">
                      <Avatar className="h-24 w-24 border-2 border-dashed border-border" data-testid="avatar-team">
                        {avatarPreview ? (
                          <AvatarImage src={avatarPreview} alt="Team avatar" />
                        ) : (
                          <AvatarFallback className="bg-muted">
                            <ImageIcon className="h-8 w-8 text-muted-foreground" />
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <label
                        htmlFor="avatar-upload"
                        className="absolute -bottom-2 -right-2 p-2 bg-primary text-primary-foreground rounded-full cursor-pointer hover:bg-primary/90 transition-colors"
                        data-testid="button-upload-avatar"
                      >
                        <Upload className="h-4 w-4" />
                        <input
                          id="avatar-upload"
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleAvatarUpload}
                          data-testid="input-avatar-file"
                        />
                      </label>
                    </div>
                    <p className="text-[11px] text-muted-foreground text-center mt-1">Max 5MB</p>
                  </div>

                  <div className="flex-1 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="team-name">Team Name *</Label>
                      <Input
                        id="team-name"
                        placeholder="Enter team name"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        className={`${inputClassName} ${errors.name ? 'border-destructive' : ''}`}
                        data-testid="input-team-name"
                      />
                      {errors.name && (
                        <p className="text-[13px] text-destructive flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {errors.name}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="team-description">Description</Label>
                      <Textarea
                        id="team-description"
                        placeholder="Describe your team's purpose and goals..."
                        value={formData.description}
                        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                        className={`${inputClassName} min-h-[100px] resize-none`}
                        data-testid="textarea-team-description"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <Label>Team Visibility</Label>
                  <RadioGroup
                    value={formData.visibility}
                    onValueChange={(value: 'public' | 'private') => setFormData(prev => ({ ...prev, visibility: value }))}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                    data-testid="radio-visibility"
                  >
                    <div className="relative">
                      <RadioGroupItem
                        value="private"
                        id="visibility-private"
                        className="peer sr-only"
                        data-testid="radio-private"
                      />
                      <Label
                        htmlFor="visibility-private"
                        className="flex items-start gap-3 rounded-lg border-2 border-border p-4 cursor-pointer hover:bg-muted/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 transition-all"
                      >
                        <Lock className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <span className="font-medium block">Private</span>
                          <span className="text-[13px] text-muted-foreground">Only invited members can see this team</span>
                        </div>
                      </Label>
                    </div>
                    <div className="relative">
                      <RadioGroupItem
                        value="public"
                        id="visibility-public"
                        className="peer sr-only"
                        data-testid="radio-public"
                      />
                      <Label
                        htmlFor="visibility-public"
                        className="flex items-start gap-3 rounded-lg border-2 border-border p-4 cursor-pointer hover:bg-muted/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 transition-all"
                      >
                        <Globe className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div>
                          <span className="font-medium block">Public</span>
                          <span className="text-[13px] text-muted-foreground">Anyone can discover and request to join</span>
                        </div>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Invite Team Members</Label>
                      <p className="text-[13px] text-muted-foreground">Add members by email address</p>
                    </div>
                    <Badge variant="outline">{formData.inviteEmails.length} invited</Badge>
                  </div>

                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        placeholder="colleague@company.com"
                        value={emailInput}
                        onChange={(e) => {
                          setEmailInput(e.target.value);
                          setErrors(prev => ({ ...prev, email: '' }));
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEmail())}
                        className={`${inputClassName} ${errors.email ? 'border-destructive' : ''}`}
                        data-testid="input-invite-email"
                      />
                      {errors.email && (
                        <p className="text-[13px] text-destructive flex items-center gap-1 mt-1">
                          <AlertCircle className="h-3 w-3" />
                          {errors.email}
                        </p>
                      )}
                    </div>
                    <Button onClick={addEmail} className="gap-2" data-testid="button-add-email">
                      <Plus className="h-4 w-4" />
                      Add
                    </Button>
                  </div>

                  {formData.inviteEmails.length > 0 && (
                    <div className="flex flex-wrap gap-2" data-testid="list-invited-emails">
                      {formData.inviteEmails.map((email, idx) => (
                        <Badge
                          key={email}
                          variant="secondary"
                          className="gap-1 py-1.5 pl-3 pr-2"
                          data-testid={`badge-email-${idx}`}
                        >
                          <Mail className="h-3 w-3" />
                          {email}
                          <button
                            onClick={() => removeEmail(email)}
                            className="ml-1 rounded-full hover:bg-destructive/20 p-0.5"
                            data-testid={`button-remove-email-${idx}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {currentStep === 2 && (
            <Card className={cardClassName} data-testid="card-plan-selection">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Choose Your Plan
                </CardTitle>
                <CardDescription>
                  Select the plan that best fits your team's needs
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <RadioGroup
                  value={formData.plan}
                  onValueChange={(value: 'free' | 'pro' | 'enterprise') => setFormData(prev => ({ ...prev, plan: value }))}
                  className="grid grid-cols-1 md:grid-cols-3 gap-4"
                  data-testid="radio-plans"
                >
                  {TEAM_PLANS.map((plan) => {
                    const PlanIcon = plan.icon;
                    return (
                      <div key={plan.id} className="relative">
                        <RadioGroupItem
                          value={plan.id}
                          id={`plan-${plan.id}`}
                          className="peer sr-only"
                          data-testid={`radio-plan-${plan.id}`}
                        />
                        <Label
                          htmlFor={`plan-${plan.id}`}
                          className="flex flex-col h-full rounded-xl border-2 border-border p-5 cursor-pointer hover:bg-muted/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 transition-all relative"
                        >
                          {plan.popular && (
                            <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                              <Star className="h-3 w-3 mr-1" />
                              Popular
                            </Badge>
                          )}
                          <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 rounded-lg bg-muted">
                              <PlanIcon className="h-5 w-5" />
                            </div>
                            <div>
                              <span className="font-semibold block">{plan.name}</span>
                              <span className="text-2xl font-bold">{plan.price}</span>
                              <span className="text-[13px] text-muted-foreground">{plan.period}</span>
                            </div>
                          </div>
                          <p className="text-[13px] text-muted-foreground mb-4">{plan.description}</p>
                          <ul className="space-y-2 mt-auto">
                            {plan.features.slice(0, 5).map((feature, idx) => (
                              <li key={idx} className="flex items-center gap-2 text-[13px]">
                                <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                <span>{feature}</span>
                              </li>
                            ))}
                            {plan.features.length > 5 && (
                              <li className="text-[13px] text-muted-foreground">
                                +{plan.features.length - 5} more features
                              </li>
                            )}
                          </ul>
                        </Label>
                      </div>
                    );
                  })}
                </RadioGroup>

                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="compare" data-testid="accordion-compare-plans">
                    <AccordionTrigger className="text-[13px]">
                      <span className="flex items-center gap-2">
                        <HelpCircle className="h-4 w-4" />
                        Compare all features
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[13px]" data-testid="table-plan-comparison">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-3 px-2 font-medium">Feature</th>
                              <th className="text-center py-3 px-2 font-medium">Free</th>
                              <th className="text-center py-3 px-2 font-medium">Pro</th>
                              <th className="text-center py-3 px-2 font-medium">Enterprise</th>
                            </tr>
                          </thead>
                          <tbody>
                            {PLAN_FEATURES.map((feature, idx) => (
                              <tr key={idx} className="border-b">
                                <td className="py-3 px-2">{feature.name}</td>
                                <td className="text-center py-3 px-2">
                                  {typeof feature.free === 'boolean' ? (
                                    feature.free ? <Check className="h-4 w-4 text-green-500 mx-auto" /> : <X className="h-4 w-4 text-muted-foreground mx-auto" />
                                  ) : feature.free}
                                </td>
                                <td className="text-center py-3 px-2">
                                  {typeof feature.pro === 'boolean' ? (
                                    feature.pro ? <Check className="h-4 w-4 text-green-500 mx-auto" /> : <X className="h-4 w-4 text-muted-foreground mx-auto" />
                                  ) : feature.pro}
                                </td>
                                <td className="text-center py-3 px-2">
                                  {typeof feature.enterprise === 'boolean' ? (
                                    feature.enterprise ? <Check className="h-4 w-4 text-green-500 mx-auto" /> : <X className="h-4 w-4 text-muted-foreground mx-auto" />
                                  ) : feature.enterprise}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          )}

          {currentStep === 3 && formData.plan !== 'free' && (
            <Card className={cardClassName} data-testid="card-billing">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Billing Information
                </CardTitle>
                <CardDescription>
                  Enter your payment details to activate your {selectedPlan.name} plan
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <selectedPlan.icon className="h-5 w-5 text-primary" />
                      <div>
                        <span className="font-medium">{selectedPlan.name} Plan</span>
                        <p className="text-[13px] text-muted-foreground">{selectedPlan.description}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-bold">{selectedPlan.price}</span>
                      <span className="text-[13px] text-muted-foreground">{selectedPlan.period}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2 space-y-2">
                    <Label htmlFor="card-number">Card Number</Label>
                    <Input
                      id="card-number"
                      placeholder="1234 5678 9012 3456"
                      value={billingInfo.cardNumber}
                      onChange={(e) => setBillingInfo(prev => ({ ...prev, cardNumber: formatCardNumber(e.target.value) }))}
                      className={`${inputClassName} ${errors.cardNumber ? 'border-destructive' : ''}`}
                      data-testid="input-card-number"
                    />
                    {errors.cardNumber && <p className="text-[13px] text-destructive">{errors.cardNumber}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="expiry">Expiry Date</Label>
                    <Input
                      id="expiry"
                      placeholder="MM/YY"
                      value={billingInfo.expiryDate}
                      onChange={(e) => setBillingInfo(prev => ({ ...prev, expiryDate: formatExpiryDate(e.target.value) }))}
                      className={`${inputClassName} ${errors.expiryDate ? 'border-destructive' : ''}`}
                      maxLength={5}
                      data-testid="input-expiry"
                    />
                    {errors.expiryDate && <p className="text-[13px] text-destructive">{errors.expiryDate}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="cvv">CVV</Label>
                    <Input
                      id="cvv"
                      placeholder="123"
                      type="password"
                      value={billingInfo.cvv}
                      onChange={(e) => setBillingInfo(prev => ({ ...prev, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                      className={`${inputClassName} ${errors.cvv ? 'border-destructive' : ''}`}
                      maxLength={4}
                      data-testid="input-cvv"
                    />
                    {errors.cvv && <p className="text-[13px] text-destructive">{errors.cvv}</p>}
                  </div>

                  <div className="sm:col-span-2 space-y-2">
                    <Label htmlFor="cardholder">Cardholder Name</Label>
                    <Input
                      id="cardholder"
                      placeholder="John Doe"
                      value={billingInfo.cardholderName}
                      onChange={(e) => setBillingInfo(prev => ({ ...prev, cardholderName: e.target.value }))}
                      className={`${inputClassName} ${errors.cardholderName ? 'border-destructive' : ''}`}
                      data-testid="input-cardholder"
                    />
                    {errors.cardholderName && <p className="text-[13px] text-destructive">{errors.cardholderName}</p>}
                  </div>

                  <div className="sm:col-span-2 space-y-2">
                    <Label htmlFor="address">Billing Address</Label>
                    <Input
                      id="address"
                      placeholder="123 Main Street"
                      value={billingInfo.billingAddress}
                      onChange={(e) => setBillingInfo(prev => ({ ...prev, billingAddress: e.target.value }))}
                      className={inputClassName}
                      data-testid="input-address"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="city">City</Label>
                    <Input
                      id="city"
                      placeholder="San Francisco"
                      value={billingInfo.city}
                      onChange={(e) => setBillingInfo(prev => ({ ...prev, city: e.target.value }))}
                      className={inputClassName}
                      data-testid="input-city"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="postal">Postal Code</Label>
                    <Input
                      id="postal"
                      placeholder="94105"
                      value={billingInfo.postalCode}
                      onChange={(e) => setBillingInfo(prev => ({ ...prev, postalCode: e.target.value }))}
                      className={inputClassName}
                      data-testid="input-postal"
                    />
                  </div>

                  <div className="sm:col-span-2 space-y-2">
                    <Label htmlFor="country">Country</Label>
                    <Select
                      value={billingInfo.country}
                      onValueChange={(value) => setBillingInfo(prev => ({ ...prev, country: value }))}
                    >
                      <SelectTrigger data-testid="select-country">
                        <SelectValue placeholder="Select country" />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map(country => (
                          <SelectItem key={country.value} value={country.value}>{country.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <Shield className="h-5 w-5 text-green-500" />
                  <span className="text-[13px] text-green-600 dark:text-green-400">Your payment information is encrypted and secure</span>
                </div>
              </CardContent>
            </Card>
          )}

          {((currentStep === 3 && formData.plan === 'free') || (currentStep === 4 && formData.plan !== 'free')) && (
            <Card className={cardClassName} data-testid="card-review">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Rocket className="h-5 w-5" />
                  Review & Create Team
                </CardTitle>
                <CardDescription>
                  Review your team settings and create your workspace
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/50 border border-border">
                  <Avatar className="h-16 w-16" data-testid="review-avatar">
                    {avatarPreview ? (
                      <AvatarImage src={avatarPreview} alt="Team avatar" />
                    ) : (
                      <AvatarFallback className="text-[15px] font-semibold bg-primary/10 text-primary">
                        {formData.name.slice(0, 2).toUpperCase() || 'T'}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold" data-testid="review-team-name">{formData.name || 'Untitled Team'}</h3>
                    <p className="text-[13px] text-muted-foreground mt-1" data-testid="review-description">{formData.description || 'No description provided'}</p>
                    <div className="flex items-center gap-2 mt-3">
                      <Badge variant="outline" className="gap-1" data-testid="review-visibility">
                        {formData.visibility === 'private' ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                        {formData.visibility === 'private' ? 'Private' : 'Public'}
                      </Badge>
                      <Badge className="gap-1" data-testid="review-plan">
                        <selectedPlan.icon className="h-3 w-3" />
                        {selectedPlan.name}
                      </Badge>
                    </div>
                  </div>
                </div>

                {formData.inviteEmails.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Pending Invitations</Label>
                    <div className="flex flex-wrap gap-2" data-testid="review-invites">
                      {formData.inviteEmails.map((email, idx) => (
                        <Badge key={idx} variant="secondary" className="gap-1">
                          <Mail className="h-3 w-3" />
                          {email}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {formData.plan !== 'free' && (
                  <div className="p-4 rounded-lg bg-muted/50 border border-border">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Total</span>
                      <span className="text-xl font-bold">{selectedPlan.price}<span className="text-[13px] font-normal text-muted-foreground">{selectedPlan.period}</span></span>
                    </div>
                  </div>
                )}

                <Separator />

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="terms"
                    checked={formData.acceptTerms}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, acceptTerms: checked as boolean }))}
                    data-testid="checkbox-terms"
                  />
                  <div>
                    <Label htmlFor="terms" className="text-[13px] cursor-pointer">
                      I agree to the <a href="/terms" className="text-primary hover:underline">Terms of Service</a> and <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>
                    </Label>
                    {errors.terms && (
                      <p className="text-[13px] text-destructive flex items-center gap-1 mt-1">
                        <AlertCircle className="h-3 w-3" />
                        {errors.terms}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center justify-between mt-6">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1}
              className="gap-2"
              data-testid="button-previous-step"
            >
              <ArrowLeft className="h-4 w-4" />
              Previous
            </Button>

            {currentStep < totalSteps ? (
              <Button
                onClick={handleNext}
                className="gap-2"
                data-testid="button-next-step"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={createTeamMutation.isPending}
                className="gap-2"
                data-testid="button-create-team"
              >
                {createTeamMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating Team...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Create Team
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <Card className={`${cardClassName} sticky top-6`} data-testid="card-summary">
            <CardHeader>
              <CardTitle className="text-base">Team Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  {avatarPreview ? (
                    <AvatarImage src={avatarPreview} alt="Team avatar" />
                  ) : (
                    <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                      {formData.name.slice(0, 2).toUpperCase() || '?'}
                    </AvatarFallback>
                  )}
                </Avatar>
                <div>
                  <p className="font-medium" data-testid="summary-name">{formData.name || 'Team Name'}</p>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    {formData.visibility === 'private' ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                    {formData.visibility === 'private' ? 'Private' : 'Public'}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-muted-foreground">Plan</span>
                  <Badge variant="outline" className="gap-1" data-testid="summary-plan">
                    <selectedPlan.icon className="h-3 w-3" />
                    {selectedPlan.name}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-muted-foreground">Members</span>
                  <span data-testid="summary-members">{formData.inviteEmails.length + 1}</span>
                </div>
                {formData.plan !== 'free' && (
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="text-muted-foreground">Monthly Cost</span>
                    <span className="font-medium" data-testid="summary-cost">
                      {formData.plan === 'pro' ? `$${15 * (formData.inviteEmails.length + 1)}` : 'Custom'}
                    </span>
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">What's included</p>
                <ul className="space-y-2">
                  {selectedPlan.features.slice(0, 4).map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-[13px]">
                      <Check className="h-3 w-3 text-primary flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
