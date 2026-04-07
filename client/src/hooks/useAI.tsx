import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface AiResponse {
  completion?: string;
  explanation?: string;
  convertedCode?: string;
  documentedCode?: string;
  testCode?: string;
}

export function useAI() {
  const { toast } = useToast();
  
  // Code completion mutation
  const completionMutation = useMutation({
    mutationFn: async ({ code, language, maxTokens }: { 
      code: string; 
      language: string;
      maxTokens?: number;
    }): Promise<string> => {
      const res = await apiRequest('POST', '/api/ai/completion', { code, language, maxTokens });
      const data = await res.json();
      return data.completion;
    },
    onError: (error: Error) => {
      toast({
        title: 'AI Completion Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Code explanation mutation
  const explanationMutation = useMutation({
    mutationFn: async ({ code, language }: { 
      code: string; 
      language: string;
    }): Promise<string> => {
      const res = await apiRequest('POST', '/api/ai/explanation', { code, language });
      const data = await res.json();
      return data.explanation;
    },
    onError: (error: Error) => {
      toast({
        title: 'AI Explanation Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Code conversion mutation
  const convertMutation = useMutation({
    mutationFn: async ({ 
      code, 
      fromLanguage, 
      toLanguage 
    }: { 
      code: string;
      fromLanguage: string;
      toLanguage: string;
    }): Promise<string> => {
      const res = await apiRequest('POST', '/api/ai/convert', { code, fromLanguage, toLanguage });
      const data = await res.json();
      return data.convertedCode;
    },
    onError: (error: Error) => {
      toast({
        title: 'AI Code Conversion Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Documentation generation mutation
  const documentationMutation = useMutation({
    mutationFn: async ({ 
      code, 
      language, 
      style 
    }: { 
      code: string;
      language: string;
      style?: 'standard' | 'jsdoc' | 'google' | 'numpy';
    }): Promise<string> => {
      const res = await apiRequest('POST', '/api/ai/document', { code, language, style });
      const data = await res.json();
      return data.documentedCode;
    },
    onError: (error: Error) => {
      toast({
        title: 'AI Documentation Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Test generation mutation
  const testGenerationMutation = useMutation({
    mutationFn: async ({ 
      code, 
      language, 
      framework 
    }: { 
      code: string;
      language: string;
      framework?: string;
    }): Promise<string> => {
      const res = await apiRequest('POST', '/api/ai/tests', { code, language, framework });
      const data = await res.json();
      return data.testCode;
    },
    onError: (error: Error) => {
      toast({
        title: 'AI Test Generation Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  return {
    completionMutation,
    explanationMutation,
    convertMutation,
    documentationMutation,
    testGenerationMutation,
    isProcessing: 
      completionMutation.isPending || 
      explanationMutation.isPending || 
      convertMutation.isPending || 
      documentationMutation.isPending || 
      testGenerationMutation.isPending
  };
}