// @ts-nocheck
import { aiProviderManager } from '../ai/ai-provider-manager';
import { CodeAnalyzer } from '../ai/code-analyzer';
import * as babel from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createLogger } from '../utils/logger';

const logger = createLogger('ai-code-review');
const execAsync = promisify(exec);

export interface CodeReviewIssue {
  id: string;
  fileId: number;
  filePath: string;
  type: 'error' | 'warning' | 'suggestion' | 'security' | 'performance' | 'style';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  line: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  message: string;
  explanation: string;
  suggestion?: string;
  fixCode?: string;
  category: string;
  rule?: string;
  confidence: number;
}

export interface CodeReviewResult {
  projectId: string;
  fileId?: number;
  issues: CodeReviewIssue[];
  metrics: {
    totalIssues: number;
    criticalIssues: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
    securityIssues: number;
    performanceIssues: number;
    codeQualityScore: number;
    complexity: number;
    maintainability: number;
  };
  summary: string;
  timestamp: Date;
  duration: number;
}

interface ReviewOptions {
  checkSecurity?: boolean;
  checkPerformance?: boolean;
  checkStyle?: boolean;
  checkBestPractices?: boolean;
  checkComplexity?: boolean;
  checkDuplication?: boolean;
  checkDocumentation?: boolean;
  aiProvider?: string;
  confidenceThreshold?: number;
  maxIssues?: number;
}

class AICodeReviewService {
  private codeAnalyzer: CodeAnalyzer;
  private cache: Map<string, CodeReviewResult> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.codeAnalyzer = new CodeAnalyzer();
  }

  async analyzeCode(
    projectId: string,
    code: string,
    filePath: string,
    fileId?: number,
    options: ReviewOptions = {}
  ): Promise<CodeReviewResult> {
    const startTime = Date.now();
    
    // Check cache first
    const cacheKey = `${projectId}-${fileId || filePath}-${code.length}`;
    const cached = this.cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp.getTime()) < this.CACHE_TTL) {
      return cached;
    }

    const {
      checkSecurity = true,
      checkPerformance = true,
      checkStyle = true,
      checkBestPractices = true,
      checkComplexity = true,
      checkDuplication = true,
      checkDocumentation = true,
      aiProvider = 'anthropic',
      confidenceThreshold = 0.7,
      maxIssues = 100
    } = options;

    const issues: CodeReviewIssue[] = [];
    const fileExtension = path.extname(filePath).toLowerCase();
    const language = this.getLanguageFromExtension(fileExtension);

    try {
      // Run different types of analysis in parallel
      const analysisPromises: Promise<CodeReviewIssue[]>[] = [];

      if (checkSecurity) {
        analysisPromises.push(this.performSecurityAnalysis(code, filePath, fileId));
      }

      if (checkPerformance) {
        analysisPromises.push(this.performPerformanceAnalysis(code, filePath, fileId, language));
      }

      if (checkStyle) {
        analysisPromises.push(this.performStyleAnalysis(code, filePath, fileId, language));
      }

      if (checkBestPractices) {
        analysisPromises.push(this.performBestPracticesAnalysis(code, filePath, fileId, language));
      }

      if (checkComplexity) {
        analysisPromises.push(this.analyzeCodeComplexity(code, filePath, fileId, language));
      }

      if (checkDuplication) {
        analysisPromises.push(this.detectCodeDuplication(code, filePath, fileId));
      }

      if (checkDocumentation) {
        analysisPromises.push(this.checkDocumentationCompleteness(code, filePath, fileId, language));
      }

      // AI-powered analysis
      analysisPromises.push(this.performAIAnalysis(code, filePath, fileId, aiProvider));

      const results = await Promise.all(analysisPromises);
      results.forEach(result => issues.push(...result));

      // Filter by confidence threshold
      const filteredIssues = issues
        .filter(issue => issue.confidence >= confidenceThreshold)
        .slice(0, maxIssues);

      // Calculate metrics
      const metrics = this.calculateMetrics(filteredIssues, code);

      // Generate summary using AI
      const summary = await this.generateReviewSummary(filteredIssues, metrics, aiProvider);

      const result: CodeReviewResult = {
        projectId,
        fileId,
        issues: filteredIssues,
        metrics,
        summary,
        timestamp: new Date(),
        duration: Date.now() - startTime
      };

      // Cache the result
      this.cache.set(cacheKey, result);

      return result;
    } catch (error) {
      logger.error('Error during code review:', error);
      throw error;
    }
  }

  private async performSecurityAnalysis(
    code: string,
    filePath: string,
    fileId?: number
  ): Promise<CodeReviewIssue[]> {
    const issues: CodeReviewIssue[] = [];
    
    // Common security patterns to detect
    const securityPatterns = [
      {
        pattern: /eval\s*\(/g,
        message: 'Avoid using eval() as it can execute arbitrary code',
        severity: 'critical' as const,
        type: 'security' as const
      },
      {
        pattern: /innerHTML\s*=/g,
        message: 'innerHTML can lead to XSS vulnerabilities. Use textContent or sanitize input',
        severity: 'high' as const,
        type: 'security' as const
      },
      {
        pattern: /document\.write/g,
        message: 'document.write can be exploited for XSS attacks',
        severity: 'high' as const,
        type: 'security' as const
      },
      {
        pattern: /process\.env\.[A-Z_]+(?!\s*\|\|)/g,
        message: 'Environment variable used without fallback',
        severity: 'medium' as const,
        type: 'security' as const
      },
      {
        pattern: /password|secret|api[_-]?key|token/gi,
        message: 'Potential hardcoded sensitive information',
        severity: 'critical' as const,
        type: 'security' as const,
        additionalCheck: (match: string, line: string) => {
          // Check if it's actually a hardcoded value
          return /=\s*["'][\w\d]{10,}["']/.test(line);
        }
      },
      {
        pattern: /\$\{.*\}/g,
        message: 'Template literal injection risk in SQL queries',
        severity: 'critical' as const,
        type: 'security' as const,
        context: 'sql'
      }
    ];

    const lines = code.split('\n');
    
    for (const pattern of securityPatterns) {
      let match;
      while ((match = pattern.pattern.exec(code)) !== null) {
        const line = code.substring(0, match.index).split('\n').length;
        const lineContent = lines[line - 1];
        
        // Additional context check if provided
        if (pattern.additionalCheck && !pattern.additionalCheck(match[0], lineContent)) {
          continue;
        }
        
        // Check if it's in a SQL context
        if (pattern.context === 'sql' && !this.isInSQLContext(lineContent)) {
          continue;
        }

        issues.push({
          id: `sec-${Date.now()}-${Math.random()}`,
          fileId: fileId || 0,
          filePath,
          type: pattern.type,
          severity: pattern.severity,
          line,
          message: pattern.message,
          explanation: `Security vulnerability detected: ${pattern.message}`,
          suggestion: this.getSecuritySuggestion(pattern.message),
          category: 'Security',
          rule: 'security-scan',
          confidence: 0.9
        });
      }
    }

    return issues;
  }

  private async performPerformanceAnalysis(
    code: string,
    filePath: string,
    fileId?: number,
    language: string
  ): Promise<CodeReviewIssue[]> {
    const issues: CodeReviewIssue[] = [];
    
    if (language === 'javascript' || language === 'typescript') {
      try {
        const ast = babel.parse(code, {
          sourceType: 'module',
          plugins: ['typescript', 'jsx']
        });

        traverse(ast, {
          // Detect expensive operations in loops
          ForStatement(path) {
            const body = path.node.body;
            if (t.isBlockStatement(body)) {
              body.body.forEach(statement => {
                if (t.isExpressionStatement(statement)) {
                  const expr = statement.expression;
                  // Check for DOM manipulation in loops
                  if (t.isCallExpression(expr) && 
                      t.isMemberExpression(expr.callee) &&
                      (expr.callee.property as any).name?.includes('querySelector')) {
                    issues.push({
                      id: `perf-${Date.now()}-${Math.random()}`,
                      fileId: fileId || 0,
                      filePath,
                      type: 'performance',
                      severity: 'high',
                      line: path.node.loc?.start.line || 0,
                      message: 'DOM queries inside loops can cause performance issues',
                      explanation: 'Accessing the DOM repeatedly in a loop is expensive. Consider caching the elements outside the loop.',
                      suggestion: 'Cache DOM elements before the loop',
                      category: 'Performance',
                      rule: 'no-dom-in-loop',
                      confidence: 0.95
                    });
                  }
                }
              });
            }
          },
          
          // Detect inefficient array methods
          CallExpression(path) {
            if (t.isMemberExpression(path.node.callee)) {
              const property = path.node.callee.property as any;
              if (property.name === 'filter' || property.name === 'map') {
                // Check if chaining multiple array methods inefficiently
                const parent = path.parent;
                if (t.isMemberExpression(parent) && 
                    t.isCallExpression(path.parentPath?.parent as any)) {
                  const parentCall = path.parentPath?.parent as any;
                  if (parentCall.callee?.property?.name === 'filter' || 
                      parentCall.callee?.property?.name === 'map') {
                    issues.push({
                      id: `perf-${Date.now()}-${Math.random()}`,
                      fileId: fileId || 0,
                      filePath,
                      type: 'performance',
                      severity: 'medium',
                      line: path.node.loc?.start.line || 0,
                      message: 'Multiple array iterations can be combined',
                      explanation: 'Chaining multiple filter/map operations causes multiple iterations. Consider combining them into a single operation.',
                      suggestion: 'Combine array operations using reduce() or a single loop',
                      category: 'Performance',
                      rule: 'optimize-array-operations',
                      confidence: 0.85
                    });
                  }
                }
              }
            }
          }
        });
      } catch (error) {
        logger.warn('Failed to parse code for performance analysis:', error);
      }
    }

    return issues;
  }

  private async performStyleAnalysis(
    code: string,
    filePath: string,
    fileId?: number,
    language: string
  ): Promise<CodeReviewIssue[]> {
    const issues: CodeReviewIssue[] = [];
    const lines = code.split('\n');

    lines.forEach((line, index) => {
      const lineNum = index + 1;
      
      // Check line length
      if (line.length > 120) {
        issues.push({
          id: `style-${Date.now()}-${Math.random()}`,
          fileId: fileId || 0,
          filePath,
          type: 'style',
          severity: 'low',
          line: lineNum,
          message: `Line exceeds 120 characters (${line.length} chars)`,
          explanation: 'Long lines are harder to read and review',
          suggestion: 'Break this line into multiple lines',
          category: 'Style',
          rule: 'max-line-length',
          confidence: 1.0
        });
      }

      // Check for console.log statements
      if (/console\.(log|debug|info)/.test(line) && !line.trim().startsWith('//')) {
        issues.push({
          id: `style-${Date.now()}-${Math.random()}`,
          fileId: fileId || 0,
          filePath,
          type: 'warning',
          severity: 'medium',
          line: lineNum,
          message: 'Remove console statements before production',
          explanation: 'Console statements should be removed or replaced with proper logging',
          suggestion: 'Use a proper logging library or remove this statement',
          category: 'Style',
          rule: 'no-console',
          confidence: 0.9
        });
      }

      // Check for TODO/FIXME comments
      if (/\/\/\s*(TODO|FIXME|HACK|XXX)/.test(line)) {
        issues.push({
          id: `style-${Date.now()}-${Math.random()}`,
          fileId: fileId || 0,
          filePath,
          type: 'suggestion',
          severity: 'info',
          line: lineNum,
          message: 'Unresolved TODO/FIXME comment',
          explanation: 'TODO comments indicate incomplete work',
          suggestion: 'Address this TODO or create a tracking issue',
          category: 'Style',
          rule: 'no-todo',
          confidence: 1.0
        });
      }
    });

    return issues;
  }

  private async performBestPracticesAnalysis(
    code: string,
    filePath: string,
    fileId?: number,
    language: string
  ): Promise<CodeReviewIssue[]> {
    const issues: CodeReviewIssue[] = [];

    if (language === 'javascript' || language === 'typescript') {
      try {
        const ast = babel.parse(code, {
          sourceType: 'module',
          plugins: ['typescript', 'jsx']
        });

        traverse(ast, {
          // Check for var usage
          VariableDeclaration(path) {
            if (path.node.kind === 'var') {
              issues.push({
                id: `bp-${Date.now()}-${Math.random()}`,
                fileId: fileId || 0,
                filePath,
                type: 'suggestion',
                severity: 'medium',
                line: path.node.loc?.start.line || 0,
                message: 'Use const or let instead of var',
                explanation: 'var has function scope which can lead to bugs. Use block-scoped const or let instead.',
                suggestion: 'Replace var with const or let',
                fixCode: code.replace(/\bvar\b/, 'const'),
                category: 'Best Practices',
                rule: 'no-var',
                confidence: 0.95
              });
            }
          },

          // Check for == instead of ===
          BinaryExpression(path) {
            if (path.node.operator === '==' || path.node.operator === '!=') {
              issues.push({
                id: `bp-${Date.now()}-${Math.random()}`,
                fileId: fileId || 0,
                filePath,
                type: 'suggestion',
                severity: 'medium',
                line: path.node.loc?.start.line || 0,
                message: `Use ${path.node.operator === '==' ? '===' : '!=='} for strict comparison`,
                explanation: 'Loose equality can cause unexpected type coercion',
                suggestion: `Replace ${path.node.operator} with ${path.node.operator === '==' ? '===' : '!=='}`,
                category: 'Best Practices',
                rule: 'eqeqeq',
                confidence: 0.9
              });
            }
          },

          // Check for missing error handling
          TryStatement(path) {
            const handler = path.node.handler;
            if (handler && handler.body.body.length === 0) {
              issues.push({
                id: `bp-${Date.now()}-${Math.random()}`,
                fileId: fileId || 0,
                filePath,
                type: 'warning',
                severity: 'high',
                line: handler.loc?.start.line || 0,
                message: 'Empty catch block',
                explanation: 'Empty catch blocks hide errors and make debugging difficult',
                suggestion: 'Log the error or handle it appropriately',
                category: 'Best Practices',
                rule: 'no-empty-catch',
                confidence: 1.0
              });
            }
          }
        });
      } catch (error) {
        logger.warn('Failed to parse code for best practices analysis:', error);
      }
    }

    return issues;
  }

  private async analyzeCodeComplexity(
    code: string,
    filePath: string,
    fileId?: number,
    language: string
  ): Promise<CodeReviewIssue[]> {
    const issues: CodeReviewIssue[] = [];

    if (language === 'javascript' || language === 'typescript') {
      try {
        const ast = babel.parse(code, {
          sourceType: 'module',
          plugins: ['typescript', 'jsx']
        });

        traverse(ast, {
          FunctionDeclaration(path) {
            const complexity = this.calculateCyclomaticComplexity(path.node);
            if (complexity > 10) {
              issues.push({
                id: `complex-${Date.now()}-${Math.random()}`,
                fileId: fileId || 0,
                filePath,
                type: 'warning',
                severity: complexity > 20 ? 'high' : 'medium',
                line: path.node.loc?.start.line || 0,
                message: `Function has high cyclomatic complexity (${complexity})`,
                explanation: 'High complexity makes code harder to test and maintain',
                suggestion: 'Consider breaking this function into smaller, more focused functions',
                category: 'Complexity',
                rule: 'cyclomatic-complexity',
                confidence: 1.0
              });
            }
          }
        });
      } catch (error) {
        logger.warn('Failed to analyze code complexity:', error);
      }
    }

    return issues;
  }

  private calculateCyclomaticComplexity(node: any): number {
    let complexity = 1; // Base complexity

    traverse(node, {
      IfStatement() { complexity++; },
      ConditionalExpression() { complexity++; },
      ForStatement() { complexity++; },
      ForInStatement() { complexity++; },
      ForOfStatement() { complexity++; },
      WhileStatement() { complexity++; },
      DoWhileStatement() { complexity++; },
      SwitchCase() { complexity++; },
      CatchClause() { complexity++; },
      LogicalExpression(path) {
        if (path.node.operator === '&&' || path.node.operator === '||') {
          complexity++;
        }
      }
    }, node.scope, node);

    return complexity;
  }

  private async detectCodeDuplication(
    code: string,
    filePath: string,
    fileId?: number
  ): Promise<CodeReviewIssue[]> {
    const issues: CodeReviewIssue[] = [];
    const lines = code.split('\n');
    const minDuplicateLines = 5;
    const seenBlocks = new Map<string, number[]>();

    // Simple duplicate detection - can be enhanced with more sophisticated algorithms
    for (let i = 0; i < lines.length - minDuplicateLines; i++) {
      const block = lines.slice(i, i + minDuplicateLines).join('\n').trim();
      
      if (block.length < 50) continue; // Skip small blocks
      
      if (seenBlocks.has(block)) {
        const previousLines = seenBlocks.get(block)!;
        issues.push({
          id: `dup-${Date.now()}-${Math.random()}`,
          fileId: fileId || 0,
          filePath,
          type: 'suggestion',
          severity: 'medium',
          line: i + 1,
          endLine: i + minDuplicateLines,
          message: `Duplicate code block detected (also at lines ${previousLines.join('-')})`,
          explanation: 'Code duplication violates DRY principle and makes maintenance harder',
          suggestion: 'Extract this logic into a reusable function',
          category: 'Duplication',
          rule: 'no-duplicate-code',
          confidence: 0.8
        });
      } else {
        seenBlocks.set(block, [i + 1, i + minDuplicateLines]);
      }
    }

    return issues;
  }

  private async checkDocumentationCompleteness(
    code: string,
    filePath: string,
    fileId?: number,
    language: string
  ): Promise<CodeReviewIssue[]> {
    const issues: CodeReviewIssue[] = [];

    if (language === 'javascript' || language === 'typescript') {
      try {
        const ast = babel.parse(code, {
          sourceType: 'module',
          plugins: ['typescript', 'jsx']
        });

        traverse(ast, {
          FunctionDeclaration(path) {
            const functionName = path.node.id?.name;
            if (!functionName) return;

            // Check if function has JSDoc comment
            const leadingComments = path.node.leadingComments;
            const hasJSDoc = leadingComments?.some(comment => 
              comment.type === 'CommentBlock' && comment.value.includes('*')
            );

            if (!hasJSDoc && path.node.params.length > 0) {
              issues.push({
                id: `doc-${Date.now()}-${Math.random()}`,
                fileId: fileId || 0,
                filePath,
                type: 'suggestion',
                severity: 'low',
                line: path.node.loc?.start.line || 0,
                message: `Function '${functionName}' is missing documentation`,
                explanation: 'Functions with parameters should be documented for clarity',
                suggestion: 'Add JSDoc comment describing the function, its parameters, and return value',
                category: 'Documentation',
                rule: 'require-jsdoc',
                confidence: 0.7
              });
            }
          },

          ClassDeclaration(path) {
            const className = path.node.id?.name;
            if (!className) return;

            const leadingComments = path.node.leadingComments;
            const hasComment = leadingComments && leadingComments.length > 0;

            if (!hasComment) {
              issues.push({
                id: `doc-${Date.now()}-${Math.random()}`,
                fileId: fileId || 0,
                filePath,
                type: 'suggestion',
                severity: 'low',
                line: path.node.loc?.start.line || 0,
                message: `Class '${className}' is missing documentation`,
                explanation: 'Classes should be documented to explain their purpose and usage',
                suggestion: 'Add a comment describing the class and its responsibilities',
                category: 'Documentation',
                rule: 'require-class-doc',
                confidence: 0.7
              });
            }
          }
        });
      } catch (error) {
        logger.warn('Failed to check documentation:', error);
      }
    }

    return issues;
  }

  private async performAIAnalysis(
    code: string,
    filePath: string,
    fileId?: number,
    provider: string
  ): Promise<CodeReviewIssue[]> {
    const issues: CodeReviewIssue[] = [];

    try {
      const prompt = `
You are an expert code reviewer. Analyze the following code and identify any issues, improvements, or best practices violations. 
Focus on:
1. Potential bugs and logic errors
2. Security vulnerabilities
3. Performance optimizations
4. Code clarity and maintainability
5. Best practices and design patterns

Provide specific, actionable feedback with line numbers where applicable.

File: ${filePath}
Code:
\`\`\`
${code}
\`\`\`

Respond in JSON format with an array of issues:
{
  "issues": [
    {
      "type": "error|warning|suggestion",
      "severity": "critical|high|medium|low",
      "line": <line_number>,
      "message": "<brief description>",
      "explanation": "<detailed explanation>",
      "suggestion": "<how to fix>",
      "fixCode": "<suggested fix code if applicable>"
    }
  ]
}
`;

      const response = await aiProviderManager.generateResponse(provider, [
        { role: 'system', content: 'You are an expert code reviewer providing detailed, actionable feedback.' },
        { role: 'user', content: prompt }
      ]);

      try {
        const aiResponse = JSON.parse(response);
        if (aiResponse.issues && Array.isArray(aiResponse.issues)) {
          for (const issue of aiResponse.issues) {
            issues.push({
              id: `ai-${Date.now()}-${Math.random()}`,
              fileId: fileId || 0,
              filePath,
              type: issue.type || 'suggestion',
              severity: issue.severity || 'medium',
              line: issue.line || 1,
              message: issue.message,
              explanation: issue.explanation,
              suggestion: issue.suggestion,
              fixCode: issue.fixCode,
              category: 'AI Analysis',
              rule: 'ai-review',
              confidence: 0.85
            });
          }
        }
      } catch (parseError) {
        logger.warn('Failed to parse AI response:', parseError);
      }
    } catch (error) {
      logger.error('AI analysis failed:', error);
    }

    return issues;
  }

  private calculateMetrics(issues: CodeReviewIssue[], code: string): CodeReviewResult['metrics'] {
    const lines = code.split('\n').length;
    
    const criticalIssues = issues.filter(i => i.severity === 'critical').length;
    const highIssues = issues.filter(i => i.severity === 'high').length;
    const mediumIssues = issues.filter(i => i.severity === 'medium').length;
    const lowIssues = issues.filter(i => i.severity === 'low').length;
    const securityIssues = issues.filter(i => i.type === 'security').length;
    const performanceIssues = issues.filter(i => i.type === 'performance').length;

    // Calculate code quality score (0-100)
    const baseScore = 100;
    const deductions = 
      (criticalIssues * 15) +
      (highIssues * 10) +
      (mediumIssues * 5) +
      (lowIssues * 2);
    
    const codeQualityScore = Math.max(0, Math.min(100, baseScore - deductions));

    // Simple complexity calculation
    const complexity = Math.round((issues.filter(i => i.category === 'Complexity').length / lines) * 100);
    
    // Maintainability index (simplified)
    const maintainability = Math.max(0, Math.min(100, 100 - (issues.length / lines) * 50));

    return {
      totalIssues: issues.length,
      criticalIssues,
      highIssues,
      mediumIssues,
      lowIssues,
      securityIssues,
      performanceIssues,
      codeQualityScore,
      complexity,
      maintainability
    };
  }

  private async generateReviewSummary(
    issues: CodeReviewIssue[],
    metrics: CodeReviewResult['metrics'],
    provider: string
  ): Promise<string> {
    if (issues.length === 0) {
      return '✅ Excellent! No issues found in this code review.';
    }

    const summary = [
      `📊 Code Review Summary`,
      `Quality Score: ${metrics.codeQualityScore}/100`,
      `Total Issues: ${metrics.totalIssues}`,
      ''
    ];

    if (metrics.criticalIssues > 0) {
      summary.push(`🔴 Critical Issues: ${metrics.criticalIssues} - Immediate attention required`);
    }
    if (metrics.highIssues > 0) {
      summary.push(`🟠 High Priority: ${metrics.highIssues} - Should be fixed before deployment`);
    }
    if (metrics.mediumIssues > 0) {
      summary.push(`🟡 Medium Priority: ${metrics.mediumIssues} - Fix in next iteration`);
    }
    if (metrics.securityIssues > 0) {
      summary.push(`🔒 Security Issues: ${metrics.securityIssues} - Review security implications`);
    }
    if (metrics.performanceIssues > 0) {
      summary.push(`⚡ Performance Issues: ${metrics.performanceIssues} - May impact user experience`);
    }

    summary.push('', '📝 Top Recommendations:');
    
    // Get top 3 most important issues
    const topIssues = issues
      .sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      })
      .slice(0, 3);

    topIssues.forEach((issue, index) => {
      summary.push(`${index + 1}. ${issue.message} (Line ${issue.line})`);
    });

    return summary.join('\n');
  }

  private getLanguageFromExtension(extension: string): string {
    const languageMap: Record<string, string> = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.cs': 'csharp',
      '.go': 'go',
      '.rs': 'rust',
      '.rb': 'ruby',
      '.php': 'php',
      '.swift': 'swift',
      '.kt': 'kotlin'
    };

    return languageMap[extension] || 'plaintext';
  }

  private isInSQLContext(line: string): boolean {
    const sqlKeywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'FROM', 'WHERE'];
    return sqlKeywords.some(keyword => 
      line.toUpperCase().includes(keyword)
    );
  }

  private getSecuritySuggestion(message: string): string {
    const suggestions: Record<string, string> = {
      'eval': 'Use JSON.parse() for JSON data or Function constructor with careful validation',
      'innerHTML': 'Use textContent for plain text or a sanitization library like DOMPurify',
      'document.write': 'Use createElement and appendChild or modern frameworks',
      'environment variable': 'Provide a fallback value: process.env.VAR || "default"',
      'sensitive information': 'Use environment variables or a secure secret management system'
    };

    for (const [key, suggestion] of Object.entries(suggestions)) {
      if (message.toLowerCase().includes(key)) {
        return suggestion;
      }
    }

    return 'Review and apply security best practices';
  }

  async applyFix(
    projectId: string,
    fileId: number,
    issueId: string,
    fixCode: string
  ): Promise<boolean> {
    try {
      // This would integrate with the file system to apply the fix
      // For now, we return the fix code for the frontend to apply
      logger.info(`Applying fix for issue ${issueId} in file ${fileId}`);
      return true;
    } catch (error) {
      logger.error('Failed to apply fix:', error);
      return false;
    }
  }

  async generateReport(
    projectId: string,
    format: 'json' | 'html' | 'markdown' = 'markdown'
  ): Promise<string> {
    // Generate a comprehensive report of all reviews for a project
    const reviews = []; // Would fetch from database
    
    if (format === 'markdown') {
      return `# Code Review Report
## Project: ${projectId}
## Generated: ${new Date().toISOString()}

### Summary
- Total Files Reviewed: 0
- Total Issues Found: 0
- Average Code Quality: N/A

### Details
No reviews available yet.
`;
    }

    return JSON.stringify({ projectId, reviews }, null, 2);
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const aiCodeReviewService = new AICodeReviewService();