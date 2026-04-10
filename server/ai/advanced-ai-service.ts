import { CodeAnalyzer } from './code-analyzer';
import { aiProviderManager } from './ai-provider-manager';
import { File, Project } from '@shared/schema';

// Helper function to get the default AI provider
function getAIProvider() {
  return aiProviderManager.getDefaultProvider();
}

export interface CodeExplanation {
  summary: string;
  concepts: string[];
  complexity: 'simple' | 'moderate' | 'complex';
  lineByLine: Array<{
    lineNumber: number;
    code: string;
    explanation: string;
  }>;
}

export interface BugDetection {
  bugs: Array<{
    line: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    type: string;
    description: string;
    suggestion: string;
    fixCode?: string;
  }>;
  summary: string;
}

export interface TestGeneration {
  framework: string;
  tests: Array<{
    name: string;
    description: string;
    code: string;
  }>;
  coverage: {
    functions: string[];
    edge_cases: string[];
  };
}

export interface RefactoringSuggestion {
  suggestions: Array<{
    type: 'performance' | 'readability' | 'maintainability' | 'security';
    description: string;
    before: string;
    after: string;
    impact: string;
  }>;
}

export interface DocumentationGeneration {
  fileDoc: string;
  functions: Array<{
    name: string;
    description: string;
    parameters: Array<{
      name: string;
      type: string;
      description: string;
    }>;
    returns: {
      type: string;
      description: string;
    };
    examples?: string[];
  }>;
  classes?: Array<{
    name: string;
    description: string;
    methods: Array<{
      name: string;
      description: string;
    }>;
  }>;
}

export interface CodeReview {
  score: number; // 0-100
  strengths: string[];
  improvements: string[];
  security_issues: Array<{
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    line?: number;
    fix?: string;
  }>;
  best_practices: Array<{
    category: string;
    suggestion: string;
    priority: 'low' | 'medium' | 'high';
  }>;
}

export class AdvancedAIService {
  private analyzer: CodeAnalyzer;
  private provider: ReturnType<typeof getAIProvider>;

  constructor() {
    this.analyzer = new CodeAnalyzer();
    this.provider = getAIProvider();
  }

  async explainCode(file: File): Promise<CodeExplanation> {
    const analysis = await this.analyzer.analyzeCode(file.content || '', 'javascript', file.name);
    
    const prompt = `Explain this ${analysis.language} code in detail:
    
${file.content}

Provide:
1. A high-level summary
2. Key concepts used
3. Complexity assessment (simple/moderate/complex)
4. Line-by-line explanations for important parts

Format as JSON matching the CodeExplanation interface.`;

    const response = await this.provider.generateChat([
      { role: 'system', content: 'You are an expert code educator. Explain code clearly and thoroughly.' },
      { role: 'user', content: prompt }
    ]);

    try {
      return JSON.parse(response);
    } catch (err: any) { console.error("[catch]", err?.message || err);
      // Fallback if AI doesn't return valid JSON
      return {
        summary: response,
        concepts: analysis.patterns.map((p: any) => typeof p === 'string' ? p : p.name || p.type || 'unknown'),
        complexity: analysis.complexity > 10 ? 'complex' : analysis.complexity > 5 ? 'moderate' : 'simple',
        lineByLine: []
      };
    }
  }

  async detectBugs(file: File): Promise<BugDetection> {
    const language = this.getLanguageFromFileName(file.name);
    const analysis = await this.analyzer.analyzeCode(file.content || '', language, file.name);
    
    const prompt = `Analyze this ${analysis.language} code for bugs and issues:
    
${file.content}

Code analysis context:
- Complexity: ${analysis.complexity}
- Dependencies: ${analysis.dependencies.join(', ')}
- Functions: ${analysis.functions.map((f: any) => f.name).join(', ')}

Identify:
1. Bugs (syntax errors, logic errors, runtime errors)
2. Potential issues (memory leaks, security vulnerabilities, performance problems)
3. Code smells and anti-patterns

For each issue provide:
- Line number
- Severity (low/medium/high/critical)
- Type of issue
- Description
- Suggestion for fix
- Fixed code snippet if applicable

Format as JSON matching the BugDetection interface.`;

    const response = await this.provider.generateChat([
      { role: 'system', content: 'You are an expert debugger and security analyst. Find all bugs and vulnerabilities.' },
      { role: 'user', content: prompt }
    ]);

    try {
      return JSON.parse(response);
    } catch (err: any) { console.error("[catch]", err?.message || err);
      return {
        bugs: [],
        summary: response
      };
    }
  }

  async generateTests(file: File, framework: string = 'jest'): Promise<TestGeneration> {
    const language = this.getLanguageFromFileName(file.name);
    const analysis = await this.analyzer.analyzeCode(file.content || '', language, file.name);
    
    const prompt = `Generate comprehensive ${framework} tests for this ${analysis.language} code:
    
${file.content}

Functions to test: ${analysis.functions.map((f: any) => f.name).join(', ')}

Generate:
1. Unit tests for each function
2. Edge case tests
3. Integration tests if applicable
4. Mock any external dependencies

Ensure tests cover:
- Happy path scenarios
- Error cases
- Boundary conditions
- Invalid inputs

Format as JSON matching the TestGeneration interface.`;

    const response = await this.provider.generateChat([
      { role: 'system', content: `You are an expert test engineer. Generate thorough ${framework} tests.` },
      { role: 'user', content: prompt }
    ]);

    try {
      return JSON.parse(response);
    } catch (err: any) { console.error("[catch]", err?.message || err);
      return {
        framework,
        tests: [],
        coverage: {
          functions: analysis.functions.map((f: any) => f.name),
          edge_cases: []
        }
      };
    }
  }

  async suggestRefactoring(file: File): Promise<RefactoringSuggestion> {
    const language = this.getLanguageFromFileName(file.name);
    const analysis = await this.analyzer.analyzeCode(file.content || '', language, file.name);
    
    const prompt = `Analyze this ${analysis.language} code and suggest refactoring improvements:
    
${file.content}

Code metrics:
- Complexity: ${analysis.complexity}
- Lines: ${(file.content || '').split('\n').length}
- Functions: ${analysis.functions.length}

Suggest improvements for:
1. Performance optimization
2. Code readability
3. Maintainability
4. Security hardening

For each suggestion provide:
- Type (performance/readability/maintainability/security)
- Description of the improvement
- Before and after code snippets
- Expected impact

Format as JSON matching the RefactoringSuggestion interface.`;

    const response = await this.provider.generateChat([
      { role: 'system', content: 'You are an expert software architect. Suggest practical refactoring improvements.' },
      { role: 'user', content: prompt }
    ]);

    try {
      return JSON.parse(response);
    } catch (err: any) { console.error("[catch]", err?.message || err);
      return {
        suggestions: []
      };
    }
  }

  async generateDocumentation(file: File): Promise<DocumentationGeneration> {
    const language = this.getLanguageFromFileName(file.name);
    const analysis = await this.analyzer.analyzeCode(file.content || '', language, file.name);
    
    const prompt = `Generate comprehensive documentation for this ${analysis.language} code:
    
${file.content}

Include:
1. File-level documentation explaining the purpose and usage
2. Function documentation with:
   - Description
   - Parameters (name, type, description)
   - Return value (type, description)
   - Usage examples
3. Class documentation if applicable

Use appropriate documentation format for ${analysis.language} (JSDoc, docstrings, etc.)

Format as JSON matching the DocumentationGeneration interface.`;

    const response = await this.provider.generateChat([
      { role: 'system', content: 'You are an expert technical writer. Generate clear, comprehensive documentation.' },
      { role: 'user', content: prompt }
    ]);

    try {
      return JSON.parse(response);
    } catch (err: any) { console.error("[catch]", err?.message || err);
      return {
        fileDoc: response,
        functions: analysis.functions.map((f: any) => ({
          name: f.name,
          description: '',
          parameters: f.params,
          returns: { type: 'unknown', description: '' }
        }))
      };
    }
  }

  async reviewCode(file: File): Promise<CodeReview> {
    const language = this.getLanguageFromFileName(file.name);
    const analysis = await this.analyzer.analyzeCode(file.content || '', language, file.name);
    
    const prompt = `Perform a comprehensive code review for this ${analysis.language} code:
    
${file.content}

Code metrics:
- Complexity: ${analysis.complexity}
- Lines: ${(file.content || '').split('\n').length}
- Functions: ${analysis.functions.length}
- Dependencies: ${analysis.dependencies.join(', ')}

Review:
1. Code quality (0-100 score)
2. Strengths of the implementation
3. Areas for improvement
4. Security vulnerabilities
5. Best practice violations

Provide actionable feedback with specific examples.

Format as JSON matching the CodeReview interface.`;

    const response = await this.provider.generateChat([
      { role: 'system', content: 'You are a senior code reviewer. Provide constructive, detailed feedback.' },
      { role: 'user', content: prompt }
    ]);

    try {
      return JSON.parse(response);
    } catch (err: any) { console.error("[catch]", err?.message || err);
      return {
        score: 75,
        strengths: ['Code is functional'],
        improvements: ['Could benefit from review'],
        security_issues: [],
        best_practices: []
      };
    }
  }

  async debugError(error: string, file: File, lineNumber?: number): Promise<{
    diagnosis: string;
    possibleCauses: string[];
    solutions: Array<{
      description: string;
      code?: string;
      confidence: 'low' | 'medium' | 'high';
    }>;
  }> {
    const language = this.getLanguageFromFileName(file.name);
    const analysis = await this.analyzer.analyzeCode(file.content || '', language, file.name);
    const context = lineNumber 
      ? this.getCodeContext(file.content || '', lineNumber)
      : file.content;

    const prompt = `Debug this error in ${analysis.language} code:

Error: ${error}
${lineNumber ? `Line number: ${lineNumber}` : ''}

Code context:
${context}

Provide:
1. Diagnosis of what's causing the error
2. Possible causes (list all potential reasons)
3. Solutions with code fixes (ordered by confidence)

Consider the full file context and common ${analysis.language} pitfalls.`;

    const response = await this.provider.generateChat([
      { role: 'system', content: 'You are an expert debugger. Diagnose errors accurately and provide working solutions.' },
      { role: 'user', content: prompt }
    ]);

    try {
      return JSON.parse(response);
    } catch (err: any) { console.error("[catch]", err?.message || err);
      return {
        diagnosis: response,
        possibleCauses: [],
        solutions: []
      };
    }
  }

  private getCodeContext(content: string, lineNumber: number, contextLines: number = 10): string {
    const lines = content.split('\n');
    const start = Math.max(0, lineNumber - contextLines - 1);
    const end = Math.min(lines.length, lineNumber + contextLines);
    
    return lines.slice(start, end)
      .map((line, idx) => {
        const currentLine = start + idx + 1;
        const marker = currentLine === lineNumber ? '>>> ' : '    ';
        return `${marker}${currentLine}: ${line}`;
      })
      .join('\n');
  }

  private getLanguageFromFileName(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'jsx',
      'ts': 'typescript',
      'tsx': 'tsx',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'swift': 'swift',
      'kt': 'kotlin',
      'scala': 'scala',
      'r': 'r',
      'sql': 'sql',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'sass',
      'less': 'less',
      'json': 'json',
      'xml': 'xml',
      'yaml': 'yaml',
      'yml': 'yaml',
      'md': 'markdown',
      'sh': 'bash',
      'bash': 'bash',
      'zsh': 'bash',
      'fish': 'bash'
    };

    return languageMap[ext] || 'text';
  }

  async improvePrompt(options: { prompt: string; context?: string }): Promise<string> {
    const systemPrompt = `You are an AI prompt engineer expert. Improve the user's prompt to be more specific, actionable, and effective for building applications.
    
    Guidelines:
    - Make the prompt clearer and more specific
    - Add helpful context if missing
    - Ensure the request is actionable
    - Keep the improved prompt concise but comprehensive
    - Focus on what needs to be built or accomplished`;

    const userPrompt = `${options.context ? `Context: ${options.context}\n\n` : ''}Original prompt: "${options.prompt}"
    
Please provide an improved version of this prompt that will lead to better results.`;

    const response = await this.provider.generateChat([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]);

    return response;
  }
}