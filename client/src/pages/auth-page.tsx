import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  displayName: z.string().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;
type RegisterFormValues = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const { user, loginMutation, registerMutation } = useAuth();
  const [location, navigate] = useLocation();

  // Redirect to home if user is already logged in
  useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      password: "",
      email: "",
      displayName: "",
    },
  });

  const onLoginSubmit = (data: LoginFormValues) => {
    loginMutation.mutate(data);
  };

  const onRegisterSubmit = (data: RegisterFormValues) => {
    registerMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Welcome to PLOT</CardTitle>
            <CardDescription>
              Sign in to your account or create a new one to get started.
            </CardDescription>
            <div className="mt-2 p-3 bg-muted rounded-md text-sm">
              <p className="mb-1"><strong>Demo accounts:</strong></p>
              <div className="flex flex-col gap-2 mt-2">
                <div className="flex justify-between items-center">
                  <div>
                    <span>Username: <code className="bg-slate-700 px-1 rounded">admin</code></span><br/>
                    <span>Password: <code className="bg-slate-700 px-1 rounded">admin</code></span>
                  </div>
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={() => {
                      loginForm.setValue('username', 'admin');
                      loginForm.setValue('password', 'admin');
                      setActiveTab('login');
                    }}
                  >
                    Use Admin
                  </Button>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <div>
                    <span>Username: <code className="bg-slate-700 px-1 rounded">demo</code></span><br/>
                    <span>Password: <code className="bg-slate-700 px-1 rounded">password</code></span>
                  </div>
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    onClick={() => {
                      loginForm.setValue('username', 'demo');
                      loginForm.setValue('password', 'password');
                      setActiveTab('login');
                    }}
                  >
                    Use Demo
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" value={activeTab} onValueChange={(value) => setActiveTab(value as "login" | "register")}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Register</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
                    <FormField
                      control={loginForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input placeholder="Your username" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="Your password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="space-y-2">
                      <Button 
                        type="submit" 
                        className="w-full" 
                        disabled={loginMutation.isPending}
                      >
                        {loginMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Logging in...
                          </>
                        ) : (
                          "Login"
                        )}
                      </Button>
                      
                      <div className="flex gap-2 w-full">
                        <Button 
                          type="button" 
                          variant="outline" 
                          className="flex-1"
                          onClick={() => {
                            loginForm.setValue('username', 'admin');
                            loginForm.setValue('password', 'admin');
                            loginForm.handleSubmit(onLoginSubmit)();
                          }}
                        >
                          One-Click Admin Login
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline" 
                          className="flex-1"
                          onClick={() => {
                            loginForm.setValue('username', 'demo');
                            loginForm.setValue('password', 'password');
                            loginForm.handleSubmit(onLoginSubmit)();
                          }}
                        >
                          One-Click Demo Login
                        </Button>
                      </div>
                    </div>
                  </form>
                </Form>
              </TabsContent>

              <TabsContent value="register">
                <Form {...registerForm}>
                  <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
                    <FormField
                      control={registerForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input placeholder="Choose a username" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Password</FormLabel>
                          <FormControl>
                            <Input 
                              type="password" 
                              placeholder="Choose a password" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email (optional)</FormLabel>
                          <FormControl>
                            <Input 
                              type="email" 
                              placeholder="Your email address" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={registerForm.control}
                      name="displayName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Display Name (optional)</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Your display name" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button 
                      type="submit" 
                      className="w-full" 
                      disabled={registerMutation.isPending}
                    >
                      {registerMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Registering...
                        </>
                      ) : (
                        "Register"
                      )}
                    </Button>
                  </form>
                </Form>
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter className="flex justify-center">
            <p className="text-sm text-muted-foreground">
              {activeTab === "login" ? (
                <>
                  Don't have an account?{" "}
                  <Button variant="link" className="p-0 h-auto" onClick={() => setActiveTab("register")}>
                    Register
                  </Button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <Button variant="link" className="p-0 h-auto" onClick={() => setActiveTab("login")}>
                    Login
                  </Button>
                </>
              )}
            </p>
          </CardFooter>
        </Card>
      </div>

      <div className="flex-1 bg-gradient-to-br from-primary/20 to-primary/10 p-8 flex flex-col justify-center hidden md:flex">
        <div className="max-w-xl mx-auto space-y-6">
          <h1 className="text-4xl font-extrabold tracking-tight">
            Code, collaborate, and deploy with <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-blue-600">PLOT</span>
          </h1>
          <p className="text-lg text-muted-foreground">
            PLOT is a browser-based IDE that lets you write code with friends in real-time.
            Create projects, share them, and deploy them with just a few clicks.
          </p>
          <div className="grid grid-cols-2 gap-4 pt-4">
            <div className="border rounded-lg p-4 bg-card">
              <h3 className="font-medium mb-2">Real-time Collaboration</h3>
              <p className="text-sm text-muted-foreground">
                Work together with friends or colleagues in real-time on the same project.
              </p>
            </div>
            <div className="border rounded-lg p-4 bg-card">
              <h3 className="font-medium mb-2">One-Click Deployment</h3>
              <p className="text-sm text-muted-foreground">
                Deploy your applications with a single click and share them with the world.
              </p>
            </div>
            <div className="border rounded-lg p-4 bg-card">
              <h3 className="font-medium mb-2">Multiple Languages</h3>
              <p className="text-sm text-muted-foreground">
                Support for JavaScript, Python, HTML, CSS, and many more languages.
              </p>
            </div>
            <div className="border rounded-lg p-4 bg-card">
              <h3 className="font-medium mb-2">Free to Use</h3>
              <p className="text-sm text-muted-foreground">
                Get started for free and upgrade as your needs grow.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}