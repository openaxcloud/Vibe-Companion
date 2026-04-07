import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { LazyMotionDiv, LazyAnimatePresence } from '@/lib/motion';
import { 
  Loader2, Code, AlertCircle, ArrowRight, Eye, EyeOff,
  Mail, Lock, User, Github, Chrome, Twitter, CheckCircle2,
  X, Shield, Sparkles, ChevronLeft, Zap, CheckCircle
} from 'lucide-react';
import { Link } from 'wouter';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ECodeLogo } from '@/components/ECodeLogo';

const codingWorkspaceImg = 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=2070&auto=format&fit=crop';

const calculatePasswordStrength = (password: string): { score: number; label: string; color: string } => {
  let score = 0;
  
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  
  const percentage = (score / 6) * 100;
  
  if (percentage <= 25) return { score: percentage, label: 'Weak', color: 'bg-red-500' };
  if (percentage <= 50) return { score: percentage, label: 'Fair', color: 'bg-orange-500' };
  if (percentage <= 75) return { score: percentage, label: 'Good', color: 'bg-yellow-500' };
  return { score: percentage, label: 'Strong', color: 'bg-green-500' };
};

export default function Register() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ score: 0, label: '', color: 'bg-muted-foreground/30' });
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    displayName: ''
  });

  const passwordRequirements = [
    { met: formData.password.length >= 8, text: 'At least 8 characters' },
    { met: /[A-Z]/.test(formData.password), text: 'One uppercase letter' },
    { met: /[a-z]/.test(formData.password), text: 'One lowercase letter' },
    { met: /[0-9]/.test(formData.password), text: 'One number' },
    { met: /[^a-zA-Z0-9]/.test(formData.password), text: 'One special character' }
  ];

  useEffect(() => {
    if (formData.password) {
      setPasswordStrength(calculatePasswordStrength(formData.password));
    } else {
      setPasswordStrength({ score: 0, label: '', color: 'bg-muted-foreground/30' });
    }
  }, [formData.password]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    
    const validationErrors: string[] = [];
    
    if (!formData.username || !formData.email || !formData.password) {
      validationErrors.push('Please fill in all required fields');
    }

    // Email format validation - RFC 5322 compliant regex
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (formData.email && !emailRegex.test(formData.email)) {
      validationErrors.push('Please enter a valid email address');
    }
    
    if (formData.password !== formData.confirmPassword) {
      validationErrors.push('Passwords do not match');
    }
    
    if (formData.password.length < 8) {
      validationErrors.push('Password must be at least 8 characters long');
    }

    if (!acceptTerms) {
      validationErrors.push('Please accept the terms and conditions');
    }

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsLoading(true);
    
    try {
      const data = await apiRequest('POST', '/api/register', {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        displayName: formData.displayName || formData.username
      });
      
      toast({
        title: 'Account created successfully',
        description: data.message || 'Please check your email to verify your account.',
      });
      
      // Small delay to ensure toast is visible before navigation
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check for pending workspace creation (Replit-style flow)
      const pendingAppDescription = sessionStorage.getItem('pendingAppDescription');
      const triggerBuild = sessionStorage.getItem('triggerBuildOnLanding');
      
      if (triggerBuild === 'true' && pendingAppDescription) {
        // Flags are already set - redirect to landing to trigger workspace creation
        navigate('/');
      } else {
        // Legacy: check URL param
        const urlParams = new URLSearchParams(window.location.search);
        const redirectParam = urlParams.get('redirect');
        
        if (redirectParam === 'build-from-prompt' && pendingAppDescription) {
          sessionStorage.setItem('triggerBuildOnLanding', 'true');
          navigate('/');
        } else {
          navigate('/home');
        }
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      
      try {
        const errorText = error.message || String(error);
        
        const jsonMatch = errorText.match(/\d+:\s*(\{.*\})/);
        if (jsonMatch) {
          const errorData = JSON.parse(jsonMatch[1]);
          if (errorData.errors && Array.isArray(errorData.errors)) {
            setErrors(errorData.errors.map((e: any) => e.message || e));
          } else if (errorData.message) {
            setErrors([errorData.message]);
          } else {
            setErrors(['Registration failed. Please try again.']);
          }
        } else {
          setErrors([errorText || 'Something went wrong. Please try again.']);
        }
      } catch (parseError) {
        setErrors(['Something went wrong. Please try again.']);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSocialSignup = (provider: string) => {
    toast({ title: `${provider} signup coming soon!` });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/50 to-background flex">
      {/* Left Side - Form - Mobile Optimized */}
      <LazyMotionDiv 
        className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-6 md:p-8 lg:p-16 overflow-y-auto"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <div className="w-full max-w-md space-y-4 sm:space-y-6">
          {/* Back to Home */}
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="text-[13px]">Back to home</span>
          </button>

          {/* Logo */}
          <div className="flex flex-col items-center justify-center mb-2">
            <ECodeLogo size="lg" showText={true} />
            <p className="text-[13px] text-muted-foreground mt-2">Enterprise Development Platform</p>
          </div>

          {/* Welcome Message - Responsive Typography */}
          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">Create your account</h2>
            <p className="text-[13px] sm:text-base text-muted-foreground">
              Get started with a free account. No credit card required.
            </p>
          </div>

          {/* Errors */}
          <LazyAnimatePresence>
            {errors.length > 0 && (
              <LazyMotionDiv
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <ul className="list-disc list-inside">
                      {errors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              </LazyMotionDiv>
            )}
          </LazyAnimatePresence>

          {/* Form - Mobile Responsive */}
          <form onSubmit={handleRegister} className="space-y-4 sm:space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-[13px] font-medium">
                  Username *
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    placeholder="johndoe"
                    className="pl-10 h-12 sm:h-11 text-base sm:text-[13px]"
                    value={formData.username}
                    onChange={handleInputChange}
                    disabled={isLoading}
                    required
                    data-testid="input-username"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName" className="text-[13px] font-medium">
                  Display Name
                </Label>
                <Input
                  id="displayName"
                  name="displayName"
                  type="text"
                  placeholder="John Doe"
                  className="h-12 sm:h-11 text-base sm:text-[13px]"
                  value={formData.displayName}
                  onChange={handleInputChange}
                  disabled={isLoading}
                  data-testid="input-display-name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-[13px] font-medium">
                Email Address *
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="john@example.com"
                  className="pl-10 h-12 sm:h-11 text-base sm:text-[13px]"
                  value={formData.email}
                  onChange={handleInputChange}
                  disabled={isLoading}
                  required
                  data-testid="input-register-email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-[13px] font-medium">
                Password *
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a strong password"
                  className="pl-10 pr-12 h-12 sm:h-11 text-base sm:text-[13px]"
                  value={formData.password}
                  onChange={handleInputChange}
                  disabled={isLoading}
                  required
                  data-testid="input-register-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 -mr-2 sm:mr-0 flex items-center justify-center"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff className="h-5 w-5 sm:h-4 sm:w-4" /> : <Eye className="h-5 w-5 sm:h-4 sm:w-4" />}
                </button>
              </div>
              
              {/* Password Strength Indicator */}
              <div className={`collapsible-content ${formData.password ? 'expanded' : ''}`}>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">Password strength</span>
                    <span className={`text-[11px] font-medium ${
                      passwordStrength.color.replace('bg-', 'text-')
                    }`}>
                      {passwordStrength.label}
                    </span>
                  </div>
                  <Progress value={passwordStrength.score} className="h-2" />
                  
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {passwordRequirements.map((req, idx) => (
                      <div key={idx} className="flex items-center gap-1 text-[11px]">
                        {req.met ? (
                          <CheckCircle2 className="h-3 w-3 text-green-500" />
                        ) : (
                          <X className="h-3 w-3 text-muted-foreground/40" />
                        )}
                        <span className={req.met ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>
                          {req.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-[13px] font-medium">
                Confirm Password *
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Re-enter your password"
                  className="pl-10 pr-12 h-12 sm:h-11 text-base sm:text-[13px]"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  disabled={isLoading}
                  required
                  data-testid="input-confirm-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 -mr-2 sm:mr-0 flex items-center justify-center"
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  data-testid="button-toggle-confirm-password"
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5 sm:h-4 sm:w-4" /> : <Eye className="h-5 w-5 sm:h-4 sm:w-4" />}
                </button>
              </div>
              {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <p className="text-[11px] text-red-500">Passwords do not match</p>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox 
                id="terms" 
                checked={acceptTerms}
                onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
              />
              <label 
                htmlFor="terms" 
                className="text-[13px] text-muted-foreground cursor-pointer"
              >
                I agree to the{' '}
                <Link href="/terms" className="text-orange-600 dark:text-orange-400 hover:underline">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link href="/privacy" className="text-orange-600 dark:text-orange-400 hover:underline">
                  Privacy Policy
                </Link>
              </label>
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 sm:h-11 text-base sm:text-[13px] font-semibold"
              style={{
                background: 'linear-gradient(135deg, #F26207 0%, #F99D25 100%)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #D85506 0%, #E88D20 100%)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #F26207 0%, #F99D25 100%)';
              }}
              disabled={isLoading || !acceptTerms}
              data-testid="button-register"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Creating account...
                </>
              ) : (
                <>
                  Create free account
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator />
              </div>
              <div className="relative flex justify-center text-[11px] uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or sign up with</span>
              </div>
            </div>

            {/* Social Signup */}
            <div className="grid grid-cols-3 gap-3">
              <Button 
                type="button"
                variant="outline" 
                className="h-12 hover:bg-muted"
                onClick={() => handleSocialSignup('GitHub')}
              >
                <Github className="h-5 w-5" />
              </Button>
              <Button 
                type="button"
                variant="outline" 
                className="h-12 hover:bg-muted"
                onClick={() => handleSocialSignup('Google')}
              >
                <Chrome className="h-5 w-5" />
              </Button>
              <Button 
                type="button"
                variant="outline" 
                className="h-12 hover:bg-muted"
                onClick={() => handleSocialSignup('Twitter')}
              >
                <Twitter className="h-5 w-5" />
              </Button>
            </div>
          </form>

          {/* Sign In Link */}
          <p className="text-center text-[13px] text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold text-orange-600 dark:text-orange-400 hover:underline" data-testid="link-login">
              Sign in
            </Link>
          </p>

          {/* Terms */}
          <p className="text-center text-[11px] text-muted-foreground">
            By signing up, you agree to our{' '}
            <Link href="/terms" className="underline hover:text-foreground">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="underline hover:text-foreground">
              Privacy Policy
            </Link>
          </p>
        </div>
      </LazyMotionDiv>

      {/* Right Side - Image & Features */}
      <LazyMotionDiv 
        className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-orange-500 to-amber-500 relative overflow-hidden"
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        style={{
          background: 'linear-gradient(135deg, #F26207 0%, #F99D25 100%)'
        }}
      >
        {/* Background Image */}
        <div className="absolute inset-0">
          <img 
            src={codingWorkspaceImg} 
            alt="Coding Workspace"
            className="w-full h-full object-cover opacity-20"
          />
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(135deg, rgba(242, 98, 7, 0.9) 0%, rgba(249, 157, 37, 0.9) 100%)'
          }} />
        </div>

        {/* Content */}
        <div className="relative z-10 flex items-center justify-center p-12">
          <div className="max-w-md text-white space-y-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full">
                <Zap className="h-4 w-4" />
                <span className="text-[13px] font-medium">Get Started in Seconds</span>
              </div>
              
              <h2 className="text-4xl font-bold leading-tight">
                Start building with AI today
              </h2>
              
              <p className="text-[15px] opacity-90">
                Start building production-ready applications with AI assistance, enterprise security, and unlimited scalability.
              </p>
            </div>

            {/* Feature List */}
            <div className="space-y-4">
              {[
                { icon: Shield, text: "SOC 2 Type II Certified" },
                { icon: Sparkles, text: "AI Agent builds complete apps" },
                { icon: Code, text: "Support for 50+ languages" },
                { icon: CheckCircle, text: "99.99% uptime guaranteed" }
              ].map((feature, idx) => (
                <div 
                  key={idx}
                  className="flex items-center gap-3 animate-slide-in-up opacity-0"
                  style={{ animationDelay: `${200 + idx * 100}ms`, animationFillMode: 'forwards' }}
                >
                  <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <span className="text-white/90">{feature.text}</span>
                </div>
              ))}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 pt-8 border-t border-white/20">
              <div>
                <div className="text-3xl font-bold">21</div>
                <div className="text-[13px] opacity-75">AI Models</div>
              </div>
              <div>
                <div className="text-3xl font-bold">29+</div>
                <div className="text-[13px] opacity-75">Languages</div>
              </div>
            </div>
          </div>
        </div>
      </LazyMotionDiv>
    </div>
  );
}
