// @ts-nocheck
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { aiCodeReviewService } from './ai-code-review';
import { codeAnalysisEngine } from './code-analysis-engine';
import { createLogger } from '../utils/logger';
import { db } from '../db';
import { codeReviews, reviewIssues } from '@shared/schema';
import { eq } from 'drizzle-orm';

const logger = createLogger('git-review-integration');
const execAsync = promisify(exec);

export interface GitDiff {
  filePath: string;
  oldContent: string;
  newContent: string;
  additions: number;
  deletions: number;
  chunks: DiffChunk[];
}

export interface DiffChunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  changes: DiffChange[];
}

export interface DiffChange {
  type: 'add' | 'delete' | 'context';
  lineNumber: number;
  content: string;
}

export interface CommitInfo {
  hash: string;
  author: string;
  email: string;
  date: Date;
  message: string;
  files: string[];
}

export interface PullRequestReview {
  prNumber: number;
  title: string;
  description: string;
  sourceBranch: string;
  targetBranch: string;
  files: GitDiff[];
  reviewResult: any;
}

class GitReviewIntegration {
  private projectPath: string;

  constructor(projectPath?: string) {
    this.projectPath = projectPath || process.cwd();
  }

  setProjectPath(path: string): void {
    this.projectPath = path;
  }

  async getGitDiff(
    fromRef: string = 'HEAD~1',
    toRef: string = 'HEAD',
    filePath?: string
  ): Promise<GitDiff[]> {
    try {
      const fileArg = filePath ? `-- ${filePath}` : '';
      const { stdout } = await execAsync(
        `git diff --unified=3 ${fromRef}..${toRef} ${fileArg}`,
        { cwd: this.projectPath }
      );

      return this.parseDiff(stdout);
    } catch (error) {
      logger.error('Failed to get git diff:', error);
      throw error;
    }
  }

  private parseDiff(diffOutput: string): GitDiff[] {
    const diffs: GitDiff[] = [];
    const fileSections = diffOutput.split(/^diff --git/m).filter(Boolean);

    for (const section of fileSections) {
      const fileMatch = section.match(/a\/(.*?) b\/(.*?)\n/);
      if (!fileMatch) continue;

      const filePath = fileMatch[2];
      const chunks = this.parseDiffChunks(section);
      
      // Calculate additions and deletions
      let additions = 0;
      let deletions = 0;
      
      for (const chunk of chunks) {
        for (const change of chunk.changes) {
          if (change.type === 'add') additions++;
          if (change.type === 'delete') deletions++;
        }
      }

      diffs.push({
        filePath,
        oldContent: '', // Will be filled if needed
        newContent: '', // Will be filled if needed
        additions,
        deletions,
        chunks
      });
    }

    return diffs;
  }

  private parseDiffChunks(section: string): DiffChunk[] {
    const chunks: DiffChunk[] = [];
    const chunkRegex = /@@ -(\d+),?(\d+)? \+(\d+),?(\d+)? @@/g;
    let match;

    while ((match = chunkRegex.exec(section)) !== null) {
      const oldStart = parseInt(match[1]);
      const oldLines = match[2] ? parseInt(match[2]) : 1;
      const newStart = parseInt(match[3]);
      const newLines = match[4] ? parseInt(match[4]) : 1;

      const chunkEndIndex = section.indexOf('\n@@', match.index + match[0].length);
      const chunkContent = section.substring(
        match.index + match[0].length,
        chunkEndIndex === -1 ? section.length : chunkEndIndex
      );

      const changes = this.parseChunkChanges(chunkContent, newStart);
      
      chunks.push({
        oldStart,
        oldLines,
        newStart,
        newLines,
        changes
      });
    }

    return chunks;
  }

  private parseChunkChanges(chunkContent: string, startLine: number): DiffChange[] {
    const changes: DiffChange[] = [];
    const lines = chunkContent.split('\n').filter(line => line !== '');
    let currentLine = startLine;

    for (const line of lines) {
      if (line.startsWith('+')) {
        changes.push({
          type: 'add',
          lineNumber: currentLine++,
          content: line.substring(1)
        });
      } else if (line.startsWith('-')) {
        changes.push({
          type: 'delete',
          lineNumber: currentLine,
          content: line.substring(1)
        });
      } else if (line.startsWith(' ')) {
        changes.push({
          type: 'context',
          lineNumber: currentLine++,
          content: line.substring(1)
        });
      }
    }

    return changes;
  }

  async reviewGitDiff(
    projectId: string,
    fromRef: string = 'HEAD~1',
    toRef: string = 'HEAD'
  ): Promise<any> {
    try {
      const diffs = await this.getGitDiff(fromRef, toRef);
      const reviewResults = [];

      for (const diff of diffs) {
        // Get the new file content
        const { stdout: newContent } = await execAsync(
          `git show ${toRef}:${diff.filePath}`,
          { cwd: this.projectPath }
        );

        // Analyze the new version of the file
        const reviewResult = await aiCodeReviewService.analyzeCode(
          projectId,
          newContent,
          diff.filePath,
          undefined,
          {
            checkSecurity: true,
            checkPerformance: true,
            checkStyle: true,
            checkBestPractices: true
          }
        );

        // Focus on issues in changed lines
        const relevantIssues = reviewResult.issues.filter(issue => {
          // Check if the issue is in a changed line
          return diff.chunks.some(chunk =>
            chunk.changes.some(change =>
              change.type === 'add' &&
              change.lineNumber === issue.line
            )
          );
        });

        reviewResults.push({
          file: diff.filePath,
          additions: diff.additions,
          deletions: diff.deletions,
          issues: relevantIssues,
          metrics: reviewResult.metrics
        });
      }

      return {
        fromRef,
        toRef,
        files: reviewResults,
        summary: this.generateDiffReviewSummary(reviewResults)
      };
    } catch (error) {
      logger.error('Failed to review git diff:', error);
      throw error;
    }
  }

  private generateDiffReviewSummary(results: any[]): string {
    const totalIssues = results.reduce((sum, r) => sum + r.issues.length, 0);
    const totalAdditions = results.reduce((sum, r) => sum + r.additions, 0);
    const totalDeletions = results.reduce((sum, r) => sum + r.deletions, 0);

    const summary = [
      '## Git Diff Review Summary',
      `Files Changed: ${results.length}`,
      `Lines Added: +${totalAdditions}`,
      `Lines Deleted: -${totalDeletions}`,
      `Issues Found: ${totalIssues}`,
      ''
    ];

    if (totalIssues > 0) {
      summary.push('### Issues by File:');
      results.forEach(result => {
        if (result.issues.length > 0) {
          summary.push(`- ${result.file}: ${result.issues.length} issues`);
        }
      });
    } else {
      summary.push('✅ No issues found in the changes!');
    }

    return summary.join('\n');
  }

  async createPreCommitHook(projectId: string): Promise<void> {
    try {
      const hookPath = path.join(this.projectPath, '.git', 'hooks', 'pre-commit');
      const hookContent = `#!/bin/sh
# E-Code Platform - AI Code Review Pre-commit Hook

echo "Running AI code review..."

# Get list of staged files
FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\\.(js|jsx|ts|tsx|py|java|cpp|c|cs|go|rs|rb|php|swift|kt)$')

if [ -z "$FILES" ]; then
  echo "No code files to review."
  exit 0
fi

# Run code review
node -e "
const { gitReviewIntegration } = require('${__dirname}/git-review-integration');
const integration = new gitReviewIntegration('${this.projectPath}');

(async () => {
  try {
    const result = await integration.reviewStagedFiles('${projectId}');
    
    if (result.criticalIssues > 0) {
      console.error('\\n❌ Critical issues found! Please fix them before committing.');
      process.exit(1);
    }
    
    if (result.highIssues > 0) {
      console.warn('\\n⚠️  High priority issues found. Consider fixing them.');
      // Optionally block commit for high issues
      // process.exit(1);
    }
    
    console.log('\\n✅ Code review passed!');
    process.exit(0);
  } catch (error) {
    console.error('Code review failed:', error.message);
    process.exit(1);
  }
})();
" || exit 1
`;

      await fs.writeFile(hookPath, hookContent);
      await execAsync(`chmod +x ${hookPath}`, { cwd: this.projectPath });
      
      logger.info('Pre-commit hook created successfully');
    } catch (error) {
      logger.error('Failed to create pre-commit hook:', error);
      throw error;
    }
  }

  async reviewStagedFiles(projectId: string): Promise<any> {
    try {
      const { stdout } = await execAsync(
        'git diff --cached --name-only --diff-filter=ACM',
        { cwd: this.projectPath }
      );

      const files = stdout.split('\n').filter(Boolean);
      const reviewResults = {
        files: [],
        totalIssues: 0,
        criticalIssues: 0,
        highIssues: 0,
        mediumIssues: 0,
        lowIssues: 0
      };

      for (const file of files) {
        // Skip non-code files
        if (!this.isCodeFile(file)) continue;

        // Get staged file content
        const { stdout: content } = await execAsync(
          `git show :${file}`,
          { cwd: this.projectPath }
        );

        const result = await aiCodeReviewService.analyzeCode(
          projectId,
          content,
          file
        );

        reviewResults.files.push({
          path: file,
          issues: result.issues
        });

        reviewResults.totalIssues += result.issues.length;
        reviewResults.criticalIssues += result.metrics.criticalIssues;
        reviewResults.highIssues += result.metrics.highIssues;
        reviewResults.mediumIssues += result.metrics.mediumIssues;
        reviewResults.lowIssues += result.metrics.lowIssues;
      }

      return reviewResults;
    } catch (error) {
      logger.error('Failed to review staged files:', error);
      throw error;
    }
  }

  private isCodeFile(filePath: string): boolean {
    const codeExtensions = [
      '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.cpp', '.c',
      '.cs', '.go', '.rs', '.rb', '.php', '.swift', '.kt', '.r', '.m'
    ];
    
    return codeExtensions.some(ext => filePath.endsWith(ext));
  }

  async reviewPullRequest(
    projectId: string,
    sourceBranch: string,
    targetBranch: string = 'main'
  ): Promise<PullRequestReview> {
    try {
      // Get PR metadata (simplified - in real implementation would integrate with GitHub/GitLab API)
      const { stdout: prTitle } = await execAsync(
        `git log --format=%s -n 1 ${sourceBranch}`,
        { cwd: this.projectPath }
      );

      const { stdout: prDescription } = await execAsync(
        `git log --format=%b -n 1 ${sourceBranch}`,
        { cwd: this.projectPath }
      );

      // Get diffs between branches
      const diffs = await this.getGitDiff(targetBranch, sourceBranch);
      
      // Review the changes
      const reviewResult = await this.reviewGitDiff(projectId, targetBranch, sourceBranch);

      return {
        prNumber: 0, // Would be from API
        title: prTitle.trim(),
        description: prDescription.trim(),
        sourceBranch,
        targetBranch,
        files: diffs,
        reviewResult
      };
    } catch (error) {
      logger.error('Failed to review pull request:', error);
      throw error;
    }
  }

  async suggestCommitMessage(stagedFiles?: string[]): Promise<string> {
    try {
      let files = stagedFiles;
      
      if (!files) {
        const { stdout } = await execAsync(
          'git diff --cached --name-only',
          { cwd: this.projectPath }
        );
        files = stdout.split('\n').filter(Boolean);
      }

      if (files.length === 0) {
        return 'No changes staged for commit';
      }

      // Get diff summary
      const { stdout: diffStat } = await execAsync(
        'git diff --cached --stat',
        { cwd: this.projectPath }
      );

      // Categorize changes
      const categories = {
        feat: [],
        fix: [],
        docs: [],
        style: [],
        refactor: [],
        test: [],
        chore: []
      };

      for (const file of files) {
        if (file.includes('test') || file.includes('spec')) {
          categories.test.push(file);
        } else if (file.includes('README') || file.includes('.md')) {
          categories.docs.push(file);
        } else if (file.includes('style') || file.includes('.css')) {
          categories.style.push(file);
        } else if (file.includes('package.json') || file.includes('config')) {
          categories.chore.push(file);
        } else {
          // Try to determine from diff
          try {
            const { stdout: diff } = await execAsync(
              `git diff --cached ${file}`,
              { cwd: this.projectPath }
            );
            
            if (diff.includes('fix') || diff.includes('bug')) {
              categories.fix.push(file);
            } else if (diff.includes('add') || diff.includes('new')) {
              categories.feat.push(file);
            } else {
              categories.refactor.push(file);
            }
          } catch (err: any) { console.error("[catch]", err?.message || err);
            categories.refactor.push(file);
          }
        }
      }

      // Generate commit message
      const mainCategory = Object.keys(categories).find(
        cat => categories[cat].length > 0
      );

      if (!mainCategory) {
        return 'chore: update files';
      }

      const mainFiles = categories[mainCategory];
      let scope = '';
      
      if (mainFiles.length === 1) {
        scope = path.basename(mainFiles[0], path.extname(mainFiles[0]));
      } else if (mainFiles.length > 1) {
        // Find common directory
        const dirs = mainFiles.map(f => path.dirname(f));
        const commonDir = this.findCommonPath(dirs);
        scope = commonDir || 'multiple';
      }

      const action = this.getActionForCategory(mainCategory);
      
      return `${mainCategory}${scope ? `(${scope})` : ''}: ${action}`;
    } catch (error) {
      logger.error('Failed to suggest commit message:', error);
      return 'chore: update files';
    }
  }

  private findCommonPath(paths: string[]): string {
    if (paths.length === 0) return '';
    if (paths.length === 1) return paths[0];

    const parts = paths[0].split('/');
    let common = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (paths.every(p => p.split('/')[i] === part)) {
        common = common ? `${common}/${part}` : part;
      } else {
        break;
      }
    }

    return common;
  }

  private getActionForCategory(category: string): string {
    const actions = {
      feat: 'add new feature',
      fix: 'fix issue',
      docs: 'update documentation',
      style: 'update styles',
      refactor: 'refactor code',
      test: 'update tests',
      chore: 'update configuration'
    };

    return actions[category] || 'update code';
  }

  async getCommitHistory(limit: number = 10): Promise<CommitInfo[]> {
    try {
      const { stdout } = await execAsync(
        `git log --pretty=format:'%H|%an|%ae|%ai|%s' -n ${limit}`,
        { cwd: this.projectPath }
      );

      const commits: CommitInfo[] = [];
      const lines = stdout.split('\n').filter(Boolean);

      for (const line of lines) {
        const [hash, author, email, date, message] = line.split('|');
        
        // Get files changed in commit
        const { stdout: filesOutput } = await execAsync(
          `git diff-tree --no-commit-id --name-only -r ${hash}`,
          { cwd: this.projectPath }
        );
        
        const files = filesOutput.split('\n').filter(Boolean);

        commits.push({
          hash,
          author,
          email,
          date: new Date(date),
          message,
          files
        });
      }

      return commits;
    } catch (error) {
      logger.error('Failed to get commit history:', error);
      throw error;
    }
  }

  async compareBranches(
    branch1: string,
    branch2: string,
    projectId: string
  ): Promise<any> {
    try {
      // Get list of files that differ between branches
      const { stdout } = await execAsync(
        `git diff --name-only ${branch1}..${branch2}`,
        { cwd: this.projectPath }
      );

      const files = stdout.split('\n').filter(Boolean);
      const comparison = {
        branch1,
        branch2,
        filesChanged: files.length,
        files: [],
        totalIssues: 0
      };

      for (const file of files) {
        if (!this.isCodeFile(file)) continue;

        try {
          // Get file content from branch2
          const { stdout: content } = await execAsync(
            `git show ${branch2}:${file}`,
            { cwd: this.projectPath }
          );

          const review = await aiCodeReviewService.analyzeCode(
            projectId,
            content,
            file
          );

          comparison.files.push({
            path: file,
            issues: review.issues.length,
            metrics: review.metrics
          });

          comparison.totalIssues += review.issues.length;
        } catch (error) {
          // File might not exist in branch2
          logger.warn(`Could not analyze file ${file}:`, error);
        }
      }

      return comparison;
    } catch (error) {
      logger.error('Failed to compare branches:', error);
      throw error;
    }
  }

  async getFileHistory(filePath: string, limit: number = 10): Promise<any[]> {
    try {
      const { stdout } = await execAsync(
        `git log --follow --pretty=format:'%H|%ai|%s' -n ${limit} -- ${filePath}`,
        { cwd: this.projectPath }
      );

      const history = [];
      const lines = stdout.split('\n').filter(Boolean);

      for (const line of lines) {
        const [hash, date, message] = line.split('|');
        
        // Get file content at this commit
        try {
          const { stdout: content } = await execAsync(
            `git show ${hash}:${filePath}`,
            { cwd: this.projectPath }
          );

          history.push({
            hash,
            date: new Date(date),
            message,
            linesOfCode: content.split('\n').length
          });
        } catch (err: any) { console.error("[catch]", err?.message || err);
          // File might not exist at this commit
        }
      }

      return history;
    } catch (error) {
      logger.error('Failed to get file history:', error);
      throw error;
    }
  }

  async analyzeCommitQuality(commitHash: string, projectId: string): Promise<any> {
    try {
      // Get commit details
      const { stdout: commitInfo } = await execAsync(
        `git show --stat ${commitHash}`,
        { cwd: this.projectPath }
      );

      // Get files changed
      const { stdout: files } = await execAsync(
        `git diff-tree --no-commit-id --name-only -r ${commitHash}`,
        { cwd: this.projectPath }
      );

      const changedFiles = files.split('\n').filter(Boolean);
      const analysis = {
        hash: commitHash,
        files: changedFiles.length,
        issues: [],
        quality: {
          messageQuality: 0,
          codeQuality: 0,
          overallScore: 0
        }
      };

      // Analyze commit message
      const { stdout: message } = await execAsync(
        `git log --format=%B -n 1 ${commitHash}`,
        { cwd: this.projectPath }
      );

      analysis.quality.messageQuality = this.evaluateCommitMessage(message);

      // Analyze code changes
      let totalIssues = 0;
      for (const file of changedFiles) {
        if (!this.isCodeFile(file)) continue;

        try {
          const { stdout: content } = await execAsync(
            `git show ${commitHash}:${file}`,
            { cwd: this.projectPath }
          );

          const review = await aiCodeReviewService.analyzeCode(
            projectId,
            content,
            file
          );

          totalIssues += review.issues.length;
          analysis.issues.push(...review.issues);
        } catch (err: any) { console.error("[catch]", err?.message || err);
          // File might have been deleted
        }
      }

      analysis.quality.codeQuality = Math.max(0, 100 - (totalIssues * 5));
      analysis.quality.overallScore = (
        analysis.quality.messageQuality + analysis.quality.codeQuality
      ) / 2;

      return analysis;
    } catch (error) {
      logger.error('Failed to analyze commit quality:', error);
      throw error;
    }
  }

  private evaluateCommitMessage(message: string): number {
    let score = 100;

    // Check for conventional commit format
    const conventionalRegex = /^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?:\s.+/;
    if (!conventionalRegex.test(message)) {
      score -= 20;
    }

    // Check message length
    const firstLine = message.split('\n')[0];
    if (firstLine.length > 72) {
      score -= 10;
    } else if (firstLine.length < 10) {
      score -= 15;
    }

    // Check for description
    if (message.split('\n').length < 2) {
      score -= 10;
    }

    // Check for issue references
    if (!/\#\d+/.test(message)) {
      score -= 5;
    }

    return Math.max(0, score);
  }
}

export const gitReviewIntegration = new GitReviewIntegration();