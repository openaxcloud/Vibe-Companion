import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from '@/lib/queryClient';
import { Cpu, Zap, Star, Code, Brain, Sparkles, TrendingUp, DollarSign, CheckCircle, XCircle } from "lucide-react";

interface ApiModel {
  id: string;
  name: string;
  description: string;
  provider: string;
  maxTokens?: number;
  supportsStreaming?: boolean;
  costPer1kTokens?: number;
  available?: boolean;
}

interface ModelInfo {
  id: string;
  name: string;
  description: string;
  provider: string;
  tier?: string;
  contextWindow: number;
  capabilities: string[];
  pricing: {
    input: number;
    output: number;
    currency: string;
    unit: string;
  };
  available: boolean;
}

export function AllModelsSelector() {
  const { toast } = useToast();
  const [selectedModel, setSelectedModel] = useState<string>('gpt-4.1');
  const [testPrompt, setTestPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: apiModelsData } = useQuery<{ models: ApiModel[] }>({
    queryKey: ['/api/models'],
    retry: false
  });

  const providerDisplayName = (provider: string): string => {
    const names: Record<string, string> = { openai: 'OpenAI', anthropic: 'Anthropic', gemini: 'Google', xai: 'xAI', moonshot: 'Moonshot AI', groq: 'Groq' };
    return names[provider] || provider;
  };

  const allModels: ModelInfo[] = (apiModelsData?.models || []).map((m: ApiModel) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    provider: providerDisplayName(m.provider),
    contextWindow: m.maxTokens || 128000,
    capabilities: ['Chat', 'Code', ...(m.supportsStreaming ? ['Streaming'] : [])],
    pricing: { input: (m.costPer1kTokens || 0) * 1000, output: (m.costPer1kTokens || 0) * 4000, currency: 'USD', unit: '1M tokens' },
    available: m.available !== false
  }));

  // Test model generation
  const testModel = async () => {
    if (!selectedModel || !testPrompt) {
      toast({
        title: "Input Required",
        description: "Please select a model and enter a test prompt",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    try {
      // Determine which API to use based on the model
      let endpoint = '';
      let payload = {};
      
      if (selectedModel.includes('gpt') || selectedModel === 'o1' || selectedModel === 'o1-mini' || selectedModel === 'o3') {
        endpoint = '/api/openai/generate';
        payload = {
          model: selectedModel,
          messages: [{ role: 'user', content: testPrompt }],
          temperature: 0.7,
          max_tokens: 500
        };
      } else if (selectedModel.includes('claude')) {
        endpoint = '/api/ai/generate';
        payload = {
          model: selectedModel,
          prompt: testPrompt,
          temperature: 0.7,
          max_tokens: 500
        };
      } else if (selectedModel.includes('kimi')) {
        // Moonshot AI Kimi models
        // ✅ KIMI K2 REQUIREMENTS: temperature=1.0, max_tokens>=16384 for thinking models
        const isThinkingModel = selectedModel.includes('thinking') || selectedModel.includes('moonshot-v1-128k');
        endpoint = '/api/ai/generate';
        payload = {
          model: selectedModel,
          prompt: testPrompt,
          temperature: isThinkingModel ? 1.0 : 0.7,  // KIMI REQUIREMENT 1
          max_tokens: isThinkingModel ? 16384 : 4096  // KIMI REQUIREMENT 4
        };
      } else if (selectedModel.includes('gemini')) {
        // Google Gemini models
        endpoint = '/api/ai/generate';
        payload = {
          model: selectedModel,
          prompt: testPrompt,
          temperature: 0.7,
          max_tokens: 500
        };
      } else if (selectedModel.includes('grok')) {
        // xAI Grok models
        endpoint = '/api/ai/generate';
        payload = {
          model: selectedModel,
          prompt: testPrompt,
          temperature: 0.7,
          max_tokens: 500
        };
      } else {
        // Open-source model
        endpoint = '/api/opensource/generate';
        payload = {
          model: selectedModel,
          messages: [{ role: 'user', content: testPrompt }],
          temperature: 0.7,
          max_tokens: 500
        };
      }

      const data = await apiRequest('POST', endpoint, payload);

      toast({
        title: "Model Test Successful",
        description: `${selectedModel} generated response successfully`,
      });
    } catch (error: any) {
      toast({
        title: "Test Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'openai': return <Brain className="h-4 w-4" />;
      case 'anthropic': return <Sparkles className="h-4 w-4" />;
      case 'together': return <Zap className="h-4 w-4" />;
      case 'replicate': return <Star className="h-4 w-4" />;
      case 'huggingface': return <Code className="h-4 w-4" />;
      case 'groq': return <TrendingUp className="h-4 w-4" />;
      default: return <Cpu className="h-4 w-4" />;
    }
  };

  const getTierColor = (tier?: string) => {
    switch (tier) {
      case 'flagship': return 'bg-purple-500';
      case 'specialized': return 'bg-blue-500';
      case 'efficient': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const groupedModels = allModels.reduce((acc, model) => {
    const provider = model.provider || 'Other';
    if (!acc[provider]) acc[provider] = [];
    acc[provider].push(model);
    return acc;
  }, {} as Record<string, ModelInfo[]>);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Model Hub - Complete Integration
          </CardTitle>
          <CardDescription>
            All available AI models: OpenAI, Anthropic, Google, xAI, and Moonshot AI
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="space-y-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="all">All Models</TabsTrigger>
              <TabsTrigger value="openai">OpenAI</TabsTrigger>
              <TabsTrigger value="anthropic">Anthropic</TabsTrigger>
              <TabsTrigger value="opensource">Open Source</TabsTrigger>
              <TabsTrigger value="test">Test</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              <div className="grid gap-4">
                {(Object.entries(groupedModels) as [string, ModelInfo[]][]).map(([provider, models]) => (
                  <div key={provider} className="space-y-2">
                    <h3 className="text-[13px] font-semibold flex items-center gap-2">
                      {getProviderIcon(provider)}
                      {provider}
                    </h3>
                    <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                      {models.map((model) => (
                        <Card key={model.id} className="relative">
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <CardTitle className="text-[13px]">{model.name}</CardTitle>
                                <CardDescription className="text-[11px]">
                                  {model.description}
                                </CardDescription>
                              </div>
                              {model.available ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            <div className="flex flex-wrap gap-1">
                              {model.capabilities?.slice(0, 3).map((cap: string) => (
                                <Badge key={cap} variant="secondary" className="text-[11px]">
                                  {cap}
                                </Badge>
                              ))}
                            </div>
                            {model.tier && (
                              <Badge className={`${getTierColor(model.tier)} text-white text-[11px]`}>
                                {model.tier}
                              </Badge>
                            )}
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                              <DollarSign className="h-3 w-3" />
                              <span>
                                ${model.pricing.input}/{model.pricing.output} per {model.pricing.unit}
                              </span>
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              Context: {model.contextWindow.toLocaleString()} tokens
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="openai" className="space-y-4">
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {allModels
                  .filter(m => m.provider === 'OpenAI')
                  .map((model) => (
                    <Card key={model.id}>
                      <CardHeader>
                        <CardTitle className="text-[13px]">{model.name}</CardTitle>
                        <CardDescription className="text-[11px]">{model.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Badge variant={model.available ? "default" : "destructive"}>
                          {model.available ? "Available" : "Configure API Key"}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </TabsContent>

            <TabsContent value="anthropic" className="space-y-4">
              <div className="grid gap-2 md:grid-cols-2">
                {allModels
                  .filter(m => m.provider === 'Anthropic')
                  .map((model) => (
                    <Card key={model.id}>
                      <CardHeader>
                        <CardTitle className="text-[13px]">{model.name}</CardTitle>
                        <CardDescription className="text-[11px]">{model.description}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <Badge variant={model.available ? "default" : "destructive"}>
                          {model.available ? "Available" : "Configure API Key"}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </TabsContent>

            <TabsContent value="opensource" className="space-y-4">
              <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                {allModels
                  .filter(m => !['OpenAI', 'Anthropic'].includes(m.provider))
                  .map((model) => (
                    <Card key={model.id}>
                      <CardHeader>
                        <CardTitle className="text-[13px]">{model.name}</CardTitle>
                        <CardDescription className="text-[11px]">
                          Provider: {model.provider}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <Badge className={getTierColor(model.tier)}>
                          {model.tier}
                        </Badge>
                        <Badge variant={model.available ? "default" : "destructive"}>
                          {model.available ? "Available" : "Configure API Key"}
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </TabsContent>

            <TabsContent value="test" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Test Model Generation</CardTitle>
                  <CardDescription>
                    Test any model with a sample prompt
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a model to test" />
                    </SelectTrigger>
                    <SelectContent>
                      {allModels.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name} ({model.provider})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <textarea
                    className="w-full min-h-[100px] p-3 border rounded-md"
                    placeholder="Enter a test prompt..."
                    value={testPrompt}
                    onChange={(e) => setTestPrompt(e.target.value)}
                  />

                  <Button 
                    onClick={testModel}
                    disabled={isGenerating || !selectedModel || !testPrompt}
                    className="w-full"
                  >
                    {isGenerating ? "Generating..." : "Test Model"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Integration Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-[13px]">OpenAI: GPT-4.1, GPT-4.1 Mini, GPT-4.1 Nano, o4-mini, o3</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-[13px]">Anthropic: Claude Sonnet 4, Claude Opus 4</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-[13px]">Google: Gemini 2.5 Pro, Gemini 2.5 Flash</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-[13px]">MCP Integration: All models available through MCP tools</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-[13px]">Billing System: Token tracking for all models</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}