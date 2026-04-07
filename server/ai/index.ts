import type { Request, Response } from 'express';
import { AIProviderManager } from './ai-provider-manager';
import { storage } from '../storage';
import { createLogger } from '../utils/logger';

const logger = createLogger('ai');

function getManager() {
  return AIProviderManager.getInstance();
}

async function callAI(prompt: string, model?: string, systemPrompt?: string, maxTokens?: number): Promise<{ text: string; model: string; provider: string }> {
  const mgr = getManager();
  const modelId = model || 'gpt-4o';
  const messages: any[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });
  const text = await mgr.generateChat(modelId, messages, { maxTokens: maxTokens || 4096 });
  return { text, model: modelId, provider: 'auto' };
}

export async function generateCompletion(req: Request, res: Response) {
  try {
    const { code, language, prompt, model } = req.body;
    const result = await callAI(prompt || `Complete the following ${language || 'code'}:\n\n${code}`, model, undefined, 2048);
    res.json({ completion: result.text, model: result.model, provider: result.provider });
  } catch (error: any) {
    logger.error(`Completion error: ${error.message}`);
    res.status(500).json({ error: 'AI completion failed', details: error.message });
  }
}

export async function generateExplanation(req: Request, res: Response) {
  try {
    const { code, language, model } = req.body;
    const result = await callAI(`Explain this ${language || ''} code clearly and concisely:\n\n\`\`\`${language || ''}\n${code}\n\`\`\``, model, undefined, 2048);
    res.json({ explanation: result.text, model: result.model });
  } catch (error: any) {
    logger.error(`Explanation error: ${error.message}`);
    res.status(500).json({ error: 'AI explanation failed', details: error.message });
  }
}

export async function convertCode(req: Request, res: Response) {
  try {
    const { code, fromLanguage, toLanguage, model } = req.body;
    const result = await callAI(`Convert this ${fromLanguage} code to ${toLanguage}. Return only the converted code:\n\n\`\`\`${fromLanguage}\n${code}\n\`\`\``, model);
    res.json({ convertedCode: result.text, fromLanguage, toLanguage });
  } catch (error: any) {
    logger.error(`Convert error: ${error.message}`);
    res.status(500).json({ error: 'Code conversion failed', details: error.message });
  }
}

export async function generateDocumentation(req: Request, res: Response) {
  try {
    const { code, language, style, model } = req.body;
    const result = await callAI(`Generate ${style || 'JSDoc'} documentation for this ${language || ''} code:\n\n\`\`\`${language || ''}\n${code}\n\`\`\``, model, undefined, 2048);
    res.json({ documentation: result.text });
  } catch (error: any) {
    logger.error(`Documentation error: ${error.message}`);
    res.status(500).json({ error: 'Documentation generation failed', details: error.message });
  }
}

export async function generateTests(req: Request, res: Response) {
  try {
    const { code, language, framework, model } = req.body;
    const result = await callAI(`Generate ${framework || 'Jest'} unit tests for this ${language || ''} code:\n\n\`\`\`${language || ''}\n${code}\n\`\`\``, model);
    res.json({ tests: result.text });
  } catch (error: any) {
    logger.error(`Tests error: ${error.message}`);
    res.status(500).json({ error: 'Test generation failed', details: error.message });
  }
}

export async function handleCodeActions(req: Request, res: Response) {
  try {
    const { code, action, model } = req.body;
    const actionPrompts: Record<string, string> = {
      explain: `Explain this code:\n\n${code}`,
      refactor: `Refactor this code for better readability and performance:\n\n${code}`,
      optimize: `Optimize this code for performance:\n\n${code}`,
      debug: `Find and fix bugs in this code:\n\n${code}`,
      document: `Add documentation comments to this code:\n\n${code}`,
    };
    const prompt = actionPrompts[action] || `${action}:\n\n${code}`;
    const result = await callAI(prompt, model);
    res.json({ result: result.text, action });
  } catch (error: any) {
    logger.error(`Code action error: ${error.message}`);
    res.status(500).json({ error: 'Code action failed', details: error.message });
  }
}

export async function handleCodeActionsStream(req: Request, res: Response) {
  try {
    const { code, action, language, model } = req.body;
    const prompt = `${action || 'explain'} this ${language || ''} code:\n\n${code}`;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const result = await callAI(prompt, model);
    const words = result.text.split(' ');
    for (const word of words) {
      res.write(`data: ${JSON.stringify({ token: word + ' ' })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
}

export async function generateProjectChat(req: Request, res: Response) {
  try {
    const { projectId } = req.params;
    const { message, model, context } = req.body;
    const userId = (req.user as any)?.id;

    const result = await callAI(message, model, context || `You are an AI coding assistant for project ${projectId}. Help the user write, debug, and improve their code.`);

    if (userId && projectId) {
      try {
        await storage.createAIConversation({
          userId: Number(userId),
          projectId: Number(projectId),
          role: 'assistant',
          content: result.text,
          model: result.model || model || 'gpt-4o'
        });
      } catch {}
    }

    res.json({ response: result.text, model: result.model, provider: result.provider });
  } catch (error: any) {
    logger.error(`Project chat error: ${error.message}`);
    res.status(500).json({ error: 'AI chat failed', details: error.message });
  }
}

export async function getProjectHistory(req: Request, res: Response) {
  try {
    const { projectId } = req.params;
    const userId = (req.user as any)?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const history = await storage.getAIConversations(Number(userId), Number(projectId));
    res.json({ history: history || [] });
  } catch (error: any) {
    logger.error(`Project history error: ${error.message}`);
    res.json({ history: [] });
  }
}

export async function generateProjectSuggestions(req: Request, res: Response) {
  try {
    const { projectId } = req.params;
    const { code, language, model } = req.body;
    const result = await callAI(`Given this ${language || ''} code from project ${projectId}, suggest 3-5 improvements:\n\n${code}`, model, undefined, 2048);
    res.json({ suggestions: result.text });
  } catch (error: any) {
    logger.error(`Suggestions error: ${error.message}`);
    res.status(500).json({ error: 'Suggestions failed', details: error.message });
  }
}

export async function generateAI(req: Request, res: Response) {
  try {
    const { prompt, model, maxTokens, systemPrompt } = req.body;
    const result = await callAI(prompt, model || 'claude-3-5-sonnet-20241022', systemPrompt, maxTokens);
    res.json({ response: result.text, model: result.model, provider: result.provider });
  } catch (error: any) {
    logger.error(`Generate AI error: ${error.message}`);
    res.status(500).json({ error: 'AI generation failed', details: error.message });
  }
}

export async function generateOpenAI(req: Request, res: Response) {
  try {
    const { prompt, model, maxTokens, systemPrompt } = req.body;
    const result = await callAI(prompt, model || 'gpt-4o', systemPrompt, maxTokens);
    res.json({ response: result.text, model: result.model, provider: 'openai' });
  } catch (error: any) {
    logger.error(`OpenAI generate error: ${error.message}`);
    res.status(500).json({ error: 'OpenAI generation failed', details: error.message });
  }
}

export async function generateOpenSource(req: Request, res: Response) {
  try {
    const { prompt, model, maxTokens, systemPrompt } = req.body;
    const result = await callAI(prompt, model || 'llama-3.1-70b', systemPrompt, maxTokens);
    res.json({ response: result.text, model: result.model, provider: result.provider });
  } catch (error: any) {
    logger.error(`Open source generate error: ${error.message}`);
    res.status(500).json({ error: 'Open source generation failed', details: error.message });
  }
}
