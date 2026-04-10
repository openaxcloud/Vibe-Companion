/**
 * Security Scanner Service
 * Implements comprehensive security scanning for E-Code projects
 * - Secret detection in code
 * - Vulnerability scanning
 * - Code quality analysis
 * - Security best practices validation
 */

export interface SecurityIssue {
  id: string;
  type: 'secret' | 'vulnerability' | 'code_quality' | 'best_practice';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  file?: string;
  line?: number;
  column?: number;
  suggestion?: string;
  ruleId?: string;
}

export interface SecurityScanResult {
  projectId: number;
  scanId: string;
  timestamp: Date;
  status: 'completed' | 'running' | 'failed';
  summary: {
    totalIssues: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  issues: SecurityIssue[];
  scanDuration: number;
}

export class SecurityScanner {
  // Secret patterns to detect in code
  private secretPatterns = [
    {
      name: 'OpenAI API Key',
      pattern: /sk-[a-zA-Z0-9]{24,}/g,
      severity: 'critical' as const,
    },
    {
      name: 'GitHub Token',
      pattern: /ghp_[a-zA-Z0-9]{36}/g,
      severity: 'critical' as const,
    },
    {
      name: 'AWS Access Key',
      pattern: /AKIA[0-9A-Z]{16}/g,
      severity: 'critical' as const,
    },
    {
      name: 'Private Key',
      pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/g,
      severity: 'critical' as const,
    },
    {
      name: 'Database URL',
      pattern: /(postgresql|mysql|mongodb):\/\/[^\s]+/g,
      severity: 'high' as const,
    },
    {
      name: 'JWT Secret',
      pattern: /jwt[_-]?secret["\s]*[:=]["\s]*[a-zA-Z0-9+/=]{32,}/gi,
      severity: 'high' as const,
    },
    {
      name: 'Generic API Key',
      pattern: /api[_-]?key["\s]*[:=]["\s]*[a-zA-Z0-9]{16,}/gi,
      severity: 'medium' as const,
    },
    {
      name: 'Password in Code',
      pattern: /password["\s]*[:=]["\s]*["'][^"']{8,}["']/gi,
      severity: 'medium' as const,
    }
  ];

  // Vulnerability patterns
  private vulnerabilityPatterns = [
    {
      name: 'SQL Injection Risk',
      pattern: /\${[^}]*}.*query|query.*\${[^}]*}/gi,
      severity: 'high' as const,
    },
    {
      name: 'XSS Risk - innerHTML',
      pattern: /innerHTML\s*=\s*[^;]*[+`$]/g,
      severity: 'high' as const,
    },
    {
      name: 'Command Injection Risk',
      pattern: /exec\(.*\$|system\(.*\$|shell_exec\(.*\$/gi,
      severity: 'critical' as const,
    },
    {
      name: 'Insecure Random',
      pattern: /Math\.random\(\)/g,
      severity: 'medium' as const,
    }
  ];

  // Code quality patterns
  private codeQualityPatterns = [
    {
      name: 'Console.log in Production',
      pattern: /console\.(log|debug|info)\(/g,
      severity: 'low' as const,
    },
    {
      name: 'TODO Comment',
      pattern: /\/\*?\s*TODO|\/\/\s*TODO/gi,
      severity: 'info' as const,
    },
    {
      name: 'FIXME Comment',
      pattern: /\/\*?\s*FIXME|\/\/\s*FIXME/gi,
      severity: 'low' as const,
    }
  ];

  async scanProject(projectId: number, files: { path: string; content: string }[]): Promise<SecurityScanResult> {
    const scanId = `scan_${Date.now()}_${process.hrtime.bigint().toString(36).slice(0, 9)}`;
    const startTime = Date.now();
    
    try {
      const issues: SecurityIssue[] = [];

      // Scan each file
      for (const file of files) {
        // Skip binary files and large files
        if (this.shouldSkipFile(file.path) || file.content.length > 1024 * 1024) {
          continue;
        }

        // Scan for secrets
        issues.push(...this.scanForSecrets(file.path, file.content));
        
        // Scan for vulnerabilities
        issues.push(...this.scanForVulnerabilities(file.path, file.content));
        
        // Scan for code quality issues
        issues.push(...this.scanForCodeQuality(file.path, file.content));
      }

      // Generate summary
      const summary = this.generateSummary(issues);
      
      const scanDuration = Date.now() - startTime;

      return {
        projectId,
        scanId,
        timestamp: new Date(),
        status: 'completed',
        summary,
        issues,
        scanDuration
      };

    } catch (error) {
      return {
        projectId,
        scanId,
        timestamp: new Date(),
        status: 'failed',
        summary: { totalIssues: 0, critical: 0, high: 0, medium: 0, low: 0, info: 0 },
        issues: [],
        scanDuration: Date.now() - startTime
      };
    }
  }

  private shouldSkipFile(path: string): boolean {
    const skipExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.ico', '.pdf', '.zip', '.tar', '.gz'];
    const skipPatterns = ['/node_modules/', '/.git/', '/dist/', '/build/', '/coverage/'];
    
    const extension = path.toLowerCase().slice(path.lastIndexOf('.'));
    return skipExtensions.includes(extension) || skipPatterns.some(pattern => path.includes(pattern));
  }

  private scanForSecrets(filePath: string, content: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    
    for (const pattern of this.secretPatterns) {
      const matches = [...content.matchAll(pattern.pattern)];
      
      for (const match of matches) {
        const lineNumber = this.getLineNumber(content, match.index || 0);
        const column = this.getColumnNumber(content, match.index || 0);
        
        issues.push({
          id: `secret_${Date.now()}_${process.hrtime.bigint().toString(36).slice(0, 9)}`,
          type: 'secret',
          severity: pattern.severity,
          title: `${pattern.name} Detected`,
          description: `Found potential ${pattern.name.toLowerCase()} in code. This should be moved to environment variables.`,
          file: filePath,
          line: lineNumber,
          column: column,
          suggestion: `Move this ${pattern.name.toLowerCase()} to environment variables using process.env or .env file`,
          ruleId: `secret-${pattern.name.toLowerCase().replace(/\s+/g, '-')}`
        });
      }
    }

    return issues;
  }

  private scanForVulnerabilities(filePath: string, content: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    
    for (const pattern of this.vulnerabilityPatterns) {
      const matches = [...content.matchAll(pattern.pattern)];
      
      for (const match of matches) {
        const lineNumber = this.getLineNumber(content, match.index || 0);
        const column = this.getColumnNumber(content, match.index || 0);
        
        issues.push({
          id: `vuln_${Date.now()}_${process.hrtime.bigint().toString(36).slice(0, 9)}`,
          type: 'vulnerability',
          severity: pattern.severity,
          title: `${pattern.name}`,
          description: `Potential security vulnerability detected: ${pattern.name}`,
          file: filePath,
          line: lineNumber,
          column: column,
          suggestion: this.getVulnerabilitySuggestion(pattern.name),
          ruleId: `vuln-${pattern.name.toLowerCase().replace(/[\s-]/g, '-')}`
        });
      }
    }

    return issues;
  }

  private scanForCodeQuality(filePath: string, content: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];
    
    for (const pattern of this.codeQualityPatterns) {
      const matches = [...content.matchAll(pattern.pattern)];
      
      for (const match of matches) {
        const lineNumber = this.getLineNumber(content, match.index || 0);
        const column = this.getColumnNumber(content, match.index || 0);
        
        issues.push({
          id: `quality_${Date.now()}_${process.hrtime.bigint().toString(36).slice(0, 9)}`,
          type: 'code_quality',
          severity: pattern.severity,
          title: `${pattern.name}`,
          description: `Code quality issue: ${pattern.name}`,
          file: filePath,
          line: lineNumber,
          column: column,
          suggestion: this.getCodeQualitySuggestion(pattern.name),
          ruleId: `quality-${pattern.name.toLowerCase().replace(/[\s.]/g, '-')}`
        });
      }
    }

    return issues;
  }

  private getVulnerabilitySuggestion(vulnName: string): string {
    const suggestions: Record<string, string> = {
      'SQL Injection Risk': 'Use parameterized queries or prepared statements to prevent SQL injection',
      'XSS Risk - innerHTML': 'Use textContent instead of innerHTML, or sanitize HTML input',
      'Command Injection Risk': 'Validate and sanitize input before executing system commands',
      'Insecure Random': 'Use crypto.randomBytes() or crypto.getRandomValues() for cryptographic purposes'
    };
    
    return suggestions[vulnName] || 'Review this code for potential security issues';
  }

  private getCodeQualitySuggestion(issueName: string): string {
    const suggestions: Record<string, string> = {
      'Console.log in Production': 'Remove console.log statements before deploying to production',
      'TODO Comment': 'Complete this TODO item or create a proper issue/task',
      'FIXME Comment': 'Fix this issue before deploying to production'
    };
    
    return suggestions[issueName] || 'Review and address this code quality issue';
  }

  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }

  private getColumnNumber(content: string, index: number): number {
    const lines = content.substring(0, index).split('\n');
    return lines[lines.length - 1].length + 1;
  }

  private generateSummary(issues: SecurityIssue[]) {
    const summary = {
      totalIssues: issues.length,
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0
    };

    for (const issue of issues) {
      summary[issue.severity]++;
    }

    return summary;
  }

  // Get security recommendations for a project
  async getSecurityRecommendations(projectId: number): Promise<string[]> {
    return [
      'Enable two-factor authentication for your account',
      'Use environment variables for sensitive configuration',
      'Regularly update dependencies to patch security vulnerabilities',
      'Implement proper input validation and sanitization',
      'Use HTTPS for all external API calls',
      'Store secrets securely using E-Code Secrets management',
      'Review and limit file permissions',
      'Implement rate limiting for API endpoints',
      'Use strong, unique passwords for all services',
      'Enable audit logging for sensitive operations'
    ];
  }

  // Quick scan for common security issues
  async quickScan(code: string): Promise<SecurityIssue[]> {
    const issues: SecurityIssue[] = [];
    
    // Check for obvious secrets
    for (const pattern of this.secretPatterns.slice(0, 4)) { // Only check top 4 patterns
      const matches = [...code.matchAll(pattern.pattern)];
      
      for (const match of matches) {
        issues.push({
          id: `quick_${Date.now()}_${process.hrtime.bigint().toString(36).slice(0, 9)}`,
          type: 'secret',
          severity: pattern.severity,
          title: `${pattern.name} Detected`,
          description: `Found potential ${pattern.name.toLowerCase()} in code`,
          suggestion: 'Move to environment variables'
        });
      }
    }

    return issues;
  }
}

export const securityScanner = new SecurityScanner();