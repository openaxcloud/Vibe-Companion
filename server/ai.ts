import OpenAI from 'openai';
import { Request, Response } from 'express';

// Create a new OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Constants
const GPT_MODEL = 'gpt-4o'; // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user

// Generate code completion
export async function generateCompletion(req: Request, res: Response) {
  try {
    const { code, language, maxTokens = 1024 } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    const prompt = getPromptForLanguage(language, code);

    const completion = await openai.chat.completions.create({
      model: GPT_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are an expert programmer that generates high-quality code completion suggestions. Complete the code in a way that follows best practices for the language and implements the functionality that seems to be intended based on variable names, comments, and existing code. Return only the suggested code to complete what was given.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.2, // Low temperature for more deterministic output
    });

    res.json({
      completion: completion.choices[0].message.content?.trim() || '',
    });
  } catch (error) {
    console.error('Error generating code completion:', error);
    res.status(500).json({ error: 'Failed to generate code completion' });
  }
}

// Generate code explanation
export async function generateExplanation(req: Request, res: Response) {
  try {
    const { code, language } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    const completion = await openai.chat.completions.create({
      model: GPT_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are an expert programmer that provides clear, concise, and insightful explanations of code. Explain what the code does at a high level, and point out any important details, patterns, or potential issues. Format the response in markdown.',
        },
        {
          role: 'user',
          content: `Please explain this ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\``,
        },
      ],
      max_tokens: 1024,
      temperature: 0.5,
    });

    res.json({
      explanation: completion.choices[0].message.content?.trim() || '',
    });
  } catch (error) {
    console.error('Error generating code explanation:', error);
    res.status(500).json({ error: 'Failed to generate code explanation' });
  }
}

// Generate code conversion between languages
export async function convertCode(req: Request, res: Response) {
  try {
    const { code, fromLanguage, toLanguage } = req.body;

    if (!code || !fromLanguage || !toLanguage) {
      return res.status(400).json({ error: 'Code, source language, and target language are required' });
    }

    const completion = await openai.chat.completions.create({
      model: GPT_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are an expert programmer that converts code between different programming languages. Provide an accurate translation that preserves the functionality and logic of the original code while following the best practices of the target language.',
        },
        {
          role: 'user',
          content: `Convert this ${fromLanguage} code to ${toLanguage}:\n\n\`\`\`${fromLanguage}\n${code}\n\`\`\`\n\nOutput the converted code without explanations.`,
        },
      ],
      max_tokens: 2048,
      temperature: 0.2,
    });

    res.json({
      convertedCode: completion.choices[0].message.content?.trim() || '',
    });
  } catch (error) {
    console.error('Error converting code:', error);
    res.status(500).json({ error: 'Failed to convert code' });
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

    const completion = await openai.chat.completions.create({
      model: GPT_MODEL,
      messages: [
        {
          role: 'system',
          content:
            `You are an expert programmer that generates comprehensive documentation for code. ${docStyle} Follow best practices for the programming language and include descriptions of parameters, return values, exceptions, and examples where appropriate. Return only the documented code.`,
        },
        {
          role: 'user',
          content: `Please document this ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\``,
        },
      ],
      max_tokens: 2048,
      temperature: 0.3,
    });

    res.json({
      documentedCode: completion.choices[0].message.content?.trim() || '',
    });
  } catch (error) {
    console.error('Error generating documentation:', error);
    res.status(500).json({ error: 'Failed to generate documentation' });
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

    const completion = await openai.chat.completions.create({
      model: GPT_MODEL,
      messages: [
        {
          role: 'system',
          content:
            `You are an expert programmer that generates comprehensive unit tests for code. ${testFramework} Write tests that cover the functionality, edge cases, and potential error conditions. Return only the test code without explanations.`,
        },
        {
          role: 'user',
          content: `Write unit tests for this ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\``,
        },
      ],
      max_tokens: 2048,
      temperature: 0.3,
    });

    res.json({
      testCode: completion.choices[0].message.content?.trim() || '',
    });
  } catch (error) {
    console.error('Error generating tests:', error);
    res.status(500).json({ error: 'Failed to generate tests' });
  }
}

export async function handleCodeActions(req: Request, res: Response) {
  try {
    const { code, action } = req.body;
    const actionPrompts: Record<string, string> = {
      explain: `Explain this code:\n\n${code}`,
      refactor: `Refactor this code for better readability and performance:\n\n${code}`,
      optimize: `Optimize this code for performance:\n\n${code}`,
      debug: `Find and fix bugs in this code:\n\n${code}`,
      document: `Add documentation comments to this code:\n\n${code}`,
    };
    const prompt = actionPrompts[action] || `${action}:\n\n${code}`;
    const completion = await openai.chat.completions.create({
      model: GPT_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4096,
    });
    res.json({ result: completion.choices[0].message.content?.trim() || '', action });
  } catch (error: any) {
    res.status(500).json({ error: 'Code action failed', details: error.message });
  }
}

export async function handleCodeActionsStream(req: Request, res: Response) {
  try {
    const { code, action, language } = req.body;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const stream = await openai.chat.completions.create({
      model: GPT_MODEL,
      messages: [{ role: 'user', content: `${action || 'explain'} this ${language || ''} code:\n\n${code}` }],
      max_tokens: 4096,
      stream: true,
    });

    for await (const chunk of stream) {
      const token = chunk.choices[0]?.delta?.content || '';
      if (token) res.write(`data: ${JSON.stringify({ token })}\n\n`);
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
    const { message, model } = req.body;
    const completion = await openai.chat.completions.create({
      model: model || GPT_MODEL,
      messages: [
        { role: 'system', content: `You are an AI coding assistant for project ${projectId}. Help the user write, debug, and improve their code.` },
        { role: 'user', content: message }
      ],
      max_tokens: 4096,
    });
    res.json({ response: completion.choices[0].message.content?.trim() || '', model: model || GPT_MODEL, provider: 'openai' });
  } catch (error: any) {
    res.status(500).json({ error: 'AI chat failed', details: error.message });
  }
}

export async function getProjectHistory(req: Request, res: Response) {
  try {
    res.json({ history: [] });
  } catch (error: any) {
    res.json({ history: [] });
  }
}

export async function generateProjectSuggestions(req: Request, res: Response) {
  try {
    const { code, language } = req.body;
    const { projectId } = req.params;
    const completion = await openai.chat.completions.create({
      model: GPT_MODEL,
      messages: [{ role: 'user', content: `Given this ${language || ''} code from project ${projectId}, suggest 3-5 improvements:\n\n${code}` }],
      max_tokens: 2048,
    });
    res.json({ suggestions: completion.choices[0].message.content?.trim() || '' });
  } catch (error: any) {
    res.status(500).json({ error: 'Suggestions failed', details: error.message });
  }
}

export async function generateAI(req: Request, res: Response) {
  try {
    const { prompt, model, maxTokens, systemPrompt } = req.body;
    const completion = await openai.chat.completions.create({
      model: model || GPT_MODEL,
      messages: [
        ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
        { role: 'user', content: prompt }
      ],
      max_tokens: maxTokens || 4096,
    });
    res.json({ response: completion.choices[0].message.content?.trim() || '', model: model || GPT_MODEL, provider: 'openai' });
  } catch (error: any) {
    res.status(500).json({ error: 'AI generation failed', details: error.message });
  }
}

export async function generateOpenAI(req: Request, res: Response) {
  try {
    const { prompt, model, maxTokens, systemPrompt } = req.body;
    const completion = await openai.chat.completions.create({
      model: model || GPT_MODEL,
      messages: [
        ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
        { role: 'user', content: prompt }
      ],
      max_tokens: maxTokens || 4096,
    });
    res.json({ response: completion.choices[0].message.content?.trim() || '', model: model || GPT_MODEL, provider: 'openai' });
  } catch (error: any) {
    res.status(500).json({ error: 'OpenAI generation failed', details: error.message });
  }
}

export async function generateOpenSource(req: Request, res: Response) {
  try {
    const { prompt, model, maxTokens, systemPrompt } = req.body;
    const completion = await openai.chat.completions.create({
      model: model || GPT_MODEL,
      messages: [
        ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
        { role: 'user', content: prompt }
      ],
      max_tokens: maxTokens || 4096,
    });
    res.json({ response: completion.choices[0].message.content?.trim() || '', model: model || GPT_MODEL, provider: 'openai' });
  } catch (error: any) {
    res.status(500).json({ error: 'Open source generation failed', details: error.message });
  }
}

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