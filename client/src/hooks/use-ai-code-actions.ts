/**
 * React hook for handling AI Code Actions events from Monaco Editor
 * Listens to custom events dispatched by AICodeActionsEnhancement and displays results via toast
 */

import { useEffect, useCallback, useState } from 'react';
import { useToast } from '@/hooks/use-toast';

// Type for AI Code Action events dispatched by Monaco editor enhancements
export interface AICodeActionEvent {
  type: 'loading' | 'result' | 'error';
  action: string;
  code?: string;
  result?: any;
  error?: string;
}

interface AICodeActionState {
  isLoading: boolean;
  lastAction: string | null;
  lastResult: any | null;
  lastError: string | null;
}

/**
 * Hook to listen for AI code action events and display feedback
 */
export function useAICodeActions() {
  const { toast } = useToast();
  const [state, setState] = useState<AICodeActionState>({
    isLoading: false,
    lastAction: null,
    lastResult: null,
    lastError: null,
  });

  const handleAIEvent = useCallback((event: CustomEvent<AICodeActionEvent>) => {
    const { type, action, result, error, code } = event.detail;

    switch (type) {
      case 'loading':
        setState(prev => ({
          ...prev,
          isLoading: true,
          lastAction: action,
          lastError: null,
        }));
        
        toast({
          title: getActionEmoji(action) + ' AI ' + capitalizeFirst(action),
          description: 'Processing your code...',
          duration: 30000,
        });
        break;

      case 'result':
        setState(prev => ({
          ...prev,
          isLoading: false,
          lastResult: result,
        }));
        
        const resultMessage = formatResultMessage(action, result);
        toast({
          title: getActionEmoji(action) + ' AI ' + capitalizeFirst(action) + ' Complete',
          description: resultMessage,
          duration: 10000,
        });
        break;

      case 'error':
        setState(prev => ({
          ...prev,
          isLoading: false,
          lastError: error || 'Unknown error',
        }));
        
        toast({
          title: '❌ AI ' + capitalizeFirst(action) + ' Failed',
          description: error || 'An unexpected error occurred',
          variant: 'destructive',
          duration: 5000,
        });
        break;
    }
  }, [toast]);

  useEffect(() => {
    const listener = (event: Event) => {
      handleAIEvent(event as CustomEvent<AICodeActionEvent>);
    };

    window.addEventListener('ai-code-action', listener);
    return () => window.removeEventListener('ai-code-action', listener);
  }, [handleAIEvent]);

  return state;
}

/**
 * Get emoji for action type
 */
function getActionEmoji(action: string): string {
  const emojiMap: Record<string, string> = {
    explain: '✨',
    debug: '🐛',
    test: '🧪',
    document: '📝',
    optimize: '⚡',
    review: '🔍',
    search: '🔎',
  };
  return emojiMap[action] || '🤖';
}

/**
 * Capitalize first letter
 */
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Format result message based on action type
 */
function formatResultMessage(action: string, result: any): string {
  if (!result) return 'No result returned';
  
  const resultText = result.result || result.suggestion || '';
  
  switch (action) {
    case 'explain':
      return resultText.length > 100 
        ? resultText.substring(0, 100) + '...' 
        : resultText;
    case 'debug':
      return 'Found potential issues. Check the console for details.';
    case 'test':
      return 'Test code generated. Check the console for full test suite.';
    case 'document':
      return 'Documentation added to your code.';
    case 'optimize':
      return 'Code optimized and applied.';
    case 'review':
      return 'Code review complete. Check the console for suggestions.';
    case 'search':
      return 'Similar code patterns found. Check the console.';
    default:
      return 'AI action completed successfully.';
  }
}

export default useAICodeActions;
