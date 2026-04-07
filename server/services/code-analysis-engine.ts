// @ts-nocheck
import * as babel from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import * as ts from 'typescript';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { createLogger } from '../utils/logger';

const logger = createLogger('code-analysis-engine');
const execAsync = promisify(exec);

export interface AnalysisMetrics {
  linesOfCode: number;
  cyclomaticComplexity: number;
  maintainabilityIndex: number;
  technicalDebt: number; // in minutes
  testCoverage?: number;
  duplicateCodeRatio: number;
  commentRatio: number;
  couplingScore: number;
  cohesionScore: number;
}

export interface SecurityVulnerability {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  cwe?: string; // Common Weakness Enumeration
  owasp?: string; // OWASP category
  location: {
    file: string;
    line: number;
    column?: number;
  };
  description: string;
  remediation: string;
  confidence: number;
}

export interface PerformanceIssue {
  id: string;
  type: string;
  impact: 'high' | 'medium' | 'low';
  location: {
    file: string;
    line: number;
    column?: number;
  };
  description: string;
  optimization: string;
  estimatedImprovement?: string;
}

export interface CodeSmell {
  id: string;
  type: string;
  severity: 'major' | 'minor' | 'info';
  location: {
    file: string;
    line: number;
    endLine?: number;
  };
  description: string;
  refactoringSuggestion?: string;
}

export interface TestSuggestion {
  id: string;
  targetFunction: string;
  location: {
    file: string;
    line: number;
  };
  testType: 'unit' | 'integration' | 'e2e';
  priority: 'high' | 'medium' | 'low';
  suggestedTests: string[];
  coverage?: number;
}

export interface AnalysisResult {
  projectId: string;
  fileId?: number;
  filePath: string;
  language: string;
  metrics: AnalysisMetrics;
  securityVulnerabilities: SecurityVulnerability[];
  performanceIssues: PerformanceIssue[];
  codeSmells: CodeSmell[];
  testSuggestions: TestSuggestion[];
  dependencies: string[];
  timestamp: Date;
}

class CodeAnalysisEngine {
  private cache: Map<string, AnalysisResult> = new Map();
  private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes

  async analyzeFile(
    projectId: string,
    filePath: string,
    content: string,
    fileId?: number
  ): Promise<AnalysisResult> {
    const cacheKey = `${projectId}-${filePath}-${crypto.createHash('sha256').update(content).digest('hex')}`;
    
    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp.getTime()) < this.CACHE_TTL) {
      return cached;
    }

    const language = this.detectLanguage(filePath);
    
    // Run analyses in parallel
    const [
      metrics,
      securityVulnerabilities,
      performanceIssues,
      codeSmells,
      testSuggestions,
      dependencies
    ] = await Promise.all([
      this.calculateMetrics(content, language),
      this.detectSecurityVulnerabilities(content, filePath, language),
      this.detectPerformanceIssues(content, filePath, language),
      this.detectCodeSmells(content, filePath, language),
      this.generateTestSuggestions(content, filePath, language),
      this.extractDependencies(content, language)
    ]);

    const result: AnalysisResult = {
      projectId,
      fileId,
      filePath,
      language,
      metrics,
      securityVulnerabilities,
      performanceIssues,
      codeSmells,
      testSuggestions,
      dependencies,
      timestamp: new Date()
    };

    // Cache result
    this.cache.set(cacheKey, result);

    return result;
  }

  private async calculateMetrics(content: string, language: string): Promise<AnalysisMetrics> {
    const lines = content.split('\n');
    const linesOfCode = lines.filter(line => line.trim() && !line.trim().startsWith('//')).length;
    
    let cyclomaticComplexity = 1;
    let maintainabilityIndex = 100;
    let technicalDebt = 0;
    let duplicateCodeRatio = 0;
    let commentRatio = 0;
    let couplingScore = 0;
    let cohesionScore = 100;

    if (language === 'javascript' || language === 'typescript') {
      try {
        const ast = babel.parse(content, {
          sourceType: 'module',
          plugins: ['typescript', 'jsx']
        });

        // Calculate cyclomatic complexity
        traverse(ast, {
          IfStatement() { cyclomaticComplexity++; },
          ConditionalExpression() { cyclomaticComplexity++; },
          ForStatement() { cyclomaticComplexity++; },
          ForInStatement() { cyclomaticComplexity++; },
          ForOfStatement() { cyclomaticComplexity++; },
          WhileStatement() { cyclomaticComplexity++; },
          DoWhileStatement() { cyclomaticComplexity++; },
          SwitchCase() { cyclomaticComplexity++; },
          CatchClause() { cyclomaticComplexity++; },
          LogicalExpression(path) {
            if (path.node.operator === '&&' || path.node.operator === '||') {
              cyclomaticComplexity++;
            }
          }
        });

        // Calculate comment ratio
        const commentLines = lines.filter(line => 
          line.trim().startsWith('//') || 
          line.trim().startsWith('/*') || 
          line.trim().startsWith('*')
        ).length;
        commentRatio = (commentLines / lines.length) * 100;

        // Calculate maintainability index (simplified Microsoft formula)
        const volume = linesOfCode * Math.log2(cyclomaticComplexity + 1);
        maintainabilityIndex = Math.max(0, 
          (171 - 5.2 * Math.log(volume) - 0.23 * cyclomaticComplexity - 16.2 * Math.log(linesOfCode)) * 100 / 171
        );

        // Estimate technical debt (minutes)
        technicalDebt = Math.round(
          (cyclomaticComplexity > 10 ? (cyclomaticComplexity - 10) * 30 : 0) +
          (linesOfCode > 200 ? (linesOfCode - 200) * 0.5 : 0) +
          (commentRatio < 10 ? 60 : 0)
        );

        // Calculate duplicate code ratio
        duplicateCodeRatio = this.calculateDuplicateRatio(lines);

        // Calculate coupling and cohesion
        const { coupling, cohesion } = this.calculateCouplingCohesion(ast);
        couplingScore = coupling;
        cohesionScore = cohesion;

      } catch (error) {
        logger.warn('Failed to calculate detailed metrics:', error);
      }
    }

    return {
      linesOfCode,
      cyclomaticComplexity,
      maintainabilityIndex,
      technicalDebt,
      duplicateCodeRatio,
      commentRatio,
      couplingScore,
      cohesionScore
    };
  }

  private calculateDuplicateRatio(lines: string[]): number {
    const blockSize = 5;
    const blocks = new Set<string>();
    let duplicateBlocks = 0;
    let totalBlocks = 0;

    for (let i = 0; i <= lines.length - blockSize; i++) {
      const block = lines.slice(i, i + blockSize)
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('//'))
        .join('\n');
      
      if (block.length > 50) {
        totalBlocks++;
        if (blocks.has(block)) {
          duplicateBlocks++;
        } else {
          blocks.add(block);
        }
      }
    }

    return totalBlocks > 0 ? (duplicateBlocks / totalBlocks) * 100 : 0;
  }

  private calculateCouplingCohesion(ast: any): { coupling: number; cohesion: number } {
    let imports = 0;
    let exports = 0;
    let internalCalls = 0;
    let externalCalls = 0;
    const functionNames = new Set<string>();

    traverse(ast, {
      ImportDeclaration() { imports++; },
      ExportNamedDeclaration() { exports++; },
      ExportDefaultDeclaration() { exports++; },
      FunctionDeclaration(path) {
        const name = path.node.id?.name;
        if (name) functionNames.add(name);
      },
      CallExpression(path) {
        if (t.isIdentifier(path.node.callee)) {
          const name = path.node.callee.name;
          if (functionNames.has(name)) {
            internalCalls++;
          } else {
            externalCalls++;
          }
        }
      }
    });

    // Simplified coupling score (lower is better)
    const coupling = Math.min(100, (imports + externalCalls) * 2);
    
    // Simplified cohesion score (higher is better)
    const cohesion = Math.max(0, Math.min(100, 
      100 - (exports * 5) + (internalCalls * 2)
    ));

    return { coupling, cohesion };
  }

  private async detectSecurityVulnerabilities(
    content: string,
    filePath: string,
    language: string
  ): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];

    // Common vulnerability patterns
    const patterns = [
      {
        regex: /eval\s*\(/g,
        type: 'Code Injection',
        cwe: 'CWE-94',
        owasp: 'A03:2021',
        severity: 'critical' as const,
        description: 'Use of eval() can lead to code injection attacks',
        remediation: 'Avoid eval(). Use JSON.parse() for JSON or safer alternatives'
      },
      {
        regex: /innerHTML\s*=/g,
        type: 'Cross-Site Scripting (XSS)',
        cwe: 'CWE-79',
        owasp: 'A03:2021',
        severity: 'high' as const,
        description: 'Direct innerHTML assignment can lead to XSS',
        remediation: 'Use textContent or sanitize input with DOMPurify'
      },
      {
        regex: /SELECT.*FROM.*WHERE.*\$\{/g,
        type: 'SQL Injection',
        cwe: 'CWE-89',
        owasp: 'A03:2021',
        severity: 'critical' as const,
        description: 'Potential SQL injection via string interpolation',
        remediation: 'Use parameterized queries or prepared statements'
      },
      {
        regex: /require\s*\(.*\$\{/g,
        type: 'Path Traversal',
        cwe: 'CWE-22',
        owasp: 'A01:2021',
        severity: 'high' as const,
        description: 'Dynamic require with user input can lead to path traversal',
        remediation: 'Validate and sanitize file paths, use a whitelist approach'
      },
      {
        regex: /localStorage\.setItem\s*\([^,]*,\s*[^)]*password/gi,
        type: 'Sensitive Data Exposure',
        cwe: 'CWE-312',
        owasp: 'A02:2021',
        severity: 'high' as const,
        description: 'Storing sensitive data in localStorage',
        remediation: 'Never store passwords or sensitive data in localStorage'
      },
      {
        regex: /crypto\.createHash\s*\(['"]md5['"]/g,
        type: 'Weak Cryptography',
        cwe: 'CWE-328',
        owasp: 'A02:2021',
        severity: 'medium' as const,
        description: 'MD5 is cryptographically broken',
        remediation: 'Use SHA-256 or stronger hashing algorithms'
      },
      {
        regex: /http:\/\//g,
        type: 'Insecure Protocol',
        cwe: 'CWE-319',
        owasp: 'A02:2021',
        severity: 'medium' as const,
        description: 'Using HTTP instead of HTTPS',
        remediation: 'Always use HTTPS for network communication'
      },
      {
        regex: /Math\.random\(\)/g,
        type: 'Weak Random Number Generation',
        cwe: 'CWE-338',
        owasp: 'A02:2021',
        severity: 'low' as const,
        description: 'Math.random() is not cryptographically secure',
        remediation: 'Use crypto.randomBytes() for security-sensitive operations',
        contextCheck: (line: string) => {
          return line.includes('token') || line.includes('password') || line.includes('secret');
        }
      }
    ];

    const lines = content.split('\n');
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.regex.exec(content)) !== null) {
        const line = content.substring(0, match.index).split('\n').length;
        const lineContent = lines[line - 1];
        
        // Skip if there's a context check that fails
        if (pattern.contextCheck && !pattern.contextCheck(lineContent)) {
          continue;
        }

        vulnerabilities.push({
          id: `vuln-${Date.now()}-${Math.random()}`,
          type: pattern.type,
          severity: pattern.severity,
          cwe: pattern.cwe,
          owasp: pattern.owasp,
          location: {
            file: filePath,
            line,
            column: match.index - content.lastIndexOf('\n', match.index - 1)
          },
          description: pattern.description,
          remediation: pattern.remediation,
          confidence: 0.85
        });
      }
    }

    // Language-specific vulnerability detection
    if (language === 'javascript' || language === 'typescript') {
      vulnerabilities.push(...await this.detectJSVulnerabilities(content, filePath));
    }

    return vulnerabilities;
  }

  private async detectJSVulnerabilities(
    content: string,
    filePath: string
  ): Promise<SecurityVulnerability[]> {
    const vulnerabilities: SecurityVulnerability[] = [];

    try {
      const ast = babel.parse(content, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx']
      });

      traverse(ast, {
        // Detect prototype pollution
        MemberExpression(path) {
          if (t.isIdentifier(path.node.property) && 
              path.node.property.name === '__proto__') {
            vulnerabilities.push({
              id: `vuln-${Date.now()}-${Math.random()}`,
              type: 'Prototype Pollution',
              severity: 'high',
              cwe: 'CWE-1321',
              owasp: 'A03:2021',
              location: {
                file: filePath,
                line: path.node.loc?.start.line || 0
              },
              description: 'Direct __proto__ access can lead to prototype pollution',
              remediation: 'Use Object.create(null) or Map for dynamic properties',
              confidence: 0.9
            });
          }
        },

        // Detect open redirects
        CallExpression(path) {
          if (t.isMemberExpression(path.node.callee) &&
              t.isIdentifier(path.node.callee.property) &&
              path.node.callee.property.name === 'redirect') {
            const arg = path.node.arguments[0];
            if (t.isIdentifier(arg) || t.isMemberExpression(arg)) {
              vulnerabilities.push({
                id: `vuln-${Date.now()}-${Math.random()}`,
                type: 'Open Redirect',
                severity: 'medium',
                cwe: 'CWE-601',
                owasp: 'A01:2021',
                location: {
                  file: filePath,
                  line: path.node.loc?.start.line || 0
                },
                description: 'Unvalidated redirect with user input',
                remediation: 'Validate redirect URLs against a whitelist',
                confidence: 0.75
              });
            }
          }
        }
      });
    } catch (error) {
      logger.warn('Failed to detect JS-specific vulnerabilities:', error);
    }

    return vulnerabilities;
  }

  private async detectPerformanceIssues(
    content: string,
    filePath: string,
    language: string
  ): Promise<PerformanceIssue[]> {
    const issues: PerformanceIssue[] = [];

    if (language === 'javascript' || language === 'typescript') {
      try {
        const ast = babel.parse(content, {
          sourceType: 'module',
          plugins: ['typescript', 'jsx']
        });

        traverse(ast, {
          // Detect N+1 query patterns
          ForStatement(path) {
            traverse(path.node, {
              CallExpression(innerPath) {
                const callee = innerPath.node.callee;
                if (t.isMemberExpression(callee) && 
                    t.isIdentifier(callee.property) &&
                    (callee.property.name === 'query' || 
                     callee.property.name === 'findOne' ||
                     callee.property.name === 'fetch')) {
                  issues.push({
                    id: `perf-${Date.now()}-${Math.random()}`,
                    type: 'N+1 Query',
                    impact: 'high',
                    location: {
                      file: filePath,
                      line: innerPath.node.loc?.start.line || 0
                    },
                    description: 'Database query inside loop can cause N+1 problem',
                    optimization: 'Use batch queries or eager loading',
                    estimatedImprovement: '10-100x faster for large datasets'
                  });
                }
              }
            }, path.scope, path);
          },

          // Detect inefficient array operations
          CallExpression(path) {
            if (t.isMemberExpression(path.node.callee)) {
              const property = path.node.callee.property as any;
              
              // Check for array.find().map() or similar chains
              if (property.name === 'map' || property.name === 'filter') {
                const object = path.node.callee.object;
                if (t.isCallExpression(object) && 
                    t.isMemberExpression(object.callee)) {
                  const innerProperty = object.callee.property as any;
                  if (innerProperty.name === 'filter' || 
                      innerProperty.name === 'map' ||
                      innerProperty.name === 'find') {
                    issues.push({
                      id: `perf-${Date.now()}-${Math.random()}`,
                      type: 'Inefficient Array Chain',
                      impact: 'medium',
                      location: {
                        file: filePath,
                        line: path.node.loc?.start.line || 0
                      },
                      description: 'Multiple array iterations can be combined',
                      optimization: 'Use reduce() or a single loop to avoid multiple passes',
                      estimatedImprovement: '2-3x faster for large arrays'
                    });
                  }
                }
              }

              // Detect array.includes() in loops
              if (property.name === 'includes' || property.name === 'indexOf') {
                let inLoop = false;
                path.traverse({
                  ForStatement() { inLoop = true; },
                  WhileStatement() { inLoop = true; },
                  DoWhileStatement() { inLoop = true; }
                });

                if (inLoop) {
                  issues.push({
                    id: `perf-${Date.now()}-${Math.random()}`,
                    type: 'Linear Search in Loop',
                    impact: 'medium',
                    location: {
                      file: filePath,
                      line: path.node.loc?.start.line || 0
                    },
                    description: 'Array search in loop has O(n²) complexity',
                    optimization: 'Use Set or Map for O(1) lookups',
                    estimatedImprovement: 'O(n²) to O(n) improvement'
                  });
                }
              }
            }
          },

          // Detect synchronous file operations
          Identifier(path) {
            if (path.node.name.endsWith('Sync') && 
                (path.node.name.startsWith('read') || 
                 path.node.name.startsWith('write'))) {
              issues.push({
                id: `perf-${Date.now()}-${Math.random()}`,
                type: 'Blocking I/O',
                impact: 'high',
                location: {
                  file: filePath,
                  line: path.node.loc?.start.line || 0
                },
                description: 'Synchronous file operation blocks event loop',
                optimization: 'Use async/await or promises for file operations',
                estimatedImprovement: 'Non-blocking I/O improves concurrency'
              });
            }
          }
        });
      } catch (error) {
        logger.warn('Failed to detect performance issues:', error);
      }
    }

    return issues;
  }

  private async detectCodeSmells(
    content: string,
    filePath: string,
    language: string
  ): Promise<CodeSmell[]> {
    const smells: CodeSmell[] = [];
    const lines = content.split('\n');

    // Long method detection
    const functions = this.extractFunctions(content, language);
    for (const func of functions) {
      if (func.lineCount > 50) {
        smells.push({
          id: `smell-${Date.now()}-${Math.random()}`,
          type: 'Long Method',
          severity: 'major',
          location: {
            file: filePath,
            line: func.startLine,
            endLine: func.endLine
          },
          description: `Function '${func.name}' is too long (${func.lineCount} lines)`,
          refactoringSuggestion: 'Extract smaller functions with single responsibilities'
        });
      }

      // Too many parameters
      if (func.paramCount > 5) {
        smells.push({
          id: `smell-${Date.now()}-${Math.random()}`,
          type: 'Long Parameter List',
          severity: 'major',
          location: {
            file: filePath,
            line: func.startLine
          },
          description: `Function '${func.name}' has too many parameters (${func.paramCount})`,
          refactoringSuggestion: 'Use an options object or extract a class'
        });
      }
    }

    // God class detection
    if (lines.length > 500) {
      smells.push({
        id: `smell-${Date.now()}-${Math.random()}`,
        type: 'God Class',
        severity: 'major',
        location: {
          file: filePath,
          line: 1,
          endLine: lines.length
        },
        description: `File is too large (${lines.length} lines)`,
        refactoringSuggestion: 'Split into smaller, focused modules'
      });
    }

    // Deeply nested code
    let maxIndentation = 0;
    let maxIndentLine = 0;
    lines.forEach((line, index) => {
      const indent = line.match(/^(\s*)/)?.[1].length || 0;
      if (indent > maxIndentation) {
        maxIndentation = indent;
        maxIndentLine = index + 1;
      }
    });

    if (maxIndentation > 24) { // More than 6 levels of indentation
      smells.push({
        id: `smell-${Date.now()}-${Math.random()}`,
        type: 'Deep Nesting',
        severity: 'major',
        location: {
          file: filePath,
          line: maxIndentLine
        },
        description: 'Code is deeply nested, reducing readability',
        refactoringSuggestion: 'Extract methods or use early returns to reduce nesting'
      });
    }

    // Duplicate code detection
    const duplicates = this.findDuplicateCode(lines);
    for (const dup of duplicates) {
      smells.push({
        id: `smell-${Date.now()}-${Math.random()}`,
        type: 'Duplicate Code',
        severity: 'major',
        location: {
          file: filePath,
          line: dup.line,
          endLine: dup.endLine
        },
        description: `Duplicate code block (${dup.size} lines)`,
        refactoringSuggestion: 'Extract common code into a reusable function'
      });
    }

    // Dead code detection (commented code blocks)
    let commentBlockStart = -1;
    lines.forEach((line, index) => {
      if (line.trim().startsWith('/*')) {
        commentBlockStart = index + 1;
      } else if (line.trim().endsWith('*/') && commentBlockStart !== -1) {
        const blockSize = index - commentBlockStart + 2;
        if (blockSize > 10) {
          smells.push({
            id: `smell-${Date.now()}-${Math.random()}`,
            type: 'Dead Code',
            severity: 'minor',
            location: {
              file: filePath,
              line: commentBlockStart,
              endLine: index + 1
            },
            description: 'Large block of commented code',
            refactoringSuggestion: 'Remove commented code and rely on version control'
          });
        }
        commentBlockStart = -1;
      }
    });

    return smells;
  }

  private extractFunctions(content: string, language: string): Array<{
    name: string;
    startLine: number;
    endLine: number;
    lineCount: number;
    paramCount: number;
  }> {
    const functions: Array<{
      name: string;
      startLine: number;
      endLine: number;
      lineCount: number;
      paramCount: number;
    }> = [];

    if (language === 'javascript' || language === 'typescript') {
      try {
        const ast = babel.parse(content, {
          sourceType: 'module',
          plugins: ['typescript', 'jsx']
        });

        traverse(ast, {
          FunctionDeclaration(path) {
            const node = path.node;
            functions.push({
              name: node.id?.name || 'anonymous',
              startLine: node.loc?.start.line || 0,
              endLine: node.loc?.end.line || 0,
              lineCount: (node.loc?.end.line || 0) - (node.loc?.start.line || 0) + 1,
              paramCount: node.params.length
            });
          },
          ArrowFunctionExpression(path) {
            const node = path.node;
            const parent = path.parent;
            let name = 'anonymous';
            
            if (t.isVariableDeclarator(parent) && t.isIdentifier(parent.id)) {
              name = parent.id.name;
            }

            functions.push({
              name,
              startLine: node.loc?.start.line || 0,
              endLine: node.loc?.end.line || 0,
              lineCount: (node.loc?.end.line || 0) - (node.loc?.start.line || 0) + 1,
              paramCount: node.params.length
            });
          }
        });
      } catch (error) {
        logger.warn('Failed to extract functions:', error);
      }
    }

    return functions;
  }

  private findDuplicateCode(lines: string[]): Array<{
    line: number;
    endLine: number;
    size: number;
  }> {
    const duplicates: Array<{
      line: number;
      endLine: number;
      size: number;
    }> = [];
    
    const minSize = 10;
    const seen = new Map<string, number>();

    for (let i = 0; i < lines.length - minSize; i++) {
      const block = lines.slice(i, i + minSize)
        .map(l => l.trim())
        .filter(l => l && !l.startsWith('//'))
        .join('\n');
      
      if (block.length > 100) {
        const hash = crypto.createHash('sha256').update(block).digest('hex');
        
        if (seen.has(hash)) {
          duplicates.push({
            line: i + 1,
            endLine: i + minSize,
            size: minSize
          });
        } else {
          seen.set(hash, i);
        }
      }
    }

    return duplicates;
  }

  private async generateTestSuggestions(
    content: string,
    filePath: string,
    language: string
  ): Promise<TestSuggestion[]> {
    const suggestions: TestSuggestion[] = [];

    if (language === 'javascript' || language === 'typescript') {
      try {
        const ast = babel.parse(content, {
          sourceType: 'module',
          plugins: ['typescript', 'jsx']
        });

        const exportedFunctions = new Set<string>();
        
        traverse(ast, {
          ExportNamedDeclaration(path) {
            if (path.node.declaration) {
              if (t.isFunctionDeclaration(path.node.declaration)) {
                const name = path.node.declaration.id?.name;
                if (name) exportedFunctions.add(name);
              }
            }
          },
          
          FunctionDeclaration(path) {
            const node = path.node;
            const name = node.id?.name;
            
            if (!name) return;
            
            // Prioritize exported functions
            const isExported = exportedFunctions.has(name);
            const hasComplexLogic = this.calculateCyclomaticComplexity(node) > 5;
            const hasParams = node.params.length > 0;
            
            if (isExported || hasComplexLogic || hasParams) {
              const priority = isExported ? 'high' : hasComplexLogic ? 'medium' : 'low';
              
              suggestions.push({
                id: `test-${Date.now()}-${Math.random()}`,
                targetFunction: name,
                location: {
                  file: filePath,
                  line: node.loc?.start.line || 0
                },
                testType: 'unit',
                priority,
                suggestedTests: this.generateTestCases(node),
                coverage: 0
              });
            }
          }
        });
      } catch (error) {
        logger.warn('Failed to generate test suggestions:', error);
      }
    }

    return suggestions;
  }

  private generateTestCases(functionNode: any): string[] {
    const tests: string[] = [];
    const functionName = functionNode.id?.name || 'function';
    
    // Basic test cases
    tests.push(`should execute ${functionName} without errors`);
    
    // Parameter-based tests
    if (functionNode.params.length > 0) {
      tests.push(`should handle null/undefined parameters in ${functionName}`);
      tests.push(`should validate input types in ${functionName}`);
    }
    
    // Logic-based tests
    let hasConditional = false;
    let hasLoop = false;
    let hasErrorHandling = false;
    
    traverse(functionNode, {
      IfStatement() { hasConditional = true; },
      ConditionalExpression() { hasConditional = true; },
      ForStatement() { hasLoop = true; },
      WhileStatement() { hasLoop = true; },
      TryStatement() { hasErrorHandling = true; },
      ThrowStatement() { hasErrorHandling = true; }
    }, functionNode.scope, functionNode);
    
    if (hasConditional) {
      tests.push(`should test all conditional branches in ${functionName}`);
    }
    
    if (hasLoop) {
      tests.push(`should handle empty arrays/collections in ${functionName}`);
      tests.push(`should handle large datasets in ${functionName}`);
    }
    
    if (hasErrorHandling) {
      tests.push(`should handle errors gracefully in ${functionName}`);
      tests.push(`should throw appropriate errors in ${functionName}`);
    }
    
    return tests;
  }

  private calculateCyclomaticComplexity(node: any): number {
    let complexity = 1;

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

  private async extractDependencies(content: string, language: string): Promise<string[]> {
    const dependencies: string[] = [];

    if (language === 'javascript' || language === 'typescript') {
      try {
        const ast = babel.parse(content, {
          sourceType: 'module',
          plugins: ['typescript', 'jsx']
        });

        traverse(ast, {
          ImportDeclaration(path) {
            const source = path.node.source.value;
            if (!source.startsWith('.') && !source.startsWith('/')) {
              dependencies.push(source);
            }
          },
          CallExpression(path) {
            if (t.isIdentifier(path.node.callee) && 
                path.node.callee.name === 'require') {
              const arg = path.node.arguments[0];
              if (t.isStringLiteral(arg) && 
                  !arg.value.startsWith('.') && 
                  !arg.value.startsWith('/')) {
                dependencies.push(arg.value);
              }
            }
          }
        });
      } catch (error) {
        logger.warn('Failed to extract dependencies:', error);
      }
    }

    return [...new Set(dependencies)];
  }

  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
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
      '.kt': 'kotlin',
      '.r': 'r',
      '.m': 'matlab'
    };

    return languageMap[ext] || 'unknown';
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const codeAnalysisEngine = new CodeAnalysisEngine();