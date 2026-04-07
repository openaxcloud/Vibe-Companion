import { Worker } from 'worker_threads';
import * as vm from 'vm';
import * as path from 'path';
import { ExecutionResult } from './executor';

interface SandboxOptions {
  code: string;
  language: string;
  timeout?: number;
  memoryLimit?: number;
  stdin?: string;
}

export class Sandbox {
  private workerPath: string;

  constructor() {
    this.workerPath = path.join(__dirname, 'sandbox-worker.js');
  }

  async execute(options: SandboxOptions): Promise<ExecutionResult> {
    const { code, language, timeout = 5000, memoryLimit = 128, stdin } = options;
    const startTime = Date.now();

    if (language === 'javascript' || language === 'nodejs') {
      return this.executeJavaScript(code, timeout, stdin);
    }

    // For other languages, we need external executors
    return {
      stdout: '',
      stderr: 'Language not supported in sandbox mode',
      exitCode: 1,
      executionTime: Date.now() - startTime,
      error: 'Unsupported language for sandbox execution'
    };
  }

  private async executeJavaScript(
    code: string,
    timeout: number,
    stdin?: string
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const output: string[] = [];
    const errors: string[] = [];

    try {
      // Create a sandboxed context
      const sandbox = {
        console: {
          log: (...args: any[]) => {
            output.push(args.map(arg => String(arg)).join(' ') + '\n');
          },
          error: (...args: any[]) => {
            errors.push(args.map(arg => String(arg)).join(' ') + '\n');
          },
          warn: (...args: any[]) => {
            output.push('[WARN] ' + args.map(arg => String(arg)).join(' ') + '\n');
          },
          info: (...args: any[]) => {
            output.push('[INFO] ' + args.map(arg => String(arg)).join(' ') + '\n');
          }
        },
        process: {
          stdin: {
            read: () => stdin || ''
          },
          stdout: {
            write: (data: string) => {
              output.push(data);
            }
          },
          stderr: {
            write: (data: string) => {
              errors.push(data);
            }
          },
          exit: (code: number) => {
            throw new Error(`Process exited with code ${code}`);
          }
        },
        require: (module: string) => {
          // Whitelist safe modules
          const safeModules = ['util', 'path', 'url', 'querystring'];
          if (safeModules.includes(module)) {
            return require(module);
          }
          throw new Error(`Module '${module}' is not allowed`);
        },
        setTimeout,
        setInterval,
        clearTimeout,
        clearInterval,
        Buffer,
        Date,
        Math,
        JSON,
        Array,
        Object,
        String,
        Number,
        Boolean,
        RegExp,
        Promise,
        Map,
        Set,
        WeakMap,
        WeakSet
      };

      // Create VM context
      const context = vm.createContext(sandbox);

      // Run the code with timeout
      const script = new vm.Script(code);
      await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Execution timed out'));
        }, timeout);

        try {
          script.runInContext(context, {
            timeout,
            displayErrors: true
          });
          clearTimeout(timeoutId);
          resolve(undefined);
        } catch (error) {
          clearTimeout(timeoutId);
          reject(error);
        }
      });

      return {
        stdout: output.join(''),
        stderr: errors.join(''),
        exitCode: 0,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        stdout: output.join(''),
        stderr: errors.join('') + '\n' + errorMessage,
        exitCode: 1,
        executionTime: Date.now() - startTime,
        error: errorMessage,
        timedOut: errorMessage.includes('timed out')
      };
    }
  }

  async executeInWorker(options: SandboxOptions): Promise<ExecutionResult> {
    const { code, timeout = 5000, memoryLimit = 128 } = options;
    const startTime = Date.now();

    return new Promise((resolve) => {
      const worker = new Worker(code, {
        eval: true,
        resourceLimits: {
          maxOldGenerationSizeMb: memoryLimit,
          maxYoungGenerationSizeMb: memoryLimit / 2
        }
      });

      const output: string[] = [];
      const errors: string[] = [];

      worker.on('message', (message) => {
        if (message.type === 'stdout') {
          output.push(message.data);
        } else if (message.type === 'stderr') {
          errors.push(message.data);
        }
      });

      worker.on('error', (error) => {
        resolve({
          stdout: output.join(''),
          stderr: errors.join('') + '\n' + error.message,
          exitCode: 1,
          executionTime: Date.now() - startTime,
          error: error.message
        });
      });

      worker.on('exit', (code) => {
        resolve({
          stdout: output.join(''),
          stderr: errors.join(''),
          exitCode: code,
          executionTime: Date.now() - startTime
        });
      });

      // Set timeout
      setTimeout(() => {
        worker.terminate();
        resolve({
          stdout: output.join(''),
          stderr: errors.join('') + '\nExecution timed out',
          exitCode: 1,
          executionTime: Date.now() - startTime,
          timedOut: true
        });
      }, timeout);
    });
  }
}

export const sandbox = new Sandbox();