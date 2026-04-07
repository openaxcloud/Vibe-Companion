import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Book, Code, Lightbulb, Rocket, Zap, CheckCircle2 } from "lucide-react";

export default function AIDocumentation() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-12 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">AI Documentation</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Complete guide to leveraging AI-powered development on E-Code Platform
          </p>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="overview" className="space-y-8" data-testid="tabs-ai-docs">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="models" data-testid="tab-models">AI Models</TabsTrigger>
            <TabsTrigger value="prompts" data-testid="tab-prompts">Custom Prompts</TabsTrigger>
            <TabsTrigger value="templates" data-testid="tab-templates">Templates</TabsTrigger>
            <TabsTrigger value="api" data-testid="tab-api">API Reference</TabsTrigger>
            <TabsTrigger value="examples" data-testid="tab-examples">Examples</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Book className="h-5 w-5" />
                  Getting Started with AI
                </CardTitle>
                <CardDescription>
                  Learn how to use AI features to accelerate your development
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Zap className="h-4 w-4 text-primary" />
                      AI-Powered Code Generation
                    </h3>
                    <p className="text-[13px] text-muted-foreground">
                      Generate complete applications, components, and functions using natural language descriptions. Our AI understands context and best practices.
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-primary" />
                      Intelligent Code Completion
                    </h3>
                    <p className="text-[13px] text-muted-foreground">
                      Get smart suggestions as you type. The AI learns from your codebase and coding style to provide relevant completions.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Code className="h-4 w-4 text-primary" />
                      Code Analysis & Refactoring
                    </h3>
                    <p className="text-[13px] text-muted-foreground">
                      Automatically identify code smells, performance issues, and security vulnerabilities. Get AI-powered refactoring suggestions.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Rocket className="h-4 w-4 text-primary" />
                      Deployment Assistance
                    </h3>
                    <p className="text-[13px] text-muted-foreground">
                      AI helps configure deployments, set up CI/CD pipelines, and optimize your infrastructure automatically.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Models Tab */}
          <TabsContent value="models" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Available AI Models</CardTitle>
                <CardDescription>Choose the right AI model for your needs</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold">GPT-4o</h3>
                        <p className="text-[13px] text-muted-foreground">OpenAI flagship model (gpt-4o)</p>
                      </div>
                      <span className="px-2 py-1 bg-primary/10 text-primary text-[11px] rounded">Primary</span>
                    </div>
                    <p className="text-[13px] mt-2">Best for complex code generation, architecture design, and natural language understanding.</p>
                  </div>

                  <div className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold">Claude Sonnet 4</h3>
                        <p className="text-[13px] text-muted-foreground">Anthropic's latest model (claude-sonnet-4-20250514)</p>
                      </div>
                      <span className="px-2 py-1 bg-blue-500/10 text-blue-500 text-[11px] rounded">Fallback</span>
                    </div>
                    <p className="text-[13px] mt-2">Excellent for code analysis, refactoring, and detailed technical explanations.</p>
                  </div>

                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold">Gemini 2.5 Flash</h3>
                    <p className="text-[13px] text-muted-foreground">Google's fast multimodal AI (gemini-2.5-flash)</p>
                    <p className="text-[13px] mt-2">Supports vision and code understanding for complex use cases.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Custom Prompts Tab */}
          <TabsContent value="prompts" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Custom Prompts & Rules</CardTitle>
                <CardDescription>Customize AI behavior for your projects</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-[13px] text-muted-foreground">
                  Create custom prompts to define specific AI behaviors, coding standards, and project-specific rules.
                </p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium">Project-specific rules</p>
                      <p className="text-[13px] text-muted-foreground">Define custom coding standards and conventions</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium">Template library</p>
                      <p className="text-[13px] text-muted-foreground">Pre-built templates for common development tasks</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="font-medium">Variable support</p>
                      <p className="text-[13px] text-muted-foreground">Use dynamic variables like {`{{projectName}}`} and {`{{language}}`}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>AI Prompt Templates</CardTitle>
                <CardDescription>Ready-to-use templates for common tasks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-2">React Component Generator</h3>
                    <p className="text-[13px] text-muted-foreground">Generate modern React components with TypeScript and hooks</p>
                  </div>
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-2">API Endpoint Creator</h3>
                    <p className="text-[13px] text-muted-foreground">Create RESTful API endpoints with validation and error handling</p>
                  </div>
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-2">Database Schema Designer</h3>
                    <p className="text-[13px] text-muted-foreground">Design normalized database schemas with relationships</p>
                  </div>
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-2">Test Generator</h3>
                    <p className="text-[13px] text-muted-foreground">Generate comprehensive unit and integration tests</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Reference Tab */}
          <TabsContent value="api" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>API Reference</CardTitle>
                <CardDescription>Technical documentation for AI endpoints</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">POST /api/ai/generate</h3>
                    <p className="text-[13px] text-muted-foreground mb-2">Generate code using AI</p>
                    <div className="bg-muted p-3 rounded-lg">
                      <pre className="text-[11px] overflow-x-auto">
{`{
  "prompt": "Create a login form",
  "model": "gpt-4.1",
  "context": "React TypeScript"
}`}
                      </pre>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">POST /api/ai/analyze</h3>
                    <p className="text-[13px] text-muted-foreground mb-2">Analyze and refactor code</p>
                    <div className="bg-muted p-3 rounded-lg">
                      <pre className="text-[11px] overflow-x-auto">
{`{
  "code": "// your code here",
  "task": "refactor"
}`}
                      </pre>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Examples Tab */}
          <TabsContent value="examples" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Example Use Cases</CardTitle>
                <CardDescription>Real-world examples of AI-powered development</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="border-l-4 border-primary pl-4">
                    <h3 className="font-semibold mb-1">Building a Blog Platform</h3>
                    <p className="text-[13px] text-muted-foreground">
                      Use AI to generate the entire blog architecture, from database schema to authentication and post management.
                    </p>
                  </div>
                  
                  <div className="border-l-4 border-primary pl-4">
                    <h3 className="font-semibold mb-1">E-commerce Application</h3>
                    <p className="text-[13px] text-muted-foreground">
                      Generate product catalog, shopping cart, checkout flow, and payment integration automatically.
                    </p>
                  </div>

                  <div className="border-l-4 border-primary pl-4">
                    <h3 className="font-semibold mb-1">Dashboard Analytics</h3>
                    <p className="text-[13px] text-muted-foreground">
                      Create data visualization dashboards with charts, metrics, and real-time updates.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* CTA Section */}
        <div className="mt-12 text-center">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-2">Ready to Start Building?</h2>
              <p className="text-muted-foreground mb-4">
                Try our AI-powered development tools and see how fast you can build
              </p>
              <Button size="lg" data-testid="button-get-started">
                Get Started Now
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
