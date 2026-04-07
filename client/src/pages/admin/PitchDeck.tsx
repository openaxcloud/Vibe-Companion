// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Download, Presentation, TrendingUp, Users, Zap, Shield, Globe, Rocket, DollarSign, Award, Target, Building, Code, Cpu, Database, Cloud, Lock, BarChart3, PieChart, GitBranch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { Card } from '@/components/ui/card';

export default function PitchDeck() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect if not admin
  useEffect(() => {
    if (user && !user.isAdmin) {
      setLocation('/');
    }
  }, [user, setLocation]);

  const slides = [
    // Slide 1: Cover
    {
      title: "E-Code: The Future of Cloud Development",
      subtitle: "Building applications has never been this intelligent",
      content: (
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className="mb-12 animate-pulse">
            <Code className="w-32 h-32 text-blue-500" />
          </div>
          <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            E-Code Platform
          </h1>
          <p className="text-3xl text-muted-foreground mb-8">The Future of Cloud Development</p>
          <p className="text-xl text-muted-foreground/70 italic">Building applications has never been this intelligent</p>
          <div className="mt-12 p-6 bg-blue-50 rounded-lg">
            <p className="text-2xl font-semibold text-blue-900">
              "From Idea to Production in Minutes, Not Months"
            </p>
          </div>
          <p className="mt-8 text-[15px] text-muted-foreground">Platform: <span className="text-blue-600 font-semibold">e-code.ai</span></p>
        </div>
      )
    },
    // Slide 2: The Problem
    {
      title: "The Problem",
      subtitle: "Current Development Pain Points",
      content: (
        <div className="h-full flex flex-col justify-center">
          <h2 className="text-4xl font-bold mb-12 text-center">Current Development Pain Points</h2>
          <div className="grid grid-cols-2 gap-8 mb-12">
            <div className="bg-red-50 dark:bg-red-950/30 p-6 rounded-lg border border-red-200 dark:border-red-800">
              <h3 className="text-xl font-semibold text-red-800 dark:text-red-400 mb-3">⏰ Slow Setup</h3>
              <p className="text-foreground/80">Hours spent configuring environments</p>
            </div>
            <div className="bg-red-50 dark:bg-red-950/30 p-6 rounded-lg border border-red-200 dark:border-red-800">
              <h3 className="text-xl font-semibold text-red-800 dark:text-red-400 mb-3">👥 Limited Collaboration</h3>
              <p className="text-foreground/80">Fragmented team workflows</p>
            </div>
            <div className="bg-red-50 dark:bg-red-950/30 p-6 rounded-lg border border-red-200 dark:border-red-800">
              <h3 className="text-xl font-semibold text-red-800 dark:text-red-400 mb-3">🚀 Deployment Complexity</h3>
              <p className="text-foreground/80">Manual, error-prone processes</p>
            </div>
            <div className="bg-red-50 dark:bg-red-950/30 p-6 rounded-lg border border-red-200 dark:border-red-800">
              <h3 className="text-xl font-semibold text-red-800 dark:text-red-400 mb-3">💰 Resource Constraints</h3>
              <p className="text-foreground/80">Expensive compute for AI/ML workloads</p>
            </div>
            <div className="bg-red-50 dark:bg-red-950/30 p-6 rounded-lg border border-red-200 dark:border-red-800 col-span-2">
              <h3 className="text-xl font-semibold text-red-800 dark:text-red-400 mb-3">🔧 Tool Fragmentation</h3>
              <p className="text-foreground/80">10+ tools for simple projects</p>
            </div>
          </div>
          <div className="text-center p-8 bg-gray-900 text-white rounded-lg">
            <p className="text-3xl font-bold">85% of developer time is spent on setup, not building</p>
          </div>
        </div>
      )
    },
    // Slide 3: Market Opportunity
    {
      title: "Market Opportunity",
      subtitle: "Massive $24B+ Addressable Market Growing 22% Annually",
      content: (
        <div className="h-full overflow-y-auto">
          <h2 className="text-4xl font-bold mb-8 text-center bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
            Massive $24B+ Addressable Market Growing 22% Annually
          </h2>
          
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-6 rounded-lg">
              <h3 className="text-2xl font-bold mb-4 text-blue-900">Core Market Segments</h3>
              <ul className="space-y-2">
                <li className="flex justify-between"><span>Cloud Development Platforms:</span> <strong>$24B (22% YoY)</strong></li>
                <li className="flex justify-between"><span>AI Agent Development:</span> <strong>$8.5B (35% YoY)</strong></li>
                <li className="flex justify-between"><span>Website Builder Market:</span> <strong>$13.6B (8.1% YoY)</strong></li>
                <li className="flex justify-between"><span>Conversational AI:</span> <strong>$9.4B (23.5% YoY)</strong></li>
                <li className="flex justify-between"><span>No-Code/Low-Code:</span> <strong>$45B by 2025 (28% YoY)</strong></li>
              </ul>
            </div>
            
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-lg">
              <h3 className="text-2xl font-bold mb-4 text-green-900">Market Size</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span>Primary TAM:</span>
                  <span className="text-2xl font-bold text-green-600">$24B</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Extended TAM:</span>
                  <span className="text-2xl font-bold text-green-600">$103B+</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>SAM:</span>
                  <span className="text-xl font-bold text-green-600">$8.2B</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>SOM (10% of SAM):</span>
                  <span className="text-xl font-bold text-green-600">$820M</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-muted p-6 rounded-lg">
            <h3 className="text-2xl font-bold mb-4">Target Audience Segments</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center space-x-3">
                <Users className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="font-semibold">Individual Developers</p>
                  <p className="text-[13px] text-muted-foreground">28M users</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Building className="w-8 h-8 text-purple-600" />
                <div>
                  <p className="font-semibold">Small-Medium Teams</p>
                  <p className="text-[13px] text-muted-foreground">4.2M teams</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Award className="w-8 h-8 text-green-600" />
                <div>
                  <p className="font-semibold">Educational Institutions</p>
                  <p className="text-[13px] text-muted-foreground">180K institutions</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Target className="w-8 h-8 text-red-600" />
                <div>
                  <p className="font-semibold">Enterprise Teams</p>
                  <p className="text-[13px] text-muted-foreground">15K organizations</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    // Slide 4: The E-Code Solution
    {
      title: "The E-Code Solution",
      subtitle: "AI-First Cloud Development Platform",
      content: (
        <div className="h-full flex flex-col justify-center">
          <h2 className="text-4xl font-bold mb-6 text-center">AI-First Cloud Development Platform</h2>
          <p className="text-xl text-center mb-10 text-muted-foreground">
            E-Code is the fastest way to go from idea to app. Create and deploy full-stack applications 
            from your browser with AI at your fingertips—no installation or setup required.
          </p>
          
          <div className="grid grid-cols-3 gap-6 mb-10">
            <div className="text-center p-6 bg-blue-50 rounded-lg">
              <div className="mb-4 flex justify-center">
                <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center">
                  <Zap className="w-8 h-8 text-white" />
                </div>
              </div>
              <h3 className="font-bold text-[15px] mb-2">AI Agent</h3>
              <p className="text-[13px] text-muted-foreground">Build complete apps from natural language (Claude 4 Sonnet)</p>
            </div>
            <div className="text-center p-6 bg-green-50 rounded-lg">
              <div className="mb-4 flex justify-center">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center">
                  <Rocket className="w-8 h-8 text-white" />
                </div>
              </div>
              <h3 className="font-bold text-[15px] mb-2">Instant Setup</h3>
              <p className="text-[13px] text-muted-foreground">Zero-config development environments</p>
            </div>
            <div className="text-center p-6 bg-purple-50 rounded-lg">
              <div className="mb-4 flex justify-center">
                <div className="w-16 h-16 bg-purple-500 rounded-full flex items-center justify-center">
                  <Globe className="w-8 h-8 text-white" />
                </div>
              </div>
              <h3 className="font-bold text-[15px] mb-2">Global Infrastructure</h3>
              <p className="text-[13px] text-muted-foreground">5 regions, edge deployment</p>
            </div>
            <div className="text-center p-6 bg-orange-50 rounded-lg">
              <div className="mb-4 flex justify-center">
                <div className="w-16 h-16 bg-orange-500 rounded-full flex items-center justify-center">
                  <Cloud className="w-8 h-8 text-white" />
                </div>
              </div>
              <h3 className="font-bold text-[15px] mb-2">One-Click Deploy</h3>
              <p className="text-[13px] text-muted-foreground">From code to production instantly</p>
            </div>
            <div className="text-center p-6 bg-pink-50 rounded-lg">
              <div className="mb-4 flex justify-center">
                <div className="w-16 h-16 bg-pink-500 rounded-full flex items-center justify-center">
                  <Users className="w-8 h-8 text-white" />
                </div>
              </div>
              <h3 className="font-bold text-[15px] mb-2">Real-Time Collaboration</h3>
              <p className="text-[13px] text-muted-foreground">Up to 4 developers simultaneously</p>
            </div>
            <div className="text-center p-6 bg-indigo-50 rounded-lg">
              <div className="mb-4 flex justify-center">
                <div className="w-16 h-16 bg-indigo-500 rounded-full flex items-center justify-center">
                  <Cpu className="w-8 h-8 text-white" />
                </div>
              </div>
              <h3 className="font-bold text-[15px] mb-2">Advanced Features</h3>
              <p className="text-[13px] text-muted-foreground">GPU computing, database hosting, object storage</p>
            </div>
          </div>
          
          <div className="text-center p-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg">
            <p className="text-2xl font-bold">"Replit + GitHub Codespaces + Vercel + OpenAI = E-Code"</p>
          </div>
        </div>
      )
    },
    // Slide 5: Competitive Advantages
    {
      title: "Competitive Advantages",
      subtitle: "Why E-Code Wins - 150% of Replit's Features",
      content: (
        <div className="h-full overflow-y-auto">
          <h2 className="text-4xl font-bold mb-8 text-center">Why E-Code Wins - 150% of Replit's Features</h2>
          
          <div className="mb-8 overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted">
                  <th className="border p-3 text-left">Feature</th>
                  <th className="border p-3 text-center">E-Code</th>
                  <th className="border p-3 text-center">Replit</th>
                  <th className="border p-3 text-center">GitHub Codespaces</th>
                  <th className="border p-3 text-center">Vercel</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border p-3 font-semibold">AI Code Generation</td>
                  <td className="border p-3 text-center bg-green-50">✅ Claude 4 Sonnet</td>
                  <td className="border p-3 text-center bg-red-50">❌ Basic</td>
                  <td className="border p-3 text-center bg-red-50">❌ Limited</td>
                  <td className="border p-3 text-center bg-red-50">❌ None</td>
                </tr>
                <tr className="bg-muted/50">
                  <td className="border p-3 font-semibold">GPU Computing</td>
                  <td className="border p-3 text-center bg-green-50">✅ 6 Types</td>
                  <td className="border p-3 text-center bg-yellow-50">⚠️ 2-3 Types</td>
                  <td className="border p-3 text-center bg-red-50">❌ None</td>
                  <td className="border p-3 text-center bg-red-50">❌ None</td>
                </tr>
                <tr>
                  <td className="border p-3 font-semibold">Languages Supported</td>
                  <td className="border p-3 text-center bg-green-50">✅ 18+</td>
                  <td className="border p-3 text-center bg-green-50">✅ 18+</td>
                  <td className="border p-3 text-center bg-green-50">✅ Most</td>
                  <td className="border p-3 text-center bg-yellow-50">⚠️ Limited</td>
                </tr>
                <tr className="bg-muted/50">
                  <td className="border p-3 font-semibold">Real-time Collaboration</td>
                  <td className="border p-3 text-center bg-green-50">✅ 4 users</td>
                  <td className="border p-3 text-center bg-green-50">✅ Limited</td>
                  <td className="border p-3 text-center bg-red-50">❌ None</td>
                  <td className="border p-3 text-center bg-red-50">❌ None</td>
                </tr>
                <tr>
                  <td className="border p-3 font-semibold">Enterprise Features</td>
                  <td className="border p-3 text-center bg-green-50">✅ Full Suite</td>
                  <td className="border p-3 text-center bg-yellow-50">⚠️ Basic</td>
                  <td className="border p-3 text-center bg-green-50">✅ Good</td>
                  <td className="border p-3 text-center bg-yellow-50">⚠️ Limited</td>
                </tr>
                <tr className="bg-muted/50">
                  <td className="border p-3 font-semibold">Authentication Providers</td>
                  <td className="border p-3 text-center bg-green-50">✅ 7 OAuth</td>
                  <td className="border p-3 text-center bg-yellow-50">⚠️ 3-4</td>
                  <td className="border p-3 text-center bg-green-50">✅ GitHub</td>
                  <td className="border p-3 text-center bg-yellow-50">⚠️ Limited</td>
                </tr>
                <tr>
                  <td className="border p-3 font-semibold">Pricing</td>
                  <td className="border p-3 text-center bg-green-50">✅ $20/mo</td>
                  <td className="border p-3 text-center bg-green-50">✅ $20/mo</td>
                  <td className="border p-3 text-center bg-red-50">❌ $45/mo</td>
                  <td className="border p-3 text-center bg-green-50">✅ Free tier</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div className="bg-blue-50 p-6 rounded-lg">
            <h3 className="text-2xl font-bold mb-4">Recent Funding Activity (Competitive Landscape)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-card p-4 rounded">
                <p className="font-semibold">Replit: $97.4M Series B</p>
                <p className="text-[13px] text-muted-foreground">April 2022 - $1.16B valuation</p>
              </div>
              <div className="bg-card p-4 rounded">
                <p className="font-semibold">Cursor: $60M Series A</p>
                <p className="text-[13px] text-muted-foreground">July 2024 - $400M valuation</p>
              </div>
              <div className="bg-card p-4 rounded">
                <p className="font-semibold">v0 (Vercel): $250M Series E</p>
                <p className="text-[13px] text-muted-foreground">May 2024 - $2.25B valuation</p>
              </div>
              <div className="bg-card p-4 rounded">
                <p className="font-semibold">Bolt.new: $450M Series D</p>
                <p className="text-[13px] text-muted-foreground">October 2024 - $6B valuation</p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    // Slide 6: Technology & Platform Strategy
    {
      title: "Technology & Platform Strategy",
      subtitle: "Enterprise-Grade Architecture",
      content: (
        <div className="h-full overflow-y-auto">
          <h2 className="text-4xl font-bold mb-8 text-center">Enterprise-Grade Architecture</h2>
          
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-6 rounded-lg">
              <h3 className="text-2xl font-bold mb-4 text-blue-900">Core Platform Components</h3>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <Code className="w-5 h-5 mt-1 mr-3 text-blue-600 flex-shrink-0" />
                  <span>Proprietary cloud-native architecture</span>
                </li>
                <li className="flex items-start">
                  <Zap className="w-5 h-5 mt-1 mr-3 text-blue-600 flex-shrink-0" />
                  <span>Advanced autonomous coding capabilities</span>
                </li>
                <li className="flex items-start">
                  <Database className="w-5 h-5 mt-1 mr-3 text-blue-600 flex-shrink-0" />
                  <span>Comprehensive SDK and integration tools</span>
                </li>
                <li className="flex items-start">
                  <Building className="w-5 h-5 mt-1 mr-3 text-blue-600 flex-shrink-0" />
                  <span>Third-party marketplace and extensions</span>
                </li>
              </ul>
            </div>
            
            <div className="space-y-6">
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-bold mb-2 text-foreground">Frontend Stack</h4>
                <p className="text-[13px]">React.js + TypeScript + Tailwind CSS</p>
                <p className="text-[13px]">Monaco Editor (VS Code engine)</p>
                <p className="text-[13px]">Real-time WebSocket collaboration</p>
              </div>
              
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-bold mb-2 text-foreground">Backend Stack</h4>
                <p className="text-[13px]">Node.js + Express + PostgreSQL</p>
                <p className="text-[13px]">Drizzle ORM + Docker containerization</p>
                <p className="text-[13px]">Kubernetes orchestration</p>
              </div>
              
              <div className="bg-muted p-4 rounded-lg">
                <h4 className="font-bold mb-2 text-foreground">AI/ML Integration</h4>
                <p className="text-[13px]">Anthropic Claude 4 Sonnet</p>
                <p className="text-[13px]">Advanced context awareness</p>
                <p className="text-[13px]">Multi-modal code generation</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-lg">
            <h3 className="text-2xl font-bold mb-4 text-green-900">Infrastructure Excellence</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <Globe className="w-12 h-12 mx-auto mb-2 text-green-600" />
                <p className="font-semibold">Multi-region deployment</p>
                <p className="text-[13px] text-muted-foreground">5 regions globally</p>
              </div>
              <div className="text-center">
                <Shield className="w-12 h-12 mx-auto mb-2 text-green-600" />
                <p className="font-semibold">Enterprise Security</p>
                <p className="text-[13px] text-muted-foreground">SOC2, GDPR compliant</p>
              </div>
              <div className="text-center">
                <Rocket className="w-12 h-12 mx-auto mb-2 text-green-600" />
                <p className="font-semibold">Edge Computing</p>
                <p className="text-[13px] text-muted-foreground">Sub-50ms latency</p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    // Slide 7: Product Demonstration
    {
      title: "Product Demonstration",
      subtitle: "Live Demo: Complete Application in 3 Minutes",
      content: (
        <div className="h-full flex flex-col justify-center">
          <h2 className="text-4xl font-bold mb-8 text-center">Live Demo: "Complete Application in 3 Minutes"</h2>
          
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-8 rounded-lg text-white mb-8">
            <h3 className="text-2xl font-bold mb-6">Demo Flow</h3>
            <div className="space-y-4">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-white text-blue-600 rounded-full flex items-center justify-center font-bold mr-4">1</div>
                <div>
                  <p className="font-semibold">Prompt</p>
                  <p className="text-blue-100">"Create a full-stack e-commerce application"</p>
                </div>
              </div>
              <div className="flex items-center">
                <div className="w-10 h-10 bg-white text-blue-600 rounded-full flex items-center justify-center font-bold mr-4">2</div>
                <div>
                  <p className="font-semibold">AI Agent</p>
                  <p className="text-blue-100">Automatically generates React + Node.js application</p>
                </div>
              </div>
              <div className="flex items-center">
                <div className="w-10 h-10 bg-white text-blue-600 rounded-full flex items-center justify-center font-bold mr-4">3</div>
                <div>
                  <p className="font-semibold">Real-time Preview</p>
                  <p className="text-blue-100">Instant visual feedback with live updates</p>
                </div>
              </div>
              <div className="flex items-center">
                <div className="w-10 h-10 bg-white text-blue-600 rounded-full flex items-center justify-center font-bold mr-4">4</div>
                <div>
                  <p className="font-semibold">One-Click Deploy</p>
                  <p className="text-blue-100">Live on the web in seconds</p>
                </div>
              </div>
              <div className="flex items-center">
                <div className="w-10 h-10 bg-white text-blue-600 rounded-full flex items-center justify-center font-bold mr-4">5</div>
                <div>
                  <p className="font-semibold">Team Collaboration</p>
                  <p className="text-blue-100">Multiple developers editing simultaneously</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-green-50 p-4 rounded-lg text-center">
              <p className="text-3xl font-bold text-green-600">30 sec</p>
              <p className="text-[13px] text-muted-foreground">Setup time</p>
              <p className="text-[11px] text-muted-foreground/70">(vs 2+ hours)</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg text-center">
              <p className="text-3xl font-bold text-blue-600">2,000+</p>
              <p className="text-[13px] text-muted-foreground">Lines generated</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg text-center">
              <p className="text-3xl font-bold text-purple-600">3 min</p>
              <p className="text-[13px] text-muted-foreground">To deployment</p>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg text-center">
              <p className="text-3xl font-bold text-orange-600">&lt;50ms</p>
              <p className="text-[13px] text-muted-foreground">Collab latency</p>
            </div>
          </div>
        </div>
      )
    },
    // Slide 8: Advanced Features & Capabilities
    {
      title: "Advanced Features & Capabilities",
      subtitle: "Industry-Leading Feature Set",
      content: (
        <div className="h-full overflow-y-auto">
          <h2 className="text-4xl font-bold mb-8 text-center">Industry-Leading Feature Set</h2>
          
          <div className="grid grid-cols-2 gap-8">
            <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-lg">
              <h3 className="text-2xl font-bold mb-4 text-purple-900">GPU Computing - Industry Leading</h3>
              <p className="text-[15px] font-semibold mb-3">6 GPU Types (vs Replit's 2-3)</p>
              <div className="space-y-2">
                <div className="flex justify-between text-[13px]">
                  <span>NVIDIA T4</span>
                  <span className="font-mono bg-purple-100 px-2 rounded">$0.35/hour - Inference</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span>NVIDIA V100</span>
                  <span className="font-mono bg-purple-100 px-2 rounded">$2.48/hour - Training</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span>NVIDIA A100 40GB</span>
                  <span className="font-mono bg-purple-100 px-2 rounded">$4.10/hour - Enterprise AI</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span>NVIDIA A100 80GB</span>
                  <span className="font-mono bg-purple-100 px-2 rounded">$5.50/hour - Large models</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span>NVIDIA H100</span>
                  <span className="font-mono bg-purple-100 px-2 rounded">$8.00/hour - Latest gen</span>
                </div>
                <div className="flex justify-between text-[13px]">
                  <span>RTX 4090</span>
                  <span className="font-mono bg-purple-100 px-2 rounded">$1.20/hour - Development</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="bg-blue-50 p-6 rounded-lg">
                <h3 className="text-xl font-bold mb-3 text-blue-900">Enhanced Authentication</h3>
                <p className="text-[13px] mb-2"><strong>7 OAuth Providers:</strong></p>
                <p className="text-[13px] text-muted-foreground">GitHub, Google, GitLab, Bitbucket, Discord, Slack, Azure AD</p>
                <ul className="mt-3 space-y-1 text-[13px]">
                  <li>• Hardware security key support (YubiKey)</li>
                  <li>• Advanced session management</li>
                  <li>• IP allowlisting</li>
                </ul>
              </div>
              
              <div className="bg-green-50 p-6 rounded-lg">
                <h3 className="text-xl font-bold mb-3 text-green-900">Global Infrastructure</h3>
                <ul className="space-y-2 text-[13px]">
                  <li className="flex items-center">
                    <Globe className="w-4 h-4 mr-2 text-green-600" />
                    5 Regions with edge deployment
                  </li>
                  <li className="flex items-center">
                    <Zap className="w-4 h-4 mr-2 text-green-600" />
                    Latency-based routing
                  </li>
                  <li className="flex items-center">
                    <Shield className="w-4 h-4 mr-2 text-green-600" />
                    Automatic failover and CDN integration
                  </li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="mt-8 grid grid-cols-3 gap-4">
            <div className="bg-muted p-4 rounded-lg text-center">
              <Database className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="font-semibold">Database Hosting</p>
              <p className="text-[13px] text-muted-foreground">PostgreSQL, MySQL, Redis</p>
            </div>
            <div className="bg-muted p-4 rounded-lg text-center">
              <Cloud className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="font-semibold">Object Storage</p>
              <p className="text-[13px] text-muted-foreground">S3-compatible APIs</p>
            </div>
            <div className="bg-muted p-4 rounded-lg text-center">
              <Lock className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="font-semibold">Secret Management</p>
              <p className="text-[13px] text-muted-foreground">Encrypted vault</p>
            </div>
          </div>
        </div>
      )
    },
    // Slide 9: Market Traction & Validation
    {
      title: "Market Traction & Validation",
      subtitle: "Strong Early Indicators",
      content: (
        <div className="h-full flex flex-col justify-center">
          <h2 className="text-4xl font-bold mb-10 text-center">Strong Early Indicators</h2>
          
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h3 className="text-2xl font-bold mb-6 text-blue-600">User Metrics</h3>
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg flex justify-between items-center">
                  <span className="font-semibold">Developers signed up</span>
                  <span className="text-2xl font-bold text-blue-600">25,000+</span>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg flex justify-between items-center">
                  <span className="font-semibold">Projects created daily</span>
                  <span className="text-2xl font-bold text-blue-600">500+</span>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg flex justify-between items-center">
                  <span className="font-semibold">User retention rate</span>
                  <span className="text-2xl font-bold text-blue-600">87%</span>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg flex justify-between items-center">
                  <span className="font-semibold">Average user rating</span>
                  <span className="text-2xl font-bold text-blue-600">4.9/5</span>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-2xl font-bold mb-6 text-green-600">Enterprise Validation</h3>
              <div className="space-y-4">
                <div className="bg-green-50 p-4 rounded-lg flex justify-between items-center">
                  <span className="font-semibold">Universities using</span>
                  <span className="text-2xl font-bold text-green-600">50+</span>
                </div>
                <div className="bg-green-50 p-4 rounded-lg flex justify-between items-center">
                  <span className="font-semibold">Companies building MVPs</span>
                  <span className="text-2xl font-bold text-green-600">300+</span>
                </div>
                <div className="bg-green-50 p-4 rounded-lg flex justify-between items-center">
                  <span className="font-semibold">Fortune 500 evaluations</span>
                  <span className="text-2xl font-bold text-green-600">25+</span>
                </div>
                <div className="bg-green-50 p-4 rounded-lg flex justify-between items-center">
                  <span className="font-semibold">Freelancers & indies</span>
                  <span className="text-2xl font-bold text-green-600">1,000+</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-8 bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-lg">
            <h3 className="text-2xl font-bold mb-4 text-purple-900 text-center">Platform Usage</h3>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-3xl font-bold text-purple-600">150K+</p>
                <p className="text-[13px] text-muted-foreground">Total projects</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-purple-600">2.5M+</p>
                <p className="text-[13px] text-muted-foreground">AI-generated lines</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-purple-600">50K+</p>
                <p className="text-[13px] text-muted-foreground">Deployments</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-purple-600">99.9%</p>
                <p className="text-[13px] text-muted-foreground">Uptime SLA</p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    // Slide 10: Revenue Model & Projections
    {
      title: "Revenue Model & Projections",
      subtitle: "Multiple High-Margin Revenue Streams",
      content: (
        <div className="h-full overflow-y-auto">
          <h2 className="text-4xl font-bold mb-8 text-center">Multiple High-Margin Revenue Streams</h2>
          
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div className="bg-blue-50 p-6 rounded-lg">
              <h3 className="text-2xl font-bold mb-4 text-blue-900">Subscription Tiers</h3>
              <div className="space-y-3">
                <div className="bg-card p-3 rounded">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Free</span>
                    <span className="text-muted-foreground">Basic features</span>
                  </div>
                  <p className="text-[13px] text-muted-foreground/70 mt-1">Public projects only</p>
                </div>
                <div className="bg-card p-3 rounded">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Core</span>
                    <span className="text-blue-600 font-bold">$20/mo</span>
                  </div>
                  <p className="text-[13px] text-muted-foreground/70 mt-1">Private projects, AI features, $25 credits</p>
                </div>
                <div className="bg-card p-3 rounded">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Teams</span>
                    <span className="text-blue-600 font-bold">$40/user/mo</span>
                  </div>
                  <p className="text-[13px] text-muted-foreground/70 mt-1">Team management, $40 credits, advanced</p>
                </div>
                <div className="bg-card p-3 rounded">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Enterprise</span>
                    <span className="text-blue-600 font-bold">Custom</span>
                  </div>
                  <p className="text-[13px] text-muted-foreground/70 mt-1">SSO, compliance, dedicated support</p>
                </div>
              </div>
            </div>
            
            <div className="bg-green-50 p-6 rounded-lg">
              <h3 className="text-2xl font-bold mb-4 text-green-900">Usage-Based Revenue (High Margin)</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-semibold">GPU Computing</span>
                  <span className="text-[13px] bg-green-100 px-2 py-1 rounded">$0.35-$8.00/hr (40% margin)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold">AI Agent Usage</span>
                  <span className="text-[13px] bg-green-100 px-2 py-1 rounded">$0.10-$2.00/generation</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Deployment</span>
                  <span className="text-[13px] bg-green-100 px-2 py-1 rounded">$0.02/hr + bandwidth</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-semibold">Storage & Database</span>
                  <span className="text-[13px] bg-green-100 px-2 py-1 rounded">$0.15/GB/month</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-lg">
            <h3 className="text-2xl font-bold mb-4 text-purple-900">Revenue Projections (Conservative Market Capture)</h3>
            <div className="grid grid-cols-2 gap-8">
              <div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Year 1</span>
                    <div className="text-right">
                      <p className="text-xl font-bold text-purple-600">$2.4M ARR</p>
                      <p className="text-[11px] text-muted-foreground">6,000 users, 0.024% market</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Year 2</span>
                    <div className="text-right">
                      <p className="text-xl font-bold text-purple-600">$12M ARR</p>
                      <p className="text-[11px] text-muted-foreground">25,000 users, 0.10% market</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Year 3</span>
                    <div className="text-right">
                      <p className="text-xl font-bold text-purple-600">$48M ARR</p>
                      <p className="text-[11px] text-muted-foreground">100,000 users, 0.35% market</p>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Year 4</span>
                    <div className="text-right">
                      <p className="text-xl font-bold text-purple-600">$180M ARR</p>
                      <p className="text-[11px] text-muted-foreground">300,000 users, 1.2% market</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Year 5</span>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-purple-600">$240M ARR</p>
                      <p className="text-[11px] text-muted-foreground">500,000 users, 1.8% market</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    // Slide 11: Financial Projections
    {
      title: "Financial Projections",
      subtitle: "Path to $240M ARR by Year 5",
      content: (
        <div className="h-full overflow-y-auto">
          <h2 className="text-4xl font-bold mb-8 text-center">Path to $240M ARR by Year 5</h2>
          
          <div className="mb-8 overflow-x-auto">
            <table className="w-full border-collapse bg-card rounded-lg overflow-hidden shadow-sm">
              <thead>
                <tr className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                  <th className="p-3 text-left">Metric</th>
                  <th className="p-3 text-center">Year 1</th>
                  <th className="p-3 text-center">Year 2</th>
                  <th className="p-3 text-center">Year 3</th>
                  <th className="p-3 text-center">Year 4</th>
                  <th className="p-3 text-center">Year 5</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="p-3 font-semibold">Total Users</td>
                  <td className="p-3 text-center">75K</td>
                  <td className="p-3 text-center">250K</td>
                  <td className="p-3 text-center">500K</td>
                  <td className="p-3 text-center">1M</td>
                  <td className="p-3 text-center font-bold">2M</td>
                </tr>
                <tr className="border-b bg-muted/50">
                  <td className="p-3 font-semibold">Paying Users</td>
                  <td className="p-3 text-center">6K</td>
                  <td className="p-3 text-center">25K</td>
                  <td className="p-3 text-center">100K</td>
                  <td className="p-3 text-center">300K</td>
                  <td className="p-3 text-center font-bold">500K</td>
                </tr>
                <tr className="border-b">
                  <td className="p-3 font-semibold">Conversion Rate</td>
                  <td className="p-3 text-center">8%</td>
                  <td className="p-3 text-center">10%</td>
                  <td className="p-3 text-center">20%</td>
                  <td className="p-3 text-center">30%</td>
                  <td className="p-3 text-center font-bold">25%</td>
                </tr>
                <tr className="border-b bg-muted/50">
                  <td className="p-3 font-semibold">ARPU (Annual)</td>
                  <td className="p-3 text-center">$400</td>
                  <td className="p-3 text-center">$480</td>
                  <td className="p-3 text-center">$480</td>
                  <td className="p-3 text-center">$600</td>
                  <td className="p-3 text-center font-bold">$480</td>
                </tr>
                <tr className="border-b bg-blue-50">
                  <td className="p-3 font-semibold text-blue-900">Revenue</td>
                  <td className="p-3 text-center font-bold text-blue-600">$2.4M</td>
                  <td className="p-3 text-center font-bold text-blue-600">$12M</td>
                  <td className="p-3 text-center font-bold text-blue-600">$48M</td>
                  <td className="p-3 text-center font-bold text-blue-600">$180M</td>
                  <td className="p-3 text-center font-bold text-blue-600 text-xl">$240M</td>
                </tr>
                <tr className="border-b">
                  <td className="p-3 font-semibold">Gross Margin</td>
                  <td className="p-3 text-center">78%</td>
                  <td className="p-3 text-center">82%</td>
                  <td className="p-3 text-center">85%</td>
                  <td className="p-3 text-center">87%</td>
                  <td className="p-3 text-center font-bold">88%</td>
                </tr>
                <tr className="bg-muted/50">
                  <td className="p-3 font-semibold">Burn Rate</td>
                  <td className="p-3 text-center">$800K/mo</td>
                  <td className="p-3 text-center">$1.8M/mo</td>
                  <td className="p-3 text-center">$4M/mo</td>
                  <td className="p-3 text-center">$8M/mo</td>
                  <td className="p-3 text-center">$12M/mo</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-lg">
            <h3 className="text-2xl font-bold mb-4 text-green-900">Key Growth Drivers</h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="flex items-start">
                <Building className="w-6 h-6 mt-1 mr-3 text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Enterprise adoption</p>
                  <p className="text-[13px] text-muted-foreground">Higher ARPU, longer contracts</p>
                </div>
              </div>
              <div className="flex items-start">
                <Cpu className="w-6 h-6 mt-1 mr-3 text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold">GPU usage expansion</p>
                  <p className="text-[13px] text-muted-foreground">High margin compute revenue</p>
                </div>
              </div>
              <div className="flex items-start">
                <Globe className="w-6 h-6 mt-1 mr-3 text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold">International markets</p>
                  <p className="text-[13px] text-muted-foreground">EU, APAC expansion</p>
                </div>
              </div>
              <div className="flex items-start">
                <GitBranch className="w-6 h-6 mt-1 mr-3 text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Platform ecosystem</p>
                  <p className="text-[13px] text-muted-foreground">Marketplace revenue share</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    // Slide 12: Go-to-Market Strategy
    {
      title: "Go-to-Market Strategy",
      subtitle: "Multi-Channel Enterprise Growth",
      content: (
        <div className="h-full overflow-y-auto">
          <h2 className="text-4xl font-bold mb-8 text-center">Multi-Channel Enterprise Growth</h2>
          
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-lg">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold mr-4">1</div>
                <div>
                  <h3 className="text-2xl font-bold text-blue-900">Phase 1: Developer Community (Months 1-6)</h3>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 ml-16">
                <ul className="space-y-2">
                  <li className="flex items-center">
                    <Code className="w-4 h-4 mr-2 text-blue-600" />
                    Open source core components
                  </li>
                  <li className="flex items-center">
                    <Users className="w-4 h-4 mr-2 text-blue-600" />
                    Developer conferences & hackathons
                  </li>
                </ul>
                <ul className="space-y-2">
                  <li className="flex items-center">
                    <TrendingUp className="w-4 h-4 mr-2 text-blue-600" />
                    Technical content marketing
                  </li>
                  <li className="flex items-center">
                    <GitBranch className="w-4 h-4 mr-2 text-blue-600" />
                    GitHub/GitLab integrations
                  </li>
                </ul>
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-green-50 to-green-100 p-6 rounded-lg">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-green-600 text-white rounded-full flex items-center justify-center font-bold mr-4">2</div>
                <div>
                  <h3 className="text-2xl font-bold text-green-900">Phase 2: Educational Market (Months 6-12)</h3>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 ml-16">
                <ul className="space-y-2">
                  <li className="flex items-center">
                    <Award className="w-4 h-4 mr-2 text-green-600" />
                    University partnerships (50+ institutions)
                  </li>
                  <li className="flex items-center">
                    <Code className="w-4 h-4 mr-2 text-green-600" />
                    CS curriculum integration
                  </li>
                </ul>
                <ul className="space-y-2">
                  <li className="flex items-center">
                    <Users className="w-4 h-4 mr-2 text-green-600" />
                    Student developer programs
                  </li>
                  <li className="flex items-center">
                    <Award className="w-4 h-4 mr-2 text-green-600" />
                    Educator training and certification
                  </li>
                </ul>
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-purple-50 to-purple-100 p-6 rounded-lg">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-purple-600 text-white rounded-full flex items-center justify-center font-bold mr-4">3</div>
                <div>
                  <h3 className="text-2xl font-bold text-purple-900">Phase 3: Enterprise Sales (Months 12-18)</h3>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 ml-16">
                <ul className="space-y-2">
                  <li className="flex items-center">
                    <Building className="w-4 h-4 mr-2 text-purple-600" />
                    Direct enterprise sales team
                  </li>
                  <li className="flex items-center">
                    <Shield className="w-4 h-4 mr-2 text-purple-600" />
                    Solution engineering support
                  </li>
                </ul>
                <ul className="space-y-2">
                  <li className="flex items-center">
                    <Lock className="w-4 h-4 mr-2 text-purple-600" />
                    Custom enterprise features
                  </li>
                  <li className="flex items-center">
                    <Shield className="w-4 h-4 mr-2 text-purple-600" />
                    Compliance certifications (SOC2, GDPR, HIPAA)
                  </li>
                </ul>
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-orange-50 to-orange-100 p-6 rounded-lg">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-orange-600 text-white rounded-full flex items-center justify-center font-bold mr-4">4</div>
                <div>
                  <h3 className="text-2xl font-bold text-orange-900">Phase 4: Platform Ecosystem (Months 18+)</h3>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 ml-16">
                <ul className="space-y-2">
                  <li className="flex items-center">
                    <Building className="w-4 h-4 mr-2 text-orange-600" />
                    Third-party integrations marketplace
                  </li>
                  <li className="flex items-center">
                    <Code className="w-4 h-4 mr-2 text-orange-600" />
                    Template and extension ecosystem
                  </li>
                </ul>
                <ul className="space-y-2">
                  <li className="flex items-center">
                    <Globe className="w-4 h-4 mr-2 text-orange-600" />
                    API partnerships and white-label
                  </li>
                  <li className="flex items-center">
                    <Globe className="w-4 h-4 mr-2 text-orange-600" />
                    International expansion (EU, APAC)
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )
    },
    // Slide 13: Team & Advisory Excellence
    {
      title: "Team & Advisory Excellence",
      subtitle: "World-Class Leadership Team",
      content: (
        <div className="h-full overflow-y-auto">
          <h2 className="text-4xl font-bold mb-8 text-center">World-Class Leadership Team</h2>
          
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-6 rounded-lg">
              <h3 className="text-2xl font-bold mb-6 text-blue-900">Core Leadership</h3>
              <div className="space-y-4">
                <div className="bg-card p-4 rounded-lg shadow-sm">
                  <p className="font-bold text-[15px]">CEO/CTO</p>
                  <p className="text-muted-foreground">Former Google Cloud Platform architect</p>
                  <p className="text-[13px] text-muted-foreground/70">15+ years experience</p>
                </div>
                <div className="bg-card p-4 rounded-lg shadow-sm">
                  <p className="font-bold text-[15px]">VP Engineering</p>
                  <p className="text-muted-foreground">Ex-Microsoft Azure, AI/ML research background</p>
                </div>
                <div className="bg-card p-4 rounded-lg shadow-sm">
                  <p className="font-bold text-[15px]">Head of Product</p>
                  <p className="text-muted-foreground">Former GitHub product lead, developer tools expert</p>
                </div>
                <div className="bg-card p-4 rounded-lg shadow-sm">
                  <p className="font-bold text-[15px]">VP Sales</p>
                  <p className="text-muted-foreground">Ex-Salesforce enterprise sales</p>
                  <p className="text-[13px] text-muted-foreground/70">$100M+ ARR experience</p>
                </div>
              </div>
            </div>
            
            <div>
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-lg mb-6">
                <h3 className="text-2xl font-bold mb-4 text-green-900">Technical Team</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Senior Engineers</span>
                    <span className="bg-green-100 px-3 py-1 rounded-full text-[13px]">12 people</span>
                  </div>
                  <p className="text-[13px] text-muted-foreground ml-4">Average 12 years experience, top-tier companies</p>
                  
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">AI/ML Engineers</span>
                    <span className="bg-green-100 px-3 py-1 rounded-full text-[13px]">4 people</span>
                  </div>
                  <p className="text-[13px] text-muted-foreground ml-4">PhD-level expertise, published researchers</p>
                  
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">DevOps/Infrastructure</span>
                    <span className="bg-green-100 px-3 py-1 rounded-full text-[13px]">3 people</span>
                  </div>
                  <p className="text-[13px] text-muted-foreground ml-4">Kubernetes and cloud architecture specialists</p>
                  
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Security Engineers</span>
                    <span className="bg-green-100 px-3 py-1 rounded-full text-[13px]">2 people</span>
                  </div>
                  <p className="text-[13px] text-muted-foreground ml-4">Enterprise compliance and cybersecurity</p>
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-lg">
                <h3 className="text-xl font-bold mb-4 text-purple-900">Advisory Board</h3>
                <ul className="space-y-2 text-[13px]">
                  <li className="flex items-center">
                    <Award className="w-4 h-4 mr-2 text-purple-600" />
                    <span><strong>Replit Co-founder</strong> - Developer Tools Strategy</span>
                  </li>
                  <li className="flex items-center">
                    <Award className="w-4 h-4 mr-2 text-purple-600" />
                    <span><strong>Ex-VP Engineering Vercel</strong> - Cloud Deployment</span>
                  </li>
                  <li className="flex items-center">
                    <Award className="w-4 h-4 mr-2 text-purple-600" />
                    <span><strong>Stanford CS Professor</strong> - Education Market</span>
                  </li>
                  <li className="flex items-center">
                    <Award className="w-4 h-4 mr-2 text-purple-600" />
                    <span><strong>Fortune 500 CTO</strong> - Enterprise Requirements</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-900 text-white p-6 rounded-lg text-center">
            <p className="text-3xl font-bold mb-2">Total Team: 35 people</p>
            <p className="text-xl">70% engineering focus</p>
          </div>
        </div>
      )
    },
    // Slide 14: Funding Requirements
    {
      title: "Funding Requirements",
      subtitle: "$25M Series A to accelerate global adoption",
      content: (
        <div className="h-full overflow-y-auto">
          <h2 className="text-4xl font-bold mb-8 text-center bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            $25M Series A to accelerate global adoption
          </h2>
          
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-6 rounded-lg">
              <h3 className="text-2xl font-bold mb-6 text-blue-900">Use of Funds (18-Month Runway)</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold">Engineering & AI</span>
                    <span className="text-xl font-bold text-blue-600">50% - $12.5M</span>
                  </div>
                  <div className="bg-blue-200 rounded-full h-4 overflow-hidden">
                    <div className="bg-blue-600 h-full" style={{width: '50%'}}></div>
                  </div>
                  <p className="text-[13px] text-muted-foreground mt-1">Scale team, enhance AI capabilities</p>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold">Sales & Marketing</span>
                    <span className="text-xl font-bold text-green-600">30% - $7.5M</span>
                  </div>
                  <div className="bg-green-200 rounded-full h-4 overflow-hidden">
                    <div className="bg-green-600 h-full" style={{width: '30%'}}></div>
                  </div>
                  <p className="text-[13px] text-muted-foreground mt-1">Enterprise go-to-market execution</p>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold">Infrastructure & GPU</span>
                    <span className="text-xl font-bold text-purple-600">15% - $3.75M</span>
                  </div>
                  <div className="bg-purple-200 rounded-full h-4 overflow-hidden">
                    <div className="bg-purple-600 h-full" style={{width: '15%'}}></div>
                  </div>
                  <p className="text-[13px] text-muted-foreground mt-1">Global expansion, compute capacity</p>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold">Operations & Compliance</span>
                    <span className="text-xl font-bold text-orange-600">5% - $1.25M</span>
                  </div>
                  <div className="bg-orange-200 rounded-full h-4 overflow-hidden">
                    <div className="bg-orange-600 h-full" style={{width: '5%'}}></div>
                  </div>
                  <p className="text-[13px] text-muted-foreground mt-1">Legal, security, enterprise readiness</p>
                </div>
              </div>
            </div>
            
            <div>
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-lg mb-6">
                <h3 className="text-xl font-bold mb-4 text-green-900">18-Month Milestones</h3>
                <ul className="space-y-3">
                  <li className="flex items-start">
                    <Target className="w-5 h-5 mt-1 mr-3 text-green-600 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">500K total users, 100K paying</p>
                    </div>
                  </li>
                  <li className="flex items-start">
                    <DollarSign className="w-5 h-5 mt-1 mr-3 text-green-600 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">$50M ARR run rate</p>
                    </div>
                  </li>
                  <li className="flex items-start">
                    <Building className="w-5 h-5 mt-1 mr-3 text-green-600 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">100+ enterprise customers</p>
                      <p className="text-[13px] text-muted-foreground">Fortune 5000 companies</p>
                    </div>
                  </li>
                  <li className="flex items-start">
                    <Globe className="w-5 h-5 mt-1 mr-3 text-green-600 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">International expansion</p>
                      <p className="text-[13px] text-muted-foreground">EU and APAC operations</p>
                    </div>
                  </li>
                  <li className="flex items-start">
                    <TrendingUp className="w-5 h-5 mt-1 mr-3 text-green-600 flex-shrink-0" />
                    <div>
                      <p className="font-semibold">Next-stage growth optionality</p>
                      <p className="text-[13px] text-muted-foreground">Profitability milestones with a path toward $200M+ valuation</p>
                    </div>
                  </li>
                </ul>
              </div>
              
              <div className="bg-gray-900 text-white p-6 rounded-lg">
                <h3 className="text-xl font-bold mb-4">Investment Terms</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Pre-money Valuation:</span>
                    <span className="font-bold">$80M</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Post-money Valuation:</span>
                    <span className="font-bold">$105M</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Use of funds:</span>
                    <span className="font-bold">Scale global adoption and reach profitability</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Board composition:</span>
                    <span className="font-bold">2 investor seats</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    // Add remaining slides here...
  ];

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const handlePrint = () => {
    window.print();
  };

  if (!user || user.username !== 'admin') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-muted/50 to-muted print:bg-white">
      {/* Header */}
      <div className="bg-background shadow-sm border-b print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation('/admin')}
                className="mr-4"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back to Admin
              </Button>
              <h1 className="text-xl font-semibold flex items-center">
                <Presentation className="w-5 h-5 mr-2" />
                E-Code Pitch Deck
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-[13px] text-muted-foreground">
                Slide {currentSlide + 1} of {slides.length}
              </span>
              <Button onClick={handlePrint} variant="outline" size="sm" data-testid="button-export-pdf">
                <Download className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-8">
        <Card className="h-[700px] relative overflow-hidden shadow-2xl print:shadow-none print:border-0">
          {/* Slide Content */}
          <div className="h-full p-12 print:p-8">
            {slides[currentSlide].content}
          </div>

          {/* Navigation */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-muted to-transparent p-6 flex items-center justify-between print:hidden">
            <Button
              onClick={prevSlide}
              variant="outline"
              size="icon"
              disabled={currentSlide === 0}
              data-testid="button-prev-slide"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            <div className="flex space-x-2">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    index === currentSlide
                      ? 'bg-blue-600 w-8'
                      : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                  }`}
                  data-testid={`button-slide-${index}`}
                />
              ))}
            </div>

            <Button
              onClick={nextSlide}
              variant="outline"
              size="icon"
              disabled={currentSlide === slides.length - 1}
              data-testid="button-next-slide"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            size: landscape;
            margin: 0.5in;
          }
          
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          
          .print\\:hidden {
            display: none !important;
          }
          
          .print\\:bg-white {
            background-color: white !important;
          }
          
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          
          .print\\:border-0 {
            border: 0 !important;
          }
          
          .print\\:p-8 {
            padding: 2rem !important;
          }
          
          /* Force page breaks between slides */
          .page-break {
            page-break-after: always;
          }
        }
      `}</style>
    </div>
  );
}