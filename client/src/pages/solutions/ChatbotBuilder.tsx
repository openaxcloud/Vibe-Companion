import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, MessageSquare, Bot, Brain, CheckCircle, Sparkles, Users, Shield } from "lucide-react";
import { Link } from "wouter";
import PublicLayout from "@/components/layout/PublicLayout";

export default function ChatbotBuilder() {
  return (
    <PublicLayout>
      <div className="container mx-auto px-4 py-12 sm:py-16 md:py-20">
        {/* Hero Section */}
        <div className="text-center max-w-4xl mx-auto mb-12 sm:mb-16 md:mb-20">
          <Badge className="mb-3 sm:mb-4 px-3 sm:px-4 py-1 sm:py-1.5 text-[11px] sm:text-[13px] font-medium bg-gradient-to-r from-violet-500 to-purple-500 text-white border-0">
            Intelligent Conversational AI
          </Badge>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6 bg-gradient-to-r from-violet-600 to-purple-600 dark:from-violet-400 dark:to-purple-400 bg-clip-text text-transparent">
            Chatbot & AI Agent Builder
          </h1>
          <p className="text-base sm:text-[15px] md:text-xl text-muted-foreground mb-6 sm:mb-8 px-4 sm:px-0">
            Create intelligent conversational agents that understand and help your users.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4 sm:px-0">
            <Link href="/register">
              <Button size="lg" className="gap-2 min-h-[44px] w-full sm:w-auto" data-testid="button-chatbotbuilder-start">
                Build Your Agent
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/ai">
              <Button size="lg" variant="outline" className="gap-2 min-h-[44px] w-full sm:w-auto" data-testid="button-chatbotbuilder-demo">
                <Bot className="h-4 w-4" />
                Try Demo Agent
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 md:gap-8 mb-12 sm:mb-16 md:mb-20">
          <Card className="p-4 sm:p-6 hover:shadow-lg transition-shadow" data-testid="card-feature-ai">
            <div className="p-2 sm:p-3 bg-violet-100 dark:bg-violet-900/20 rounded-lg w-fit mb-3 sm:mb-4">
              <Brain className="h-5 w-5 sm:h-6 sm:w-6 text-violet-600 dark:text-violet-400" />
            </div>
            <h3 className="text-[15px] sm:text-xl font-semibold mb-2">Advanced AI Models</h3>
            <p className="text-[13px] sm:text-base text-muted-foreground">
              Powered by GPT-4, Claude, and other cutting-edge language models.
            </p>
          </Card>

          <Card className="p-4 sm:p-6 hover:shadow-lg transition-shadow" data-testid="card-feature-conversations">
            <div className="p-2 sm:p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg w-fit mb-3 sm:mb-4">
              <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-[15px] sm:text-xl font-semibold mb-2">Natural Conversations</h3>
            <p className="text-[13px] sm:text-base text-muted-foreground">
              Understands context, remembers past interactions, and responds naturally.
            </p>
          </Card>

          <Card className="p-4 sm:p-6 hover:shadow-lg transition-shadow sm:col-span-2 md:col-span-1" data-testid="card-feature-training">
            <div className="p-2 sm:p-3 bg-pink-100 dark:bg-pink-900/20 rounded-lg w-fit mb-3 sm:mb-4">
              <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-pink-600 dark:text-pink-400" />
            </div>
            <h3 className="text-[15px] sm:text-xl font-semibold mb-2">Custom Training</h3>
            <p className="text-[13px] sm:text-base text-muted-foreground">
              Train on your data to create specialized agents for your business.
            </p>
          </Card>
        </div>

        {/* Use Cases */}
        <div className="mb-12 sm:mb-16 md:mb-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12">AI Agents for Every Purpose</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
            {[
              "Customer Support",
              "Sales Assistant",
              "Personal Tutor",
              "Code Helper",
              "Content Writer",
              "Research Assistant",
              "Language Translator",
              "Health Advisor"
            ].map((useCase, index) => (
              <Card key={useCase} className="p-3 sm:p-4 text-center hover:shadow-md transition-shadow" data-testid={`card-usecase-${index}`}>
                <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 mx-auto mb-1.5 sm:mb-2" />
                <p className="font-medium text-[11px] sm:text-[13px] md:text-base">{useCase}</p>
              </Card>
            ))}
          </div>
        </div>

        {/* Capabilities */}
        <div className="mb-20">
          <h2 className="text-3xl font-bold text-center mb-12">Powerful Capabilities</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-1" />
                <div>
                  <h3 className="font-semibold">Multi-language Support</h3>
                  <p className="text-[13px] text-muted-foreground">Communicate in over 100 languages fluently</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-1" />
                <div>
                  <h3 className="font-semibold">API Integration</h3>
                  <p className="text-[13px] text-muted-foreground">Connect to your systems and databases</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-1" />
                <div>
                  <h3 className="font-semibold">Voice Interaction</h3>
                  <p className="text-[13px] text-muted-foreground">Speech recognition and text-to-speech</p>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-1" />
                <div>
                  <h3 className="font-semibold">Sentiment Analysis</h3>
                  <p className="text-[13px] text-muted-foreground">Understand user emotions and adjust responses</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-1" />
                <div>
                  <h3 className="font-semibold">Knowledge Base</h3>
                  <p className="text-[13px] text-muted-foreground">Upload documents to create expert agents</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-1" />
                <div>
                  <h3 className="font-semibold">Analytics Dashboard</h3>
                  <p className="text-[13px] text-muted-foreground">Track conversations and improve over time</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Integration Options */}
        <div className="mb-12 sm:mb-16 md:mb-20">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12">Deploy Anywhere</h2>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
            <Card className="p-4 sm:p-6 text-center" data-testid="card-deploy-widget">
              <Users className="h-6 w-6 sm:h-8 sm:w-8 text-primary mx-auto mb-2 sm:mb-3" />
              <h3 className="font-semibold text-[13px] sm:text-base mb-1 sm:mb-2">Website Widget</h3>
              <p className="text-[11px] sm:text-[13px] text-muted-foreground">Embed on any website with one line of code</p>
            </Card>
            <Card className="p-4 sm:p-6 text-center" data-testid="card-deploy-messaging">
              <MessageSquare className="h-6 w-6 sm:h-8 sm:w-8 text-primary mx-auto mb-2 sm:mb-3" />
              <h3 className="font-semibold text-[13px] sm:text-base mb-1 sm:mb-2">Messaging Apps</h3>
              <p className="text-[11px] sm:text-[13px] text-muted-foreground">WhatsApp, Telegram, Discord, Slack</p>
            </Card>
            <Card className="p-4 sm:p-6 text-center sm:col-span-2 md:col-span-1" data-testid="card-deploy-api">
              <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-primary mx-auto mb-2 sm:mb-3" />
              <h3 className="font-semibold text-[13px] sm:text-base mb-1 sm:mb-2">API Access</h3>
              <p className="text-[11px] sm:text-[13px] text-muted-foreground">Integrate with any application via REST API</p>
            </Card>
          </div>
        </div>

        {/* CTA Section */}
        <Card className="p-6 sm:p-8 md:p-12 bg-gradient-to-r from-violet-600/10 to-purple-600/10 border-2 border-primary/20">
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3 sm:mb-4">Create Your Intelligent Agent Today</h2>
            <p className="text-[13px] sm:text-base md:text-[15px] text-muted-foreground mb-6 sm:mb-8 max-w-2xl mx-auto px-4 sm:px-0">
              Build AI agents that understand, learn, and help your users 24/7.
            </p>
            <Link href="/register">
              <Button size="lg" className="gap-2 min-h-[44px]" data-testid="button-chatbotbuilder-cta">
                Get Started Free
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </PublicLayout>
  );
}