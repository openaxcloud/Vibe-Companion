import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { LazyMotionDiv } from '@/lib/motion';
import { 
  Loader2, Code, ArrowRight, Eye, EyeOff, 
  Sparkles, Mail, Lock, Github, Chrome,
  Twitter, Shield, CheckCircle, ChevronLeft
} from 'lucide-react';
import { Link } from 'wouter';
import { getProjectUrl } from '@/lib/utils';
import { ECodeLogo } from '@/components/ECodeLogo';
import { apiRequest, queryClient, resetCSRFToken } from '@/lib/queryClient';
import { TwoFactorVerify } from '@/components/security/TwoFactorVerify';

// Import stock images
const modernSoftwareImg = 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=2070&auto=format&fit=crop';

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
};

export default function Login() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user, isLoading: authLoading, loginMutation } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [twoFactorChallenge, setTwoFactorChallenge] = useState<{
    challengeId: string;
    email: string;
  } | null>(null);

  // Function to create project and navigate
  const createProjectAndNavigate = async (description: string) => {
    try {
      const project = await apiRequest('POST', '/api/projects', {
        name: description.slice(0, 30),
        description: description,
        language: 'javascript',
        visibility: 'private'
      });
      
      window.sessionStorage.setItem(`agent-prompt-${project.id}`, description);
      const projectUrl = getProjectUrl(project, project.owner?.username);
      navigate(`${projectUrl}?agent=true&prompt=${encodeURIComponent(description)}`);
    } catch (error: any) {
      console.error('Failed to create project:', error);
      toast({
        title: "Project creation failed",
        description: error.message || "Unable to create project. Redirecting to dashboard.",
        variant: "destructive"
      });
      navigate('/dashboard');
    }
  };

  // Redirect after successful login - handle pending workspace creation (Replit-style flow)
  // IMPORTANT: Wait for authLoading=false to avoid redirecting on stale IndexedDB cached data
  useEffect(() => {
    if (!authLoading && user) {
      const pendingAppDescription = sessionStorage.getItem('pendingAppDescription');
      const triggerBuild = sessionStorage.getItem('triggerBuildOnLanding');
      
      // PRIORITY 1: Check if we need to continue workspace creation from Homepage (Replit-style flow)
      if (triggerBuild === 'true' && pendingAppDescription) {
        // Redirect to Landing page which will auto-trigger workspace creation
        navigate('/');
        return;
      }
      
      // PRIORITY 2: Legacy URL param method
      const urlParams = new URLSearchParams(window.location.search);
      const shouldRedirectToAgent = urlParams.get('build') === 'true';
      
      if (shouldRedirectToAgent && pendingAppDescription) {
        sessionStorage.removeItem('pendingAppDescription');
        createProjectAndNavigate(pendingAppDescription);
        return;
      }
      
      // PRIORITY 3: Admin redirect
      if (user.role === 'admin' || user.role === 'super_admin' || (user as any).isAdmin) {
        navigate('/admin/chatgpt');
        return;
      }
      
      // Default: go to dashboard
      navigate('/dashboard');
    }
  }, [user, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password) {
      toast({
        title: 'Error',
        description: 'Please enter both email and password',
        variant: 'destructive'
      });
      return;
    }

    setIsLoggingIn(true);
    try {
      const response = await apiRequest<any>('POST', '/api/login', { ...formData, rememberMe });
      
      if (response.requires2FA && response.challengeId) {
        setTwoFactorChallenge({
          challengeId: response.challengeId,
          email: response.email || formData.email
        });
        setIsLoggingIn(false);
        return;
      }
      
      resetCSRFToken();
      queryClient.setQueryData(['/api/me'], response.user || response);
      await queryClient.invalidateQueries();
      
      const displayName = response.user?.displayName || response.user?.username || 'User';
      toast({
        title: 'Login successful',
        description: `Welcome back, ${displayName}!`
      });
    } catch (error: any) {
      // Handle 2FA requirement (now returns 401 with code 2FA_REQUIRED)
      if (error.is2FARequired && error.data) {
        setTwoFactorChallenge({
          challengeId: error.data.challengeId,
          email: error.data.email || formData.email
        });
        setIsLoggingIn(false);
        return;
      }
      console.error('Login error:', error);
      toast({
        title: 'Login failed',
        description: error.message || 'Invalid credentials',
        variant: 'destructive'
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handle2FASuccess = async (pendingSessionToken: string) => {
    setIsLoggingIn(true);
    try {
      const response = await apiRequest<any>('POST', '/api/login/2fa-complete', { pendingSessionToken });
      
      resetCSRFToken();
      queryClient.setQueryData(['/api/me'], response.user || response);
      await queryClient.invalidateQueries();
      
      setTwoFactorChallenge(null);
      
      const displayName = response.user?.displayName || response.user?.username || 'User';
      toast({
        title: 'Login successful',
        description: `Welcome back, ${displayName}!`
      });
    } catch (error: any) {
      console.error('2FA complete error:', error);
      toast({
        title: 'Login failed',
        description: error.message || 'Session expired. Please try again.',
        variant: 'destructive'
      });
      setTwoFactorChallenge(null);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSocialLogin = (provider: string) => {
    const providerRoutes: Record<string, string> = {
      'GitHub': '/api/auth/github',
      'Google': '/api/auth/google',
      'Twitter': '/api/auth/twitter',
      'Apple': '/api/auth/apple'
    };
    
    const route = providerRoutes[provider];
    if (route) {
      // Redirect to OAuth endpoint which will handle the OAuth flow
      window.location.href = route;
    } else {
      toast({
        title: "Coming Soon",
        description: `${provider} login will be available soon!`,
      });
    }
  };

  if (twoFactorChallenge) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/50 to-background flex items-center justify-center p-4 sm:p-6 md:p-8">
        <LazyMotionDiv
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md"
        >
          <TwoFactorVerify
            challengeId={twoFactorChallenge.challengeId}
            email={twoFactorChallenge.email}
            onSuccess={handle2FASuccess}
            onCancel={() => setTwoFactorChallenge(null)}
          />
        </LazyMotionDiv>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/50 to-background flex">
      {/* Left Side - Form - Mobile Optimized */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-6 md:p-8 lg:p-16">
        <div className="w-full max-w-md space-y-6 sm:space-y-8">
          {/* Back to Home */}
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Back to home page"
            data-testid="button-back-home"
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
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">Welcome back</h2>
            <p className="text-[13px] sm:text-base text-muted-foreground">
              Sign in to continue building amazing applications
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[13px] font-medium">
                  Username or Email
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="text"
                    placeholder="Enter your username or email"
                    className="pl-10 h-12 sm:h-11 text-base sm:text-[13px]"
                    value={formData.email}
                    onChange={handleInputChange}
                    disabled={isLoggingIn}
                    required
                    data-testid="input-email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-[13px] font-medium">
                    Password
                  </Label>
                  <Link href="/forgot-password" className="text-[13px] text-orange-600 dark:text-orange-400 hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    className="pl-10 pr-12 h-12 sm:h-11 text-base sm:text-[13px]"
                    value={formData.password}
                    onChange={handleInputChange}
                    disabled={isLoggingIn}
                    required
                    data-testid="input-password"
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
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="remember" 
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  />
                  <label 
                    htmlFor="remember" 
                    className="text-[13px] text-muted-foreground cursor-pointer"
                  >
                    Remember me for 30 days
                  </label>
                </div>
              </div>
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
              disabled={isLoggingIn}
              data-testid="button-login"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>

            
          </form>

          {/* Sign Up Link */}
          <p className="text-center text-[13px] text-muted-foreground">
            Don't have an account?{' '}
            <Link href="/register" className="font-semibold text-violet-600 dark:text-violet-400 hover:underline" data-testid="link-register">
              Sign up for free
            </Link>
          </p>

          {/* Development Quick Login */}
          {import.meta.env.DEV && (
            <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
              <CardContent className="p-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setFormData({ email: 'testuser@test.com', password: 'testpass123' });
                    setTimeout(() => {
                      const form = document.querySelector('form') as HTMLFormElement;
                      if (form) form.requestSubmit();
                    }, 100);
                  }}
                >
                  <Code className="mr-2 h-4 w-4" />
                  Quick Login (Dev Mode)
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Terms */}
          <p className="text-center text-[11px] text-muted-foreground">
            By signing in, you agree to our{' '}
            <Link href="/terms" className="underline hover:text-foreground">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="underline hover:text-foreground">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>

      {/* Right Side - Image & Features */}
      <div 
        className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-orange-500 to-amber-500 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #F26207 0%, #F99D25 100%)'
        }}
      >
        {/* Background Image */}
        <div className="absolute inset-0">
          <img 
            src={modernSoftwareImg} 
            alt="Modern Software Development"
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
                <Sparkles className="h-4 w-4" />
                <span className="text-[13px] font-medium">AI-Powered Development</span>
              </div>
              
              <h2 className="text-4xl font-bold leading-tight">
                Build faster with enterprise-grade tools
              </h2>
              
              <p className="text-[15px] opacity-90">
                Ship production-ready applications 10x faster with AI-powered development.
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
      </div>
    </div>
  );
}