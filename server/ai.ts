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