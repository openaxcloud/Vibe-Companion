// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Brain, Sparkles, Zap, Eye, Code, FileSearch } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface OpenAIModel {
  id: string;
  name: string;
  capabilities: string[];
  contextWindow: number;
  maxOutput: number;
}

interface ModelPricing {
  input: number;
  output: number;
  creditsPerThousand: number;
}

export function OpenAIModelSelector({ 
  onModelSelect,
  selectedModel = 'gpt-4.1'
}: { 
  onModelSelect: (model: string) => void;
  selectedModel?: string;
}) {
  const [localSelectedModel, setLocalSelectedModel] = useState(selectedModel);
  
  // Fetch available models
  const { data: models, isLoading: modelsLoading } = useQuery({
    queryKey: ['/api/openai/models'],
    enabled: true
  });
  
  // Fetch model pricing
  const { data: pricing, isLoading: pricingLoading } = useQuery({
    queryKey: ['/api/ai/models/pricing'],
    enabled: true
  });
  
  const handleModelChange = (modelId: string) => {
    setLocalSelectedModel(modelId);
    onModelSelect(modelId);
  };
  
  const getModelIcon = (modelId: string) => {
    if (modelId.includes('o1')) return <Brain className="h-4 w-4" />;
    if (modelId.includes('vision')) return <Eye className="h-4 w-4" />;
    if (modelId.includes('mini')) return <Zap className="h-4 w-4" />;
    return <Sparkles className="h-4 w-4" />;
  };
  
  const getCapabilityBadge = (capability: string) => {
    const colors: Record<string, string> = {
      'chat': 'bg-blue-100 text-blue-800',
      'vision': 'bg-purple-100 text-purple-800',
      'function_calling': 'bg-green-100 text-green-800',
      'code_interpreter': 'bg-orange-100 text-orange-800',
      'file_search': 'bg-indigo-100 text-indigo-800',
      'reasoning': 'bg-red-100 text-red-800',
      'complex_analysis': 'bg-pink-100 text-pink-800'
    };
    
    return (
      <Badge 
        key={capability}
        className={colors[capability] || 'bg-gray-100 text-gray-800'}
        variant="secondary"
      >
        {capability.replace('_', ' ')}
      </Badge>
    );
  };
  
  const formatPrice = (price: number) => {
    if (price < 0.001) return `$${(price * 1000).toFixed(2)}/1K`;
    if (price < 1) return `$${price.toFixed(3)}`;
    return `$${price.toFixed(2)}`;
  };
  
  if (modelsLoading || pricingLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-10 bg-gray-200 rounded mb-4"></div>
        <div className="h-32 bg-gray-200 rounded"></div>
      </div>
    );
  }
  
  const selectedModelData = models?.find((m: OpenAIModel) => m.id === localSelectedModel);
  const selectedPricing = pricing?.[localSelectedModel];
  
  return (
    <div className="space-y-4">
      {/* Model Selector */}
      <div>
        <label className="text-[13px] font-medium mb-2 block">AI Model</label>
        <Select value={localSelectedModel} onValueChange={handleModelChange}>
          <SelectTrigger className="w-full">
            <SelectValue>
              <div className="flex items-center gap-2">
                {getModelIcon(localSelectedModel)}
                <span>{selectedModelData?.name || localSelectedModel}</span>
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {models?.map((model: OpenAIModel) => (
              <SelectItem key={model.id} value={model.id}>
                <div className="flex items-center gap-2">
                  {getModelIcon(model.id)}
                  <div>
                    <div className="font-medium">{model.name}</div>
                    <div className="text-[11px] text-gray-500">
                      {model.contextWindow.toLocaleString()} tokens
                    </div>
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      {/* Selected Model Details */}
      {selectedModelData && (
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getModelIcon(selectedModelData.id)}
              <h3 className="font-semibold">{selectedModelData.name}</h3>
            </div>
            {selectedPricing && (
              <div className="text-[13px] text-gray-600">
                <span className="font-medium">{selectedPricing.creditsPerThousand}</span> credits/1K tokens
              </div>
            )}
          </div>
          
          {/* Capabilities */}
          <div>
            <p className="text-[13px] text-gray-600 mb-2">Capabilities:</p>
            <div className="flex flex-wrap gap-1">
              {selectedModelData.capabilities.map(cap => getCapabilityBadge(cap))}
            </div>
          </div>
          
          {/* Technical Details */}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t">
            <div>
              <p className="text-[11px] text-gray-500">Context Window</p>
              <p className="font-medium">{selectedModelData.contextWindow.toLocaleString()} tokens</p>
            </div>
            <div>
              <p className="text-[11px] text-gray-500">Max Output</p>
              <p className="font-medium">{selectedModelData.maxOutput.toLocaleString()} tokens</p>
            </div>
          </div>
          
          {/* Pricing Details */}
          {selectedPricing && (
            <div className="grid grid-cols-2 gap-4 pt-2 border-t">
              <div>
                <p className="text-[11px] text-gray-500">Input Cost</p>
                <p className="font-medium">{formatPrice(selectedPricing.input)}/1M tokens</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-500">Output Cost</p>
                <p className="font-medium">{formatPrice(selectedPricing.output)}/1M tokens</p>
              </div>
            </div>
          )}
          
          {/* Special Features */}
          {localSelectedModel.includes('o1') && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-amber-800">
                <Brain className="h-4 w-4" />
                <span className="text-[13px] font-medium">Advanced Reasoning Model</span>
              </div>
              <p className="text-[11px] text-amber-700 mt-1">
                This model uses chain-of-thought reasoning for complex problems
              </p>
            </div>
          )}
          
          {localSelectedModel.includes('vision') || localSelectedModel === 'gpt-4o' && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-purple-800">
                <Eye className="h-4 w-4" />
                <span className="text-[13px] font-medium">Vision Capabilities</span>
              </div>
              <p className="text-[11px] text-purple-700 mt-1">
                Can analyze and understand images in addition to text
              </p>
            </div>
          )}
        </Card>
      )}
      
      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleModelChange('gpt-4.1')}
          className={localSelectedModel === 'gpt-4.1' ? 'border-blue-500' : ''}
        >
          <Sparkles className="h-3 w-3 mr-1" />
          GPT-4.1
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleModelChange('o3')}
          className={localSelectedModel === 'o3' ? 'border-blue-500' : ''}
        >
          <Brain className="h-3 w-3 mr-1" />
          o3
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleModelChange('gpt-4.1-nano')}
          className={localSelectedModel === 'gpt-4.1-nano' ? 'border-blue-500' : ''}
        >
          <Zap className="h-3 w-3 mr-1" />
          GPT-4.1 Nano
        </Button>
      </div>
    </div>
  );
}

export default OpenAIModelSelector;