import {
  CompletionContext,
  CompletionResult,
  Completion,
  autocompletion,
  CompletionSource,
} from '@codemirror/autocomplete';
import { Extension, StateEffect, StateField } from '@codemirror/state';
import { EditorView, Decoration, DecorationSet } from '@codemirror/view';

export interface AICompletionOptions {
  projectId?: string;
  modelId?: string;
  debounceMs?: number;
  maxContextLength?: number;
  confidenceThreshold?: number;
  maxSuggestions?: number;
  enabled?: boolean;
}

interface AICompletionSuggestion {
  label: string;
  text?: string;
  insertText?: string;
  kind?: string;
  detail?: string;
  documentation?: string;
  confidence?: number;
  explanation?: string;
}

interface AICompletionRequest {
  context: {
    currentFile: string;
    fileName: string;
    language: string;
    cursorPosition: {
      line: number;
      column: number;
    };
    currentLine: string;
    precedingCode: string;
    followingCode: string;
  };
  model?: string;
  triggerKind: 'automatic' | 'manual';
  maxSuggestions: number;
  temperature?: number;
}

const setAILoadingEffect = StateEffect.define<boolean>();

const aiLoadingField = StateField.define<boolean>({
  create() {
    return false;
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setAILoadingEffect)) {
        return effect.value;
      }
    }
    return value;
  },
});

const aiLoadingIndicator = EditorView.decorations.compute([aiLoadingField], (state) => {
  return Decoration.none;
});

function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let pendingPromise: {
    resolve: (value: ReturnType<T>) => void;
    reject: (error: any) => void;
  } | null = null;

  return (...args: Parameters<T>): Promise<ReturnType<T>> => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    return new Promise((resolve, reject) => {
      pendingPromise = { resolve, reject };
      
      timeoutId = setTimeout(async () => {
        try {
          const result = await fn(...args);
          if (pendingPromise) {
            pendingPromise.resolve(result);
          }
        } catch (error) {
          if (pendingPromise) {
            pendingPromise.reject(error);
          }
        } finally {
          pendingPromise = null;
          timeoutId = null;
        }
      }, delay);
    });
  };
}

function getCompletionType(kind: string | undefined): string | undefined {
  if (!kind) return undefined;
  
  const typeMap: Record<string, string> = {
    snippet: 'snippet',
    function: 'function',
    method: 'method',
    variable: 'variable',
    class: 'class',
    interface: 'interface',
    type: 'type',
    keyword: 'keyword',
    constant: 'constant',
    property: 'property',
    text: 'text',
    module: 'namespace',
    enum: 'enum',
    field: 'property',
    constructor: 'function',
    parameter: 'variable',
  };
  
  return typeMap[kind.toLowerCase()] || 'text';
}

function getLanguageFromFileName(fileName: string): string {
  const extensionToLanguage: Record<string, string> = {
    '.js': 'javascript',
    '.mjs': 'javascript',
    '.cjs': 'javascript',
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.mts': 'typescript',
    '.cts': 'typescript',
    '.tsx': 'typescript',
    '.py': 'python',
    '.pyw': 'python',
    '.json': 'json',
    '.html': 'html',
    '.htm': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.sass': 'sass',
    '.less': 'less',
    '.md': 'markdown',
    '.sql': 'sql',
    '.rs': 'rust',
    '.java': 'java',
    '.cpp': 'cpp',
    '.c': 'c',
    '.h': 'c',
    '.php': 'php',
    '.xml': 'xml',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.sh': 'shell',
    '.bash': 'bash',
    '.go': 'go',
    '.rb': 'ruby',
    '.swift': 'swift',
    '.kt': 'kotlin',
  };

  const extension = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
  return extensionToLanguage[extension] || 'plaintext';
}

async function fetchAICompletions(
  request: AICompletionRequest,
  signal?: AbortSignal
): Promise<AICompletionSuggestion[]> {
  try {
    const response = await fetch('/api/ai/completion', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(request),
      signal,
    });

    if (!response.ok) {
      if (response.status === 401) {
        console.warn('AI Completion: User not authenticated');
        return [];
      }
      throw new Error(`AI completion request failed: ${response.status}`);
    }

    const data = await response.json();
    
    if (Array.isArray(data)) {
      return data;
    }
    
    if (data.suggestions && Array.isArray(data.suggestions)) {
      return data.suggestions;
    }
    
    if (data.completions && Array.isArray(data.completions)) {
      return data.completions;
    }

    return [];
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return [];
    }
    console.error('AI Completion fetch error:', error);
    return [];
  }
}

function transformToCompletion(
  suggestion: AICompletionSuggestion,
  index: number,
  from: number,
  confidenceThreshold: number
): Completion | null {
  if (suggestion.confidence !== undefined && suggestion.confidence < confidenceThreshold) {
    return null;
  }

  const label = suggestion.label || suggestion.text || '';
  if (!label) return null;

  const insertText = suggestion.insertText || suggestion.text || label;
  const type = getCompletionType(suggestion.kind);
  
  let info: string | undefined;
  if (suggestion.documentation || suggestion.explanation) {
    const parts: string[] = [];
    if (suggestion.documentation) parts.push(suggestion.documentation);
    if (suggestion.explanation) parts.push(`\n\n**Why:** ${suggestion.explanation}`);
    info = parts.join('');
  }

  const completion: Completion = {
    label,
    type,
    detail: suggestion.detail || (suggestion.confidence 
      ? `AI (${Math.round(suggestion.confidence * 100)}%)`
      : 'AI Generated'),
    info: info ? () => {
      const dom = document.createElement('div');
      dom.className = 'cm-ai-completion-info';
      dom.innerHTML = `<div class="ai-badge">🤖 AI Generated</div><div class="ai-content">${info.replace(/\n/g, '<br>')}</div>`;
      return dom;
    } : undefined,
    apply: insertText,
    boost: 100 - index,
  };

  return completion;
}

export function createAICompletionSource(
  options: AICompletionOptions = {}
): CompletionSource {
  const {
    projectId,
    modelId,
    debounceMs = 300,
    maxContextLength = 5000,
    confidenceThreshold = 0.5,
    maxSuggestions = 5,
    enabled = true,
  } = options;

  let currentAbortController: AbortController | null = null;

  const debouncedFetch = debounce(
    async (request: AICompletionRequest, signal: AbortSignal) => {
      return fetchAICompletions(request, signal);
    },
    debounceMs
  );

  return async (context: CompletionContext): Promise<CompletionResult | null> => {
    if (!enabled) {
      return null;
    }

    if (currentAbortController) {
      currentAbortController.abort();
    }
    currentAbortController = new AbortController();
    const signal = currentAbortController.signal;

    const { state, pos } = context;
    const doc = state.doc;
    
    const line = doc.lineAt(pos);
    const currentLine = line.text;
    const column = pos - line.from;

    if (context.explicit === false) {
      const beforeCursor = currentLine.slice(0, column);
      if (beforeCursor.trim().length < 2) {
        return null;
      }
    }

    const fullText = doc.toString();
    const textBeforeCursor = fullText.slice(0, pos);
    const textAfterCursor = fullText.slice(pos);

    const precedingCode = textBeforeCursor.slice(-maxContextLength);
    const followingCode = textAfterCursor.slice(0, Math.floor(maxContextLength / 2));

    const fileName = 'untitled';
    const language = getLanguageFromFileName(fileName);

    const request: AICompletionRequest = {
      context: {
        currentFile: fullText.length > maxContextLength * 2 
          ? precedingCode + followingCode 
          : fullText,
        fileName,
        language,
        cursorPosition: {
          line: line.number,
          column: column + 1,
        },
        currentLine,
        precedingCode,
        followingCode,
      },
      model: modelId,
      triggerKind: context.explicit ? 'manual' : 'automatic',
      maxSuggestions,
      temperature: 0.2,
    };

    try {
      context.view?.dispatch({
        effects: setAILoadingEffect.of(true),
      });

      const suggestions = await debouncedFetch(request, signal);

      context.view?.dispatch({
        effects: setAILoadingEffect.of(false),
      });

      if (signal.aborted || suggestions.length === 0) {
        return null;
      }

      const word = context.matchBefore(/\w*/);
      const from = word ? word.from : pos;

      const completions: Completion[] = [];
      for (let i = 0; i < suggestions.length; i++) {
        const completion = transformToCompletion(
          suggestions[i],
          i,
          from,
          confidenceThreshold
        );
        if (completion) {
          completions.push(completion);
        }
      }

      if (completions.length === 0) {
        return null;
      }

      return {
        from,
        options: completions,
        validFor: /^\w*$/,
      };
    } catch (error: any) {
      context.view?.dispatch({
        effects: setAILoadingEffect.of(false),
      });

      if (error.name !== 'AbortError') {
        console.error('AI Completion error:', error);
      }
      return null;
    }
  };
}

export function aiCompletion(options?: AICompletionOptions): Extension {
  const source = createAICompletionSource(options);
  
  return [
    aiLoadingField,
    aiLoadingIndicator,
    autocompletion({
      override: [source],
      activateOnTyping: true,
      maxRenderedOptions: options?.maxSuggestions ?? 10,
      icons: true,
      addToOptions: [
        {
          render: (completion) => {
            if (completion.detail?.includes('AI')) {
              const span = document.createElement('span');
              span.className = 'cm-ai-completion-icon';
              span.textContent = '🤖';
              span.title = 'AI Generated';
              return span;
            }
            return null;
          },
          position: 10,
        },
      ],
    }),
    EditorView.baseTheme({
      '.cm-ai-completion-icon': {
        marginLeft: '4px',
        fontSize: '12px',
      },
      '.cm-ai-completion-info': {
        padding: '8px 12px',
        maxWidth: '400px',
      },
      '.cm-ai-completion-info .ai-badge': {
        color: '#F26207',
        fontWeight: '500',
        marginBottom: '8px',
        fontSize: '12px',
      },
      '.cm-ai-completion-info .ai-content': {
        fontSize: '13px',
        lineHeight: '1.4',
      },
      '.cm-tooltip.cm-tooltip-autocomplete': {
        '& > ul > li[aria-selected] .cm-ai-completion-icon': {
          filter: 'brightness(1.2)',
        },
      },
    }),
  ];
}

export function aiCompletionWithSource(
  customSource: CompletionSource,
  options?: AICompletionOptions
): Extension {
  const aiSource = createAICompletionSource(options);
  
  const combinedSource: CompletionSource = async (context) => {
    const [customResult, aiResult] = await Promise.all([
      customSource(context),
      aiSource(context),
    ]);

    if (!customResult && !aiResult) {
      return null;
    }

    if (!customResult) {
      return aiResult;
    }

    if (!aiResult) {
      return customResult;
    }

    return {
      from: Math.min(customResult.from, aiResult.from),
      options: [
        ...aiResult.options,
        ...customResult.options,
      ],
      validFor: customResult.validFor || aiResult.validFor,
    };
  };

  return [
    aiLoadingField,
    aiLoadingIndicator,
    autocompletion({
      override: [combinedSource],
      activateOnTyping: true,
      maxRenderedOptions: options?.maxSuggestions ?? 15,
      icons: true,
    }),
    EditorView.baseTheme({
      '.cm-ai-completion-icon': {
        marginLeft: '4px',
        fontSize: '12px',
      },
      '.cm-ai-completion-info': {
        padding: '8px 12px',
        maxWidth: '400px',
      },
      '.cm-ai-completion-info .ai-badge': {
        color: '#F26207',
        fontWeight: '500',
        marginBottom: '8px',
        fontSize: '12px',
      },
      '.cm-ai-completion-info .ai-content': {
        fontSize: '13px',
        lineHeight: '1.4',
      },
    }),
  ];
}

export function isAICompletionLoading(view: EditorView): boolean {
  return view.state.field(aiLoadingField, false) || false;
}

export { aiLoadingField, setAILoadingEffect };
