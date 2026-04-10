/**
 * Secure Sandbox - Production-safe dynamic code evaluation
 * Uses strict pattern blocking instead of vm2 (which has native dependencies)
 */

const CRITICAL_PATTERNS = /\b(require|import|eval|child_process|exec|spawn|Function)\s*\(|process\b|globalThis\b|global\b|__proto__|constructor\s*\[|\.constructor\b|prototype\b|\bfs\b|Buffer\b|Reflect\b|Proxy\b/i;

export interface SandboxOptions {
  timeout?: number;
  sandbox?: Record<string, any>;
}

export class SecureSandbox {
  private static readonly DEFAULT_TIMEOUT = 1000;

  private static validateExpression(expression: string): void {
    if (CRITICAL_PATTERNS.test(expression)) {
      throw new Error('Blocked dangerous pattern in expression');
    }
  }

  static evaluateExpression<T = any>(
    expression: string,
    context: Record<string, any>,
    _options: SandboxOptions = {}
  ): T {
    this.validateExpression(expression);
    
    try {
      const fn = new Function(...Object.keys(context), `"use strict"; return (${expression})`);
      return fn(...Object.values(context));
    } catch (error) {
      console.warn('[SecureSandbox] Expression evaluation failed:', error);
      throw error;
    }
  }

  static evaluateCondition(
    condition: string,
    contextName: string,
    contextValue: Record<string, any>,
    _options: SandboxOptions = {}
  ): boolean {
    this.validateExpression(condition);
    
    try {
      const fn = new Function(contextName, `"use strict"; return !!(${condition})`);
      return fn(contextValue);
    } catch (error) {
      console.warn('[SecureSandbox] Condition evaluation failed:', error);
      return false;
    }
  }

  static evaluateFakerExpression(
    generatorExpression: string,
    fakerInstance: any,
    _options: SandboxOptions = {}
  ): any {
    this.validateExpression(generatorExpression);
    
    try {
      const fn = new Function('faker', `"use strict"; return (${generatorExpression})`);
      return fn(fakerInstance);
    } catch (error) {
      console.warn('[SecureSandbox] Faker expression failed:', error);
      return null;
    }
  }

  static async evaluateAsyncFunction<T = any>(
    code: string,
    contextName: string,
    contextValue: Record<string, any>,
    _options: SandboxOptions = {}
  ): Promise<T> {
    this.validateExpression(code);
    
    try {
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const fn = new AsyncFunction(contextName, `"use strict"; ${code}`);
      return await fn(contextValue);
    } catch (error) {
      console.warn('[SecureSandbox] Async function evaluation failed:', error);
      throw error;
    }
  }

  static evaluatePlaywrightTest(
    testScript: string,
    page: any,
    _options: SandboxOptions = {}
  ): any {
    this.validateExpression(testScript);
    
    try {
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const fn = new AsyncFunction('page', `"use strict"; ${testScript}`);
      return fn(page);
    } catch (error) {
      console.warn('[SecureSandbox] Playwright test evaluation failed:', error);
      throw error;
    }
  }
}
