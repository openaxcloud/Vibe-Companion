import { Request, Response } from 'express';
import { aiProviderManager } from './ai/ai-provider-manager';
import { ProjectContextService, ProjectContext } from './services/project-context.service';
import { storage } from './storage';
import { validateAndSetSSEHeaders } from './utils/sse-headers';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

// Get available AI providers
export async function getAvailableProviders(req: Request, res: Response) {
  try {
    const providers = aiProviderManager.getAvailableProviders();
    res.json({ providers });
  } catch (error) {
    console.error('Error getting AI providers:', error);
    res.status(500).json({ error: 'Failed to get AI providers' });
  }
}

// Generate code completion
export async function generateCompletion(req: Request, res: Response) {
  try {
    const { code, language, maxTokens = 1024, provider: providerName } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    let provider;
    if (providerName) {
      provider = aiProviderManager.getProvider(providerName);
      if (!provider) {
        return res.status(404).json({ 
          error: `Provider '${providerName}' not found`,
          code: 'PROVIDER_NOT_FOUND'
        });
      }
      if (!provider.isAvailable()) {
        return res.status(503).json({ 
          error: `Provider '${providerName}' is not configured. Please configure the required API key.`,
          code: 'PROVIDER_NOT_CONFIGURED',
          suggestion: 'Configure AI provider API keys using environment variables or Replit integrations'
        });
      }
    } else {
      provider = aiProviderManager.getDefaultProvider();
    }

    const prompt = getPromptForLanguage(language, code);
    const systemPrompt = 'You are an expert programmer that generates high-quality code completion suggestions. Complete the code in a way that follows best practices for the language and implements the functionality that seems to be intended based on variable names, comments, and existing code. Return only the suggested code to complete what was given.';

    const completion = await provider.generateCompletion(prompt, systemPrompt, maxTokens, 0.2);

    res.json({
      completion,
      provider: provider.name
    });
  } catch (error: any) {
    console.error('Error generating code completion:', error);
    
    // Check if error is due to missing API keys
    if (error.message?.includes('not configured') || error.message?.includes('Please configure')) {
      return res.status(503).json({ 
        error: error.message,
        code: 'PROVIDER_NOT_CONFIGURED',
        suggestion: 'Configure AI provider API keys using environment variables or Replit integrations'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to generate code completion',
      details: error.message 
    });
  }
}

// Generate code explanation
export async function generateExplanation(req: Request, res: Response) {
  try {
    const { code, language, provider: providerName } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    let provider;
    if (providerName) {
      provider = aiProviderManager.getProvider(providerName);
      if (!provider) {
        return res.status(404).json({ 
          error: `Provider '${providerName}' not found`,
          code: 'PROVIDER_NOT_FOUND'
        });
      }
      if (!provider.isAvailable()) {
        return res.status(503).json({ 
          error: `Provider '${providerName}' is not configured. Please configure the required API key.`,
          code: 'PROVIDER_NOT_CONFIGURED',
          suggestion: 'Configure AI provider API keys using environment variables or Replit integrations'
        });
      }
    } else {
      provider = aiProviderManager.getDefaultProvider();
    }

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: 'You are an expert programmer that provides clear, concise, and insightful explanations of code. Explain what the code does at a high level, and point out any important details, patterns, or potential issues. Format the response in markdown.',
      },
      {
        role: 'user',
        content: `Please explain this ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\``,
      },
    ];

    const explanation = await provider.generateChat(messages, 1024, 0.5);

    res.json({
      explanation,
      provider: provider.name
    });
  } catch (error: any) {
    console.error('Error generating code explanation:', error);
    
    // Check if error is due to missing API keys
    if (error.message?.includes('not configured') || error.message?.includes('Please configure')) {
      return res.status(503).json({ 
        error: error.message,
        code: 'PROVIDER_NOT_CONFIGURED',
        suggestion: 'Configure AI provider API keys using environment variables or Replit integrations'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to generate code explanation',
      details: error.message 
    });
  }
}

// Generate code conversion between languages
export async function convertCode(req: Request, res: Response) {
  try {
    const { code, fromLanguage, toLanguage, provider: providerName } = req.body;

    if (!code || !fromLanguage || !toLanguage) {
      return res.status(400).json({ error: 'Code, source language, and target language are required' });
    }

    let provider;
    if (providerName) {
      provider = aiProviderManager.getProvider(providerName);
      if (!provider) {
        return res.status(404).json({ 
          error: `Provider '${providerName}' not found`,
          code: 'PROVIDER_NOT_FOUND'
        });
      }
      if (!provider.isAvailable()) {
        return res.status(503).json({ 
          error: `Provider '${providerName}' is not configured. Please configure the required API key.`,
          code: 'PROVIDER_NOT_CONFIGURED',
          suggestion: 'Configure AI provider API keys using environment variables or Replit integrations'
        });
      }
    } else {
      provider = aiProviderManager.getDefaultProvider();
    }

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: 'You are an expert programmer that converts code between different programming languages. Provide an accurate translation that preserves the functionality and logic of the original code while following the best practices of the target language.',
      },
      {
        role: 'user',
        content: `Convert this ${fromLanguage} code to ${toLanguage}:\n\n\`\`\`${fromLanguage}\n${code}\n\`\`\`\n\nOutput the converted code without explanations.`,
      },
    ];

    const convertedCode = await provider.generateChat(messages, 2048, 0.2);

    res.json({
      convertedCode,
      provider: provider.name
    });
  } catch (error: any) {
    console.error('Error converting code:', error);
    
    // Check if error is due to missing API keys
    if (error.message?.includes('not configured') || error.message?.includes('Please configure')) {
      return res.status(503).json({ 
        error: error.message,
        code: 'PROVIDER_NOT_CONFIGURED',
        suggestion: 'Configure AI provider API keys using environment variables or Replit integrations'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to convert code',
      details: error.message 
    });
  }
}

// Generate intelligent documentation
export async function generateDocumentation(req: Request, res: Response) {
  try {
    const { code, language, style = 'standard' } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    let docStyle = '';
    if (style === 'jsdoc' || style === 'javadoc') {
      docStyle = 'Use JSDoc/JavaDoc style documentation with @param and @return tags.';
    } else if (style === 'google') {
      docStyle = 'Use Google style documentation.';
    } else if (style === 'numpy') {
      docStyle = 'Use NumPy style documentation for Python.';
    }

    const provider = aiProviderManager.getDefaultProvider();

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are an expert programmer that generates comprehensive documentation for code. ${docStyle} Follow best practices for the programming language and include descriptions of parameters, return values, exceptions, and examples where appropriate. Return only the documented code.`,
      },
      {
        role: 'user',
        content: `Please document this ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\``,
      },
    ];

    const documentedCode = await provider.generateChat(messages, 2048, 0.3);

    res.json({
      documentedCode,
      provider: provider.name
    });
  } catch (error: any) {
    console.error('Error generating documentation:', error);
    
    // Check if error is due to missing API keys
    if (error.message?.includes('not configured') || error.message?.includes('Please configure')) {
      return res.status(503).json({ 
        error: error.message,
        code: 'PROVIDER_NOT_CONFIGURED',
        suggestion: 'Configure AI provider API keys using environment variables or Replit integrations'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to generate documentation',
      details: error.message 
    });
  }
}

// Generate unit tests
export async function generateTests(req: Request, res: Response) {
  try {
    const { code, language, framework } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    let testFramework = '';
    if (framework) {
      testFramework = `Use the ${framework} testing framework.`;
    }

    const provider = aiProviderManager.getDefaultProvider();

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are an expert programmer that generates comprehensive unit tests for code. ${testFramework} Write tests that cover the functionality, edge cases, and potential error conditions. Return only the test code without explanations.`,
      },
      {
        role: 'user',
        content: `Write unit tests for this ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\``,
      },
    ];

    const testCode = await provider.generateChat(messages, 2048, 0.3);

    res.json({
      testCode,
      provider: provider.name
    });
  } catch (error: any) {
    console.error('Error generating tests:', error);
    
    // Check if error is due to missing API keys
    if (error.message?.includes('not configured') || error.message?.includes('Please configure')) {
      return res.status(503).json({ 
        error: error.message,
        code: 'PROVIDER_NOT_CONFIGURED',
        suggestion: 'Configure AI provider API keys using environment variables or Replit integrations'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to generate tests',
      details: error.message 
    });
  }
}

// 🔥 REPLIT AGENT 3: AI-Powered Code Actions (Inline Quick Fixes)
// Handles: Explain, Debug, Test, Document, Optimize, Review, Search
export async function handleCodeActions(req: Request, res: Response) {
  try {
    const { action, code, language, projectId, provider: providerName } = req.body;

    if (!action || !code) {
      return res.status(400).json({ error: 'Action and code are required' });
    }

    // Validate action type
    const validActions = ['explain', 'debug', 'test', 'document', 'optimize', 'review', 'search'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ 
        error: `Invalid action: ${action}. Valid actions: ${validActions.join(', ')}` 
      });
    }

    // Get project context if projectId provided
    let projectContext: ProjectContext | null = null;
    if (projectId && req.body.filePath) {
      try {
        const contextService = new ProjectContextService(storage);
        projectContext = await contextService.getContextForFile(projectId, req.body.filePath, code);
      } catch (e) {
        console.warn('[AI Code Actions] Failed to get project context:', e);
      }
    }

    let provider;
    if (providerName) {
      provider = aiProviderManager.getProvider(providerName);
      if (!provider) {
        return res.status(404).json({ 
          error: `Provider '${providerName}' not found`,
          code: 'PROVIDER_NOT_FOUND'
        });
      }
      if (!provider.isAvailable()) {
        return res.status(503).json({ 
          error: `Provider '${providerName}' is not configured. Please configure the required API key.`,
          code: 'PROVIDER_NOT_CONFIGURED',
          suggestion: 'Configure AI provider API keys using environment variables or Replit integrations'
        });
      }
    } else {
      provider = aiProviderManager.getDefaultProvider();
    }

    // Build context block if project context is available
    const contextBlock = projectContext ? `

## Project Context
File Tree: ${projectContext.fileTree.slice(0, 20).join(', ')}${projectContext.fileTree.length > 20 ? '...' : ''}

Related Files:
${projectContext.relatedFiles.slice(0, 5).map(f => `### ${f.path} (${f.relation})
\`\`\`
${f.content.slice(0, 1000)}${f.content.length > 1000 ? '...' : ''}
\`\`\``).join('\n')}
` : '';

    // Build action-specific prompts
    const systemPrompts: Record<string, string> = {
      explain: 'You are an expert programmer that provides clear, concise explanations of code. Explain what the code does, its purpose, any important patterns, and potential issues. Use markdown formatting.' + contextBlock,
      debug: 'You are an expert debugger. Analyze the code for bugs, errors, edge cases, and potential issues. Provide specific fixes and explanations. Use markdown formatting.' + contextBlock,
      test: 'You are an expert test engineer. Generate comprehensive unit tests for the given code using the appropriate testing framework for the language. Include edge cases and error scenarios. Return complete, runnable test code.' + contextBlock,
      document: 'You are an expert technical writer. Add comprehensive JSDoc/docstring comments to the code explaining parameters, return values, and functionality. Return the fully documented code.' + contextBlock,
      optimize: 'You are an expert performance engineer. Analyze the code for performance issues, memory leaks, and inefficiencies. Provide an optimized version with explanations. Return the improved code.' + contextBlock,
      review: 'You are a senior code reviewer. Review the code for: code quality, best practices, security issues, maintainability, and suggest improvements. Use markdown formatting.' + contextBlock,
      search: 'You are an expert code analyst. Analyze the code snippet and suggest keywords, libraries, patterns, or similar implementations to search for. Provide actionable search queries.' + contextBlock,
    };

    const userPrompts: Record<string, string> = {
      explain: `Explain this ${language || 'code'}:\n\n\`\`\`${language}\n${code}\n\`\`\``,
      debug: `Debug this ${language || 'code'} and identify issues:\n\n\`\`\`${language}\n${code}\n\`\`\``,
      test: `Generate unit tests for this ${language || 'code'}:\n\n\`\`\`${language}\n${code}\n\`\`\``,
      document: `Add documentation to this ${language || 'code'}:\n\n\`\`\`${language}\n${code}\n\`\`\``,
      optimize: `Optimize this ${language || 'code'} for better performance:\n\n\`\`\`${language}\n${code}\n\`\`\``,
      review: `Review this ${language || 'code'} for quality and best practices:\n\n\`\`\`${language}\n${code}\n\`\`\``,
      search: `Analyze this ${language || 'code'} and suggest search queries to find similar implementations:\n\n\`\`\`${language}\n${code}\n\`\`\``,
    };

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: systemPrompts[action],
      },
      {
        role: 'user',
        content: userPrompts[action],
      },
    ];

    // Generate AI response
    const result = await provider.generateChat(messages, 2048, 0.5);

    // Return formatted result
    const response: any = {
      action,
      result,
      provider: provider.name,
      language,
    };

    // For optimize/document actions, extract the code suggestion
    if (action === 'optimize' || action === 'document') {
      // Extract code blocks from markdown
      const codeBlockRegex = /```[\w]*\n([\s\S]*?)```/g;
      const matches = [...result.matchAll(codeBlockRegex)];
      if (matches.length > 0) {
        response.suggestion = matches[0][1].trim();
      } else {
        response.suggestion = result; // Fallback to full result
      }
    }

    res.json(response);
  } catch (error: any) {
    console.error(`[AI Code Actions] Error processing ${req.body.action}:`, error);
    
    // Check if error is due to missing API keys
    if (error.message?.includes('not configured') || error.message?.includes('Please configure')) {
      return res.status(503).json({ 
        error: error.message,
        code: 'PROVIDER_NOT_CONFIGURED',
        suggestion: 'Configure AI provider API keys using environment variables or Replit integrations'
      });
    }
    
    res.status(500).json({ 
      error: `Failed to process AI code action: ${req.body.action}`,
      details: error.message 
    });
  }
}

// SSE Streaming for Code Actions with Full Project Context
export async function handleCodeActionsStream(req: Request, res: Response) {
  try {
    const { action, code, language, projectId, provider: providerName, filePath } = req.body;

    if (!action || !code) {
      return res.status(400).json({ error: 'Action and code are required' });
    }

    // Validate action type
    const validActions = ['explain', 'debug', 'test', 'document', 'optimize', 'review', 'search'];
    if (!validActions.includes(action)) {
      return res.status(400).json({ error: `Invalid action: ${action}` });
    }

    // Get project context if projectId provided (Fortune 500-grade context awareness)
    let projectContext: ProjectContext | null = null;
    if (projectId && filePath) {
      try {
        const contextService = new ProjectContextService(storage);
        projectContext = await contextService.getContextForFile(projectId, filePath, code);
      } catch (e) {
        console.warn('[AI Code Actions Stream] Failed to get project context:', e);
      }
    }

    let provider;
    if (providerName) {
      provider = aiProviderManager.getProvider(providerName);
      if (!provider?.isAvailable()) {
        return res.status(503).json({ error: `Provider '${providerName}' not available` });
      }
    } else {
      provider = aiProviderManager.getDefaultProvider();
    }

    // Set SSE headers with CORS security - reject invalid origins with 403
    if (!validateAndSetSSEHeaders(res, req)) {
      return;
    }

    // Build context block if project context is available
    const contextBlock = projectContext ? `

## Project Context
File Tree: ${projectContext.fileTree.slice(0, 20).join(', ')}${projectContext.fileTree.length > 20 ? '...' : ''}

Related Files:
${projectContext.relatedFiles.slice(0, 5).map(f => `### ${f.path} (${f.relation})
\`\`\`
${f.content.slice(0, 1000)}${f.content.length > 1000 ? '...' : ''}
\`\`\``).join('\n')}
` : '';

    // Build action-specific prompts with project context
    const systemPrompts: Record<string, string> = {
      explain: 'You are an expert programmer that provides clear, concise explanations of code. Explain what the code does, its purpose, any important patterns, and potential issues. Use markdown formatting.' + contextBlock,
      debug: 'You are an expert debugger. Analyze the code for bugs, errors, edge cases, and potential issues. Provide specific fixes and explanations. Use markdown formatting.' + contextBlock,
      test: 'You are an expert test engineer. Generate comprehensive unit tests for the given code using the appropriate testing framework for the language. Include edge cases and error scenarios. Return complete, runnable test code.' + contextBlock,
      document: 'You are an expert technical writer. Add comprehensive JSDoc/docstring comments to the code explaining parameters, return values, and functionality. Return the fully documented code.' + contextBlock,
      optimize: 'You are an expert performance engineer. Analyze the code for performance issues, memory leaks, and inefficiencies. Provide an optimized version with explanations. Return the improved code.' + contextBlock,
      review: 'You are a senior code reviewer. Review the code for: code quality, best practices, security issues, maintainability, and suggest improvements. Use markdown formatting.' + contextBlock,
      search: 'You are an expert code analyst. Analyze the code snippet and suggest keywords, libraries, patterns, or similar implementations to search for. Provide actionable search queries.' + contextBlock,
    };

    const userPrompts: Record<string, string> = {
      explain: `Explain this ${language || 'code'}:\n\n\`\`\`${language}\n${code}\n\`\`\``,
      debug: `Debug this ${language || 'code'} and identify issues:\n\n\`\`\`${language}\n${code}\n\`\`\``,
      test: `Generate unit tests for this ${language || 'code'}:\n\n\`\`\`${language}\n${code}\n\`\`\``,
      document: `Add documentation to this ${language || 'code'}:\n\n\`\`\`${language}\n${code}\n\`\`\``,
      optimize: `Optimize this ${language || 'code'} for better performance:\n\n\`\`\`${language}\n${code}\n\`\`\``,
      review: `Review this ${language || 'code'} for quality and best practices:\n\n\`\`\`${language}\n${code}\n\`\`\``,
      search: `Analyze this ${language || 'code'} and suggest search queries to find similar implementations:\n\n\`\`\`${language}\n${code}\n\`\`\``,
    };

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompts[action] },
      { role: 'user', content: userPrompts[action] },
    ];

    // Stream response
    if (provider.streamChat) {
      for await (const chunk of provider.streamChat(messages, 2048, 0.5)) {
        res.write(`data: ${JSON.stringify({ content: chunk })}\n\n`);
      }
    } else {
      // Fallback: simulate streaming with non-streaming response
      const result = await provider.generateChat(messages, 2048, 0.5);
      const words = result.split(' ');
      for (const word of words) {
        res.write(`data: ${JSON.stringify({ content: word + ' ' })}\n\n`);
        await new Promise(r => setTimeout(r, 20));
      }
    }

    res.write(`data: ${JSON.stringify({ done: true, provider: provider.name })}\n\n`);
    res.end();
  } catch (error: any) {
    console.error('[AI Stream] Error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
}

// Helper function to create language-specific prompts
function getPromptForLanguage(language: string, code: string): string {
  // Remove trailing whitespace to ensure consistent completions
  const trimmedCode = code.trimEnd();
  
  const basePrompt = `Complete the following ${language || 'code'} snippet. Only return the completion, do not repeat any of the original code or add explanations:\n\n${trimmedCode}`;
  
  switch (language?.toLowerCase()) {
    case 'javascript':
    case 'typescript':
      return basePrompt;
    
    case 'python':
      return basePrompt;
    
    case 'java':
      return basePrompt;
    
    case 'csharp':
    case 'c#':
      return basePrompt;
    
    case 'c':
    case 'cpp':
    case 'c++':
      return basePrompt;
    
    case 'ruby':
      return basePrompt;
    
    case 'php':
      return basePrompt;
    
    case 'go':
      return basePrompt;
    
    case 'rust':
      return basePrompt;
    
    default:
      return basePrompt;
  }
}

// In-memory project chat history (keyed by projectId)
const projectChatHistory = new Map<string, any[]>();

// POST /api/ai/:projectId/chat — project-specific AI chat (used by ReplitAssistant, AIAssistant)
export async function generateProjectChat(req: Request, res: Response) {
  try {
    const { projectId } = req.params;
    const { message, context, provider: providerName } = req.body;

    if (!message && !context?.code) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const provider = providerName
      ? aiProviderManager.getProvider(providerName)
      : aiProviderManager.getDefaultProvider();

    if (!provider) {
      return res.status(503).json({ error: 'No AI provider available' });
    }

    const systemPrompt = `You are an expert AI coding assistant embedded in E-Code, an AI-powered IDE.
You are helping with project ${projectId}. Provide clear, concise, actionable answers.
${context?.file ? `The user is working on file: ${context.file}` : ''}`;

    const history = (context?.history || []).slice(-10).map((m: any) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content
    }));

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: context?.code
          ? `File: ${context.file || 'unknown'}\n\`\`\`\n${context.code}\n\`\`\`\n\n${message}`
          : message }
    ];

    const content = await provider.generateCompletion(message, systemPrompt, 2048, 0.7);

    const responseMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content,
      timestamp: new Date().toISOString()
    };

    // Store in history
    const history2 = projectChatHistory.get(projectId) || [];
    history2.push({ id: Date.now().toString(), role: 'user', content: message, timestamp: new Date().toISOString() });
    history2.push(responseMessage);
    projectChatHistory.set(projectId, history2.slice(-100));

    res.json(responseMessage);
  } catch (error: any) {
    console.error('Error in project chat:', error);
    res.status(500).json({ error: 'Failed to generate AI response', details: error.message });
  }
}

// GET /api/ai/:projectId/history — project chat history (used by AIAssistant)
export async function getProjectHistory(req: Request, res: Response) {
  try {
    const { projectId } = req.params;
    const history = projectChatHistory.get(projectId) || [];
    res.json(history);
  } catch (error: any) {
    console.error('Error getting project history:', error);
    res.status(500).json({ error: 'Failed to get chat history' });
  }
}

// POST /api/ai/:projectId/suggestions — AI code suggestions (used by AIAssistant)
export async function generateProjectSuggestions(req: Request, res: Response) {
  try {
    const { projectId } = req.params;
    const { code, file, context } = req.body;

    const provider = aiProviderManager.getDefaultProvider();
    if (!provider) {
      return res.json({ suggestions: [] });
    }

    const prompt = code
      ? `Analyze this ${file ? `${file.split('.').pop()} ` : ''}code and suggest 3 specific improvements:\n\`\`\`\n${code}\n\`\`\`\nReturn a JSON array of objects with {title, description, type} fields.`
      : `Suggest 3 useful coding tasks for project ${projectId}. Return a JSON array of objects with {title, description, type} fields.`;

    const raw = await provider.generateCompletion(prompt, 'You are a helpful code reviewer. Return ONLY valid JSON.', 512, 0.7);
    
    let suggestions: any[] = [];
    try {
      const match = raw.match(/\[[\s\S]*\]/);
      if (match) suggestions = JSON.parse(match[0]);
    } catch {
      suggestions = [
        { title: 'Add error handling', description: 'Wrap async operations in try/catch blocks', type: 'improvement' },
        { title: 'Write unit tests', description: 'Add tests for critical functions', type: 'testing' },
        { title: 'Add TypeScript types', description: 'Improve type safety with explicit types', type: 'refactor' }
      ];
    }

    res.json({ suggestions });
  } catch (error: any) {
    console.error('Error generating suggestions:', error);
    res.json({ suggestions: [] });
  }
}

// POST /api/ai/generate — general AI generation (Claude, Gemini, xAI, Kimi via AllModelsSelector)
export async function generateAI(req: Request, res: Response) {
  try {
    const { model, prompt, messages, temperature = 0.7, max_tokens = 1024 } = req.body;

    if (!prompt && (!messages || !messages.length)) {
      return res.status(400).json({ error: 'prompt or messages are required' });
    }

    let provider;
    if (model) {
      const modelLower = model.toLowerCase();
      if (modelLower.includes('claude')) provider = aiProviderManager.getProvider('anthropic');
      else if (modelLower.includes('gemini')) provider = aiProviderManager.getProvider('gemini');
      else if (modelLower.includes('grok')) provider = aiProviderManager.getProvider('xai');
      else if (modelLower.includes('kimi') || modelLower.includes('moonshot')) provider = aiProviderManager.getProvider('moonshot');
      else provider = aiProviderManager.getProvider('openai');
    }
    provider = provider || aiProviderManager.getDefaultProvider();

    if (!provider) {
      return res.status(503).json({ error: 'No AI provider available' });
    }

    const text = prompt || (messages as any[]).map((m: any) => m.content).join('\n');
    const result = await provider.generateCompletion(text, 'You are a helpful AI assistant.', max_tokens, temperature);

    res.json({ content: result, model: model || 'default', success: true });
  } catch (error: any) {
    console.error('Error in /ai/generate:', error);
    res.status(500).json({ error: 'Failed to generate AI response', details: error.message });
  }
}

// POST /api/openai/generate — OpenAI-specific generation (used by AllModelsSelector for GPT/o1/o3 models)
export async function generateOpenAI(req: Request, res: Response) {
  try {
    const { model = 'gpt-4.1', messages, temperature = 0.7, max_tokens = 1024 } = req.body;

    if (!messages || !messages.length) {
      return res.status(400).json({ error: 'messages are required' });
    }

    const provider = aiProviderManager.getProvider('openai') || aiProviderManager.getDefaultProvider();
    if (!provider) {
      return res.status(503).json({ error: 'OpenAI provider not available' });
    }

    const text = (messages as any[]).map((m: any) => m.content).join('\n');
    const result = await provider.generateCompletion(text, 'You are a helpful AI assistant.', max_tokens, temperature);

    res.json({ content: result, model, success: true });
  } catch (error: any) {
    console.error('Error in /openai/generate:', error);
    res.status(500).json({ error: 'Failed to generate OpenAI response', details: error.message });
  }
}

// POST /api/opensource/generate — open-source model generation (used by AllModelsSelector)
export async function generateOpenSource(req: Request, res: Response) {
  try {
    const { model, messages, temperature = 0.7, max_tokens = 1024 } = req.body;

    if (!messages || !messages.length) {
      return res.status(400).json({ error: 'messages are required' });
    }

    const provider = aiProviderManager.getDefaultProvider();
    if (!provider) {
      return res.status(503).json({ error: 'No provider available' });
    }

    const text = (messages as any[]).map((m: any) => m.content).join('\n');
    const result = await provider.generateCompletion(text, 'You are a helpful AI assistant.', max_tokens, temperature);

    res.json({ content: result, model: model || 'default', success: true });
  } catch (error: any) {
    console.error('Error in /opensource/generate:', error);
    res.status(500).json({ error: 'Failed to generate response', details: error.message });
  }
}