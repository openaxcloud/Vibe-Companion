/**
 * AI-powered inline code completion for CodeMirror 6
 * Provides real-time suggestions as users type
 * 
 * This file re-exports from the CM6 autocomplete adapter for convenience.
 * All Monaco-specific code has been removed in favor of CM6 compatibility.
 */

import type { Extension } from '@codemirror/state';
import type { CompletionSource } from '@codemirror/autocomplete';
import {
  aiCompletion,
  aiCompletionWithSource,
  createAICompletionSource,
  isAICompletionLoading,
  aiLoadingField,
  setAILoadingEffect,
  type AICompletionOptions,
} from './cm6/autocomplete-adapter';

export type {
  AICompletionOptions,
};

export {
  aiCompletion,
  aiCompletionWithSource,
  createAICompletionSource,
  isAICompletionLoading,
  aiLoadingField,
  setAILoadingEffect,
};

/**
 * Creates an AI code completion extension for CodeMirror 6
 * This is the primary API for adding AI completions to an editor
 */
export function createAICodeCompletionExtension(
  options?: AICompletionOptions
): Extension {
  return aiCompletion(options);
}

/**
 * Creates a completion source that can be combined with other sources
 */
export function createAICompletionProvider(
  options?: AICompletionOptions
): CompletionSource {
  return createAICompletionSource(options);
}

/**
 * Helper to check if AI completions are available
 */
export async function checkAICompletionAvailability(): Promise<boolean> {
  try {
    const response = await fetch('/api/ai/completion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        context: {
          currentFile: '// test',
          fileName: 'test.js',
          language: 'javascript',
          cursorPosition: { line: 1, column: 7 },
          currentLine: '// test',
          precedingCode: '',
          followingCode: '',
        },
        triggerKind: 'manual',
        maxSuggestions: 1,
      }),
    });
    
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * @deprecated Use createAICodeCompletionExtension instead
 * This is a no-op stub for backwards compatibility
 */
export function registerAICodeCompletion(): { dispose: () => void }[] {
  console.warn(
    '[AI Completion] registerAICodeCompletion is deprecated. ' +
    'Use createAICodeCompletionExtension with CodeMirror 6 instead.'
  );
  return [];
}

/**
 * @deprecated This class was Monaco-specific and has been removed
 * Use createAICompletionProvider or aiCompletion extension instead
 */
export class AICodeCompletionProvider {
  constructor(_projectContext?: string) {
    console.warn(
      '[AI Completion] AICodeCompletionProvider is deprecated. ' +
      'Use createAICompletionProvider or aiCompletion extension instead.'
    );
  }

  setEnabled(_enabled: boolean): void {}
  updateProjectContext(_context: string): void {}
}
