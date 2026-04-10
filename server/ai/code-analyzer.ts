import * as ts from 'typescript';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import * as sqlParser from 'node-sql-parser';
import { createLogger } from '../utils/logger';

const logger = createLogger('code-analyzer');

export interface CodeContext {
  language: string;
  imports: ImportInfo[];
  functions: FunctionInfo[];
  classes: ClassInfo[];
  variables: VariableInfo[];
  dependencies: string[];
  complexity: number;
  patterns: CodePattern[];
  suggestions: CodeSuggestion[];
}

export interface ImportInfo {
  module: string;
  imports: string[];
  isDefault: boolean;
  isNamespace: boolean;
  line: number;
}

export interface FunctionInfo {
  name: string;
  params: ParamInfo[];
  returnType?: string;
  isAsync: boolean;
  isGenerator: boolean;
  complexity: number;
  line: number;
  body?: string;
  calls: string[];
}

export interface ParamInfo {
  name: string;
  type?: string;
  isOptional: boolean;
  defaultValue?: any;
}

export interface ClassInfo {
  name: string;
  extends?: string;
  implements: string[];
  methods: FunctionInfo[];
  properties: PropertyInfo[];
  line: number;
}

export interface PropertyInfo {
  name: string;
  type?: string;
  visibility: 'public' | 'private' | 'protected';
  isStatic: boolean;
  line: number;
}

export interface VariableInfo {
  name: string;
  type?: string;
  value?: any;
  isConst: boolean;
  scope: string;
  line: number;
}

export interface CodePattern {
  type: string;
  description: string;
  severity: 'info' | 'warning' | 'error';
  line: number;
  suggestion?: string;
}

export interface CodeSuggestion {
  type: 'refactor' | 'performance' | 'security' | 'style';
  description: string;
  code?: string;
  priority: 'low' | 'medium' | 'high';
}

export class CodeAnalyzer {
  private typeChecker?: ts.TypeChecker;

  async analyzeCode(code: string, language: string, filePath?: string): Promise<CodeContext> {
    const context: CodeContext = {
      language,
      imports: [],
      functions: [],
      classes: [],
      variables: [],
      dependencies: [],
      complexity: 0,
      patterns: [],
      suggestions: []
    };

    try {
      switch (language.toLowerCase()) {
        case 'typescript':
        case 'javascript':
        case 'tsx':
        case 'jsx':
          await this.analyzeJavaScriptTypeScript(code, context, language);
          break;
        case 'python':
          await this.analyzePython(code, context);
          break;
        case 'java':
          await this.analyzeJava(code, context);
          break;
        case 'sql':
          await this.analyzeSQL(code, context);
          break;
        default:
          await this.analyzeGeneric(code, context);
      }

      // Analyze patterns and generate suggestions
      this.detectCodePatterns(context);
      this.generateSuggestions(context);

    } catch (error) {
      logger.error(`Error analyzing ${language} code:`, error);
    }

    return context;
  }

  private async analyzeJavaScriptTypeScript(code: string, context: CodeContext, language: string) {
    const isTypeScript = ['typescript', 'tsx'].includes(language.toLowerCase());

    if (isTypeScript) {
      // TypeScript analysis with type information
      const program = ts.createProgram(['temp.ts'], {
        target: ts.ScriptTarget.Latest,
        module: ts.ModuleKind.CommonJS,
        strict: true
      }, {
        getSourceFile: (fileName) => {
          if (fileName === 'temp.ts') {
            return ts.createSourceFile(fileName, code, ts.ScriptTarget.Latest, true);
          }
          return undefined;
        },
        writeFile: () => {},
        getCurrentDirectory: () => '',
        getDirectories: () => [],
        fileExists: () => true,
        readFile: () => '',
        getCanonicalFileName: (fileName) => fileName,
        useCaseSensitiveFileNames: () => true,
        getNewLine: () => '\n',
        getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options)
      });

      const sourceFile = program.getSourceFile('temp.ts');
      if (sourceFile) {
        this.typeChecker = program.getTypeChecker();
        this.analyzeTypeScriptAST(sourceFile, context);
      }
    } else {
      // JavaScript analysis with Babel
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript', 'decorators-legacy']
      });

      this.analyzeBabelAST(ast, context);
    }
  }

  private analyzeTypeScriptAST(sourceFile: ts.SourceFile, context: CodeContext) {
    const visit = (node: ts.Node) => {
      switch (node.kind) {
        case ts.SyntaxKind.ImportDeclaration:
          this.extractTypeScriptImport(node as ts.ImportDeclaration, context);
          break;
        case ts.SyntaxKind.FunctionDeclaration:
        case ts.SyntaxKind.MethodDeclaration:
          this.extractTypeScriptFunction(node as ts.FunctionDeclaration, context);
          break;
        case ts.SyntaxKind.ClassDeclaration:
          this.extractTypeScriptClass(node as ts.ClassDeclaration, context);
          break;
        case ts.SyntaxKind.VariableStatement:
          this.extractTypeScriptVariable(node as ts.VariableStatement, context);
          break;
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  private extractTypeScriptImport(node: ts.ImportDeclaration, context: CodeContext) {
    const moduleSpecifier = node.moduleSpecifier as ts.StringLiteral;
    const importInfo: ImportInfo = {
      module: moduleSpecifier.text,
      imports: [],
      isDefault: false,
      isNamespace: false,
      line: ts.getLineAndCharacterOfPosition(node.getSourceFile(), node.getStart()).line + 1
    };

    if (node.importClause) {
      if (node.importClause.name) {
        importInfo.isDefault = true;
        importInfo.imports.push(node.importClause.name.text);
      }

      if (node.importClause.namedBindings) {
        if (ts.isNamespaceImport(node.importClause.namedBindings)) {
          importInfo.isNamespace = true;
          importInfo.imports.push(node.importClause.namedBindings.name.text);
        } else if (ts.isNamedImports(node.importClause.namedBindings)) {
          node.importClause.namedBindings.elements.forEach(element => {
            importInfo.imports.push(element.name.text);
          });
        }
      }
    }

    context.imports.push(importInfo);
    
    // Track external dependencies
    if (!moduleSpecifier.text.startsWith('.') && !moduleSpecifier.text.startsWith('/')) {
      context.dependencies.push(moduleSpecifier.text);
    }
  }

  private extractTypeScriptFunction(node: ts.FunctionDeclaration | ts.MethodDeclaration, context: CodeContext) {
    const name = node.name ? node.name.getText() : '<anonymous>';
    const params: ParamInfo[] = node.parameters.map(param => ({
      name: param.name.getText(),
      type: this.typeChecker ? this.typeChecker.typeToString(this.typeChecker.getTypeAtLocation(param)) : undefined,
      isOptional: !!param.questionToken,
      defaultValue: param.initializer ? param.initializer.getText() : undefined
    }));

    const functionInfo: FunctionInfo = {
      name,
      params,
      returnType: node.type ? node.type.getText() : undefined,
      isAsync: !!node.modifiers?.some(m => m.kind === ts.SyntaxKind.AsyncKeyword),
      isGenerator: !!node.asteriskToken,
      complexity: this.calculateCyclomaticComplexity(node),
      line: ts.getLineAndCharacterOfPosition(node.getSourceFile(), node.getStart()).line + 1,
      calls: this.extractFunctionCalls(node)
    };

    context.functions.push(functionInfo);
    context.complexity += functionInfo.complexity;
  }

  private extractTypeScriptClass(node: ts.ClassDeclaration, context: CodeContext) {
    const classInfo: ClassInfo = {
      name: node.name ? node.name.text : '<anonymous>',
      extends: node.heritageClauses?.find(h => h.token === ts.SyntaxKind.ExtendsKeyword)?.types[0].getText(),
      implements: node.heritageClauses?.find(h => h.token === ts.SyntaxKind.ImplementsKeyword)?.types.map(t => t.getText()) || [],
      methods: [],
      properties: [],
      line: ts.getLineAndCharacterOfPosition(node.getSourceFile(), node.getStart()).line + 1
    };

    node.members.forEach(member => {
      if (ts.isMethodDeclaration(member)) {
        this.extractTypeScriptFunction(member, context);
        const lastFunction = context.functions[context.functions.length - 1];
        classInfo.methods.push(lastFunction);
        context.functions.pop(); // Remove from global functions
      } else if (ts.isPropertyDeclaration(member)) {
        const visibility = member.modifiers?.find(m => 
          [ts.SyntaxKind.PublicKeyword, ts.SyntaxKind.PrivateKeyword, ts.SyntaxKind.ProtectedKeyword].includes(m.kind)
        );

        classInfo.properties.push({
          name: member.name?.getText() || '',
          type: member.type?.getText(),
          visibility: visibility ? visibility.getText() as any : 'public',
          isStatic: !!member.modifiers?.some(m => m.kind === ts.SyntaxKind.StaticKeyword),
          line: ts.getLineAndCharacterOfPosition(member.getSourceFile(), member.getStart()).line + 1
        });
      }
    });

    context.classes.push(classInfo);
  }

  private extractTypeScriptVariable(node: ts.VariableStatement, context: CodeContext) {
    node.declarationList.declarations.forEach(decl => {
      const variableInfo: VariableInfo = {
        name: decl.name.getText(),
        type: this.typeChecker && ts.isIdentifier(decl.name) ? 
          this.typeChecker.typeToString(this.typeChecker.getTypeAtLocation(decl)) : undefined,
        value: decl.initializer?.getText(),
        isConst: !!(node.declarationList.flags & ts.NodeFlags.Const),
        scope: 'global', // Simplified, would need scope analysis
        line: ts.getLineAndCharacterOfPosition(node.getSourceFile(), node.getStart()).line + 1
      };

      context.variables.push(variableInfo);
    });
  }

  private analyzeBabelAST(ast: any, context: CodeContext) {
    traverse(ast, {
      ImportDeclaration(path) {
        const importInfo: ImportInfo = {
          module: path.node.source.value,
          imports: [],
          isDefault: false,
          isNamespace: false,
          line: path.node.loc?.start.line || 0
        };

        path.node.specifiers.forEach((spec: any) => {
          if (t.isImportDefaultSpecifier(spec)) {
            importInfo.isDefault = true;
            importInfo.imports.push(spec.local.name);
          } else if (t.isImportNamespaceSpecifier(spec)) {
            importInfo.isNamespace = true;
            importInfo.imports.push(spec.local.name);
          } else if (t.isImportSpecifier(spec)) {
            importInfo.imports.push(spec.local.name);
          }
        });

        context.imports.push(importInfo);
      },

      FunctionDeclaration(path) {
        const node = path.node;
        const functionInfo: FunctionInfo = {
          name: node.id?.name || '<anonymous>',
          params: node.params.map((param: any) => ({
            name: t.isIdentifier(param) ? param.name : 'unknown',
            isOptional: false
          })),
          isAsync: node.async,
          isGenerator: node.generator,
          complexity: 1, // Simplified
          line: node.loc?.start.line || 0,
          calls: []
        };

        context.functions.push(functionInfo);
      },

      ClassDeclaration(path) {
        const node = path.node;
        const classInfo: ClassInfo = {
          name: node.id?.name || '<anonymous>',
          extends: node.superClass ? (t.isIdentifier(node.superClass) ? node.superClass.name : 'unknown') : undefined,
          implements: [],
          methods: [],
          properties: [],
          line: node.loc?.start.line || 0
        };

        context.classes.push(classInfo);
      },

      VariableDeclaration(path) {
        path.node.declarations.forEach((decl: any) => {
          if (t.isIdentifier(decl.id)) {
            const variableInfo: VariableInfo = {
              name: decl.id.name,
              value: decl.init ? path.getSource().substring(decl.init.start!, decl.init.end!) : undefined,
              isConst: path.node.kind === 'const',
              scope: path.scope.block.type === 'Program' ? 'global' : 'local',
              line: decl.loc?.start.line || 0
            };

            context.variables.push(variableInfo);
          }
        });
      }
    });
  }

  private calculateCyclomaticComplexity(node: ts.Node): number {
    let complexity = 1;

    const visit = (n: ts.Node) => {
      switch (n.kind) {
        case ts.SyntaxKind.IfStatement:
        case ts.SyntaxKind.ConditionalExpression:
        case ts.SyntaxKind.CaseClause:
        case ts.SyntaxKind.CatchClause:
        case ts.SyntaxKind.WhileStatement:
        case ts.SyntaxKind.DoStatement:
        case ts.SyntaxKind.ForStatement:
        case ts.SyntaxKind.ForInStatement:
        case ts.SyntaxKind.ForOfStatement:
          complexity++;
          break;
        case ts.SyntaxKind.BinaryExpression:
          const op = (n as ts.BinaryExpression).operatorToken.kind;
          if (op === ts.SyntaxKind.AmpersandAmpersandToken || op === ts.SyntaxKind.BarBarToken) {
            complexity++;
          }
          break;
      }
      ts.forEachChild(n, visit);
    };

    if (node.kind === ts.SyntaxKind.FunctionDeclaration || node.kind === ts.SyntaxKind.MethodDeclaration) {
      const body = (node as ts.FunctionDeclaration).body;
      if (body) visit(body);
    } else {
      visit(node);
    }

    return complexity;
  }

  private extractFunctionCalls(node: ts.Node): string[] {
    const calls: string[] = [];

    const visit = (n: ts.Node) => {
      if (ts.isCallExpression(n)) {
        const expression = n.expression;
        if (ts.isIdentifier(expression)) {
          calls.push(expression.text);
        } else if (ts.isPropertyAccessExpression(expression)) {
          calls.push(expression.getText());
        }
      }
      ts.forEachChild(n, visit);
    };

    visit(node);
    return calls;
  }

  private async analyzePython(code: string, context: CodeContext) {
    // Python-specific analysis would require a Python AST parser
    // For now, we'll use regex-based pattern matching
    
    // Extract imports
    const importRegex = /^(?:from\s+(\S+)\s+)?import\s+(.+)$/gm;
    let match;
    while ((match = importRegex.exec(code)) !== null) {
      context.imports.push({
        module: match[1] || match[2].split(',')[0].trim(),
        imports: match[2].split(',').map(i => i.trim()),
        isDefault: false,
        isNamespace: false,
        line: code.substring(0, match.index).split('\n').length
      });
    }

    // Extract functions
    const funcRegex = /^(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)/gm;
    while ((match = funcRegex.exec(code)) !== null) {
      context.functions.push({
        name: match[1],
        params: match[2].split(',').filter(p => p.trim()).map(p => ({
          name: p.trim().split(':')[0].trim(),
          type: p.includes(':') ? p.split(':')[1].trim() : undefined,
          isOptional: p.includes('=')
        })),
        isAsync: code.substring(match.index).startsWith('async'),
        isGenerator: false,
        complexity: 1,
        line: code.substring(0, match.index).split('\n').length,
        calls: []
      });
    }

    // Extract classes
    const classRegex = /^class\s+(\w+)(?:\(([^)]*)\))?:/gm;
    while ((match = classRegex.exec(code)) !== null) {
      context.classes.push({
        name: match[1],
        extends: match[2]?.trim(),
        implements: [],
        methods: [],
        properties: [],
        line: code.substring(0, match.index).split('\n').length
      });
    }
  }

  private async analyzeJava(code: string, context: CodeContext) {
    // Java-specific patterns
    const importRegex = /^import\s+(?:static\s+)?(.+);$/gm;
    let match;
    while ((match = importRegex.exec(code)) !== null) {
      context.imports.push({
        module: match[1],
        imports: [match[1].split('.').pop() || ''],
        isDefault: false,
        isNamespace: false,
        line: code.substring(0, match.index).split('\n').length
      });
    }

    // Extract classes
    const classRegex = /(?:public\s+)?(?:abstract\s+)?(?:final\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+(.+?))?(?:\s*{)/gm;
    while ((match = classRegex.exec(code)) !== null) {
      context.classes.push({
        name: match[1],
        extends: match[2],
        implements: match[3]?.split(',').map(i => i.trim()) || [],
        methods: [],
        properties: [],
        line: code.substring(0, match.index).split('\n').length
      });
    }
  }

  private async analyzeSQL(code: string, context: CodeContext) {
    try {
      const parser = new sqlParser.Parser();
      const ast = parser.astify(code);
      
      // Extract table references, operations, etc.
      if (Array.isArray(ast)) {
        ast.forEach(statement => {
          if (statement.type === 'select') {
            // Extract table names
            const tables = this.extractSQLTables(statement);
            tables.forEach(table => {
              context.dependencies.push(`table:${table}`);
            });
          }
        });
      }
    } catch (error) {
      logger.error('SQL parse error:', error);
    }
  }

  private extractSQLTables(statement: any): string[] {
    const tables: string[] = [];
    
    const extract = (node: any) => {
      if (node && typeof node === 'object') {
        if (node.table) {
          tables.push(node.table);
        }
        Object.values(node).forEach(value => {
          if (Array.isArray(value)) {
            value.forEach(extract);
          } else if (typeof value === 'object') {
            extract(value);
          }
        });
      }
    };

    extract(statement);
    return tables;
  }

  private async analyzeGeneric(code: string, context: CodeContext) {
    // Generic analysis for unsupported languages
    // Count lines, detect basic patterns
    const lines = code.split('\n');
    
    // Simple complexity estimation
    context.complexity = lines.filter(line => {
      const trimmed = line.trim();
      return trimmed.includes('if') || trimmed.includes('for') || 
             trimmed.includes('while') || trimmed.includes('switch');
    }).length + 1;
  }

  private detectCodePatterns(context: CodeContext) {
    // Detect common code patterns and potential issues
    
    // Check for high complexity
    context.functions.forEach(func => {
      if (func.complexity > 10) {
        context.patterns.push({
          type: 'complexity',
          description: `Function '${func.name}' has high cyclomatic complexity (${func.complexity})`,
          severity: 'warning',
          line: func.line,
          suggestion: 'Consider breaking this function into smaller, more manageable pieces'
        });
      }
    });

    // Check for missing types in TypeScript
    if (context.language === 'typescript') {
      context.variables.forEach(variable => {
        if (!variable.type && !variable.value) {
          context.patterns.push({
            type: 'type-safety',
            description: `Variable '${variable.name}' is missing type annotation`,
            severity: 'info',
            line: variable.line,
            suggestion: 'Add explicit type annotation for better type safety'
          });
        }
      });
    }

    // Check for potential security issues
    context.functions.forEach(func => {
      if (func.calls.includes('eval') || func.calls.includes('exec')) {
        context.patterns.push({
          type: 'security',
          description: `Function '${func.name}' uses potentially dangerous ${func.calls.includes('eval') ? 'eval' : 'exec'}`,
          severity: 'error',
          line: func.line,
          suggestion: 'Avoid using eval/exec with user input. Consider safer alternatives'
        });
      }
    });
  }

  private generateSuggestions(context: CodeContext) {
    // Generate intelligent suggestions based on code analysis
    
    // Suggest async/await for promise chains
    if (context.functions.some(f => f.calls.includes('then') || f.calls.includes('catch'))) {
      context.suggestions.push({
        type: 'refactor',
        description: 'Consider using async/await instead of promise chains for better readability',
        priority: 'medium'
      });
    }

    // Suggest const for unchanged variables
    context.variables.forEach(variable => {
      if (!variable.isConst && variable.value && !variable.name.startsWith('_')) {
        context.suggestions.push({
          type: 'style',
          description: `Variable '${variable.name}' could be declared as const`,
          priority: 'low'
        });
      }
    });

    // Suggest extraction of duplicated code
    const functionNames = context.functions.map(f => f.name);
    const duplicates = functionNames.filter((name, index) => functionNames.indexOf(name) !== index);
    if (duplicates.length > 0) {
      context.suggestions.push({
        type: 'refactor',
        description: `Duplicate function names detected: ${duplicates.join(', ')}. Consider consolidating`,
        priority: 'high'
      });
    }

    // Performance suggestions
    if (context.complexity > 50) {
      context.suggestions.push({
        type: 'performance',
        description: 'High overall code complexity detected. Consider modularizing the code',
        priority: 'high'
      });
    }
  }

  // Generate context-aware code suggestions
  async generateCodeSuggestion(
    context: CodeContext,
    cursorPosition: { line: number; column: number },
    partialCode: string
  ): Promise<string[]> {
    const suggestions: string[] = [];

    // Find the context at cursor position
    const relevantFunction = context.functions.find(f => 
      f.line <= cursorPosition.line && (!f.body || cursorPosition.line <= f.line + f.body.split('\n').length)
    );

    const relevantClass = context.classes.find(c =>
      c.line <= cursorPosition.line
    );

    // Generate suggestions based on context
    if (relevantFunction) {
      // Suggest based on function parameters
      relevantFunction.params.forEach(param => {
        if (partialCode.endsWith('.')) {
          // Suggest methods based on parameter type
          suggestions.push(`${param.name}.toString()`);
          suggestions.push(`${param.name}.valueOf()`);
        }
      });

      // Suggest commonly used patterns in this function
      if (relevantFunction.isAsync) {
        suggestions.push('await ');
        suggestions.push('try { } catch (error) { }');
      }
    }

    if (relevantClass) {
      // Suggest class methods and properties
      relevantClass.methods.forEach(method => {
        suggestions.push(`this.${method.name}()`);
      });

      relevantClass.properties.forEach(prop => {
        suggestions.push(`this.${prop.name}`);
      });
    }

    // Suggest imports based on usage
    if (partialCode.includes('import')) {
      context.dependencies.forEach(dep => {
        suggestions.push(`import { } from '${dep}'`);
      });
    }

    return suggestions;
  }
}

// Singleton instance
export const codeAnalyzer = new CodeAnalyzer();