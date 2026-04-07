/**
 * Plagiarism Detection Service
 * Detects code similarity and potential plagiarism using multiple algorithms
 */

import * as crypto from 'crypto';
import { db } from '../db';
import { submissions, projects, files } from '@shared/schema';
import { eq, and, ne } from 'drizzle-orm';

interface SimilarityResult {
  submissionId1: number;
  submissionId2: number;
  similarityScore: number;
  matchedSegments: MatchedSegment[];
  algorithm: 'tokenization' | 'ast' | 'winnowing' | 'moss';
  confidence: 'high' | 'medium' | 'low';
}

interface MatchedSegment {
  file1: string;
  file2: string;
  startLine1: number;
  endLine1: number;
  startLine2: number;
  endLine2: number;
  code1: string;
  code2: string;
  similarity: number;
}

export class PlagiarismDetector {
  private readonly SIMILARITY_THRESHOLD = 0.7; // 70% similarity threshold
  private readonly MIN_TOKEN_LENGTH = 20; // Minimum tokens to consider

  async checkSubmission(submissionId: number): Promise<SimilarityResult[]> {
    // Get submission details
    const [submission] = await db.select()
      .from(submissions)
      .where(eq(submissions.id, submissionId));

    if (!submission) {
      throw new Error('Submission not found');
    }

    // Get all other submissions for the same assignment
    const otherSubmissions = await db.select()
      .from(submissions)
      .where(and(
        eq(submissions.assignmentId, submission.assignmentId),
        ne(submissions.id, submissionId)
      ));

    const results: SimilarityResult[] = [];

    // Compare with each other submission
    for (const otherSubmission of otherSubmissions) {
      const similarity = await this.compareSubmissions(
        submission,
        otherSubmission
      );
      
      if (similarity.similarityScore >= this.SIMILARITY_THRESHOLD) {
        results.push(similarity);
      }
    }

    return results;
  }

  private async compareSubmissions(
    submission1: any,
    submission2: any
  ): Promise<SimilarityResult> {
    // Get code files from both projects
    const files1 = await this.getProjectCodeFiles(submission1.projectId);
    const files2 = await this.getProjectCodeFiles(submission2.projectId);

    // Run multiple similarity algorithms
    const tokenSimilarity = await this.tokenBasedComparison(files1, files2);
    const astSimilarity = await this.astBasedComparison(files1, files2);
    const winnowingSimilarity = await this.winnowingAlgorithm(files1, files2);

    // Combine results with weighted average
    const combinedScore = (
      tokenSimilarity.score * 0.3 +
      astSimilarity.score * 0.4 +
      winnowingSimilarity.score * 0.3
    );

    const matchedSegments = [
      ...tokenSimilarity.matches,
      ...astSimilarity.matches,
      ...winnowingSimilarity.matches
    ].sort((a, b) => b.similarity - a.similarity).slice(0, 10);

    return {
      submissionId1: submission1.id,
      submissionId2: submission2.id,
      similarityScore: combinedScore,
      matchedSegments,
      algorithm: 'tokenization',
      confidence: this.getConfidenceLevel(combinedScore, matchedSegments.length)
    };
  }

  private async getProjectCodeFiles(projectId: number): Promise<any[]> {
    const projectFiles = await db.select()
      .from(files)
      .where(eq(files.projectId, projectId));

    return projectFiles.filter(f => 
      !f.isDirectory && 
      this.isCodeFile(f.name) &&
      f.content
    );
  }

  private isCodeFile(filename: string): boolean {
    const codeExtensions = [
      '.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', 
      '.c', '.cs', '.rb', '.go', '.rust', '.php', '.swift'
    ];
    return codeExtensions.some(ext => filename.endsWith(ext));
  }

  private async tokenBasedComparison(
    files1: any[],
    files2: any[]
  ): Promise<{ score: number; matches: MatchedSegment[] }> {
    const tokens1 = this.tokenizeFiles(files1);
    const tokens2 = this.tokenizeFiles(files2);
    
    const matches: MatchedSegment[] = [];
    let totalSimilarity = 0;
    let comparisons = 0;

    // Compare token sequences
    for (const file1 of files1) {
      for (const file2 of files2) {
        const fileTokens1 = this.tokenizeCode(file1.content);
        const fileTokens2 = this.tokenizeCode(file2.content);
        
        const similarity = this.calculateTokenSimilarity(fileTokens1, fileTokens2);
        
        if (similarity > 0.5) {
          const segments = this.findMatchingSegments(
            file1,
            file2,
            fileTokens1,
            fileTokens2
          );
          matches.push(...segments);
        }
        
        totalSimilarity += similarity;
        comparisons++;
      }
    }

    return {
      score: comparisons > 0 ? totalSimilarity / comparisons : 0,
      matches
    };
  }

  private tokenizeFiles(files: any[]): string[] {
    return files.flatMap(f => this.tokenizeCode(f.content));
  }

  private tokenizeCode(code: string): string[] {
    // Remove comments and whitespace
    const cleanCode = code
      .replace(/\/\/.*$/gm, '') // Remove single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove multi-line comments
      .replace(/\s+/g, ' '); // Normalize whitespace

    // Extract tokens (identifiers, keywords, operators)
    const tokens = cleanCode.match(/\b\w+\b|[^\s\w]/g) || [];
    
    // Filter out common language keywords to focus on structure
    const commonKeywords = new Set([
      'var', 'let', 'const', 'function', 'if', 'else', 'for', 
      'while', 'return', 'class', 'import', 'export', 'def',
      'public', 'private', 'static', 'void', 'int', 'string'
    ]);

    return tokens.filter(t => !commonKeywords.has(t));
  }

  private calculateTokenSimilarity(tokens1: string[], tokens2: string[]): number {
    if (tokens1.length === 0 || tokens2.length === 0) return 0;

    // Use Jaccard similarity coefficient
    const set1 = new Set(tokens1);
    const set2 = new Set(tokens2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  private findMatchingSegments(
    file1: any,
    file2: any,
    tokens1: string[],
    tokens2: string[]
  ): MatchedSegment[] {
    const segments: MatchedSegment[] = [];
    const lines1 = file1.content.split('\n');
    const lines2 = file2.content.split('\n');

    // Sliding window to find matching segments
    const windowSize = 5;
    
    for (let i = 0; i < lines1.length - windowSize; i++) {
      for (let j = 0; j < lines2.length - windowSize; j++) {
        const segment1 = lines1.slice(i, i + windowSize).join('\n');
        const segment2 = lines2.slice(j, j + windowSize).join('\n');
        
        const similarity = this.calculateLineSimilarity(segment1, segment2);
        
        if (similarity > 0.8) {
          segments.push({
            file1: file1.name,
            file2: file2.name,
            startLine1: i + 1,
            endLine1: i + windowSize,
            startLine2: j + 1,
            endLine2: j + windowSize,
            code1: segment1,
            code2: segment2,
            similarity
          });
        }
      }
    }

    return segments;
  }

  private calculateLineSimilarity(line1: string, line2: string): number {
    // Levenshtein distance normalized by max length
    const distance = this.levenshteinDistance(line1, line2);
    const maxLength = Math.max(line1.length, line2.length);
    return maxLength === 0 ? 0 : 1 - (distance / maxLength);
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private async astBasedComparison(
    files1: any[],
    files2: any[]
  ): Promise<{ score: number; matches: MatchedSegment[] }> {
    // Simplified AST comparison using structure patterns
    const patterns1 = this.extractStructurePatterns(files1);
    const patterns2 = this.extractStructurePatterns(files2);
    
    const similarity = this.comparePatterns(patterns1, patterns2);
    
    return {
      score: similarity,
      matches: []
    };
  }

  private extractStructurePatterns(files: any[]): string[] {
    const patterns: string[] = [];
    
    for (const file of files) {
      // Extract function signatures, class definitions, control structures
      const functionPattern = /function\s+(\w+)\s*\([^)]*\)/g;
      const classPattern = /class\s+(\w+)(\s+extends\s+\w+)?/g;
      const loopPattern = /(for|while)\s*\([^)]*\)/g;
      
      const functions = [...file.content.matchAll(functionPattern)];
      const classes = [...file.content.matchAll(classPattern)];
      const loops = [...file.content.matchAll(loopPattern)];
      
      patterns.push(
        ...functions.map(m => `func:${m[1]}`),
        ...classes.map(m => `class:${m[1]}`),
        ...loops.map(m => `loop:${m[1]}`)
      );
    }
    
    return patterns;
  }

  private comparePatterns(patterns1: string[], patterns2: string[]): number {
    if (patterns1.length === 0 || patterns2.length === 0) return 0;
    
    const set1 = new Set(patterns1);
    const set2 = new Set(patterns2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  private async winnowingAlgorithm(
    files1: any[],
    files2: any[]
  ): Promise<{ score: number; matches: MatchedSegment[] }> {
    // Winnowing algorithm for robust fingerprinting
    const fingerprints1 = this.generateFingerprints(files1);
    const fingerprints2 = this.generateFingerprints(files2);
    
    const matchCount = this.countMatchingFingerprints(fingerprints1, fingerprints2);
    const totalFingerprints = Math.max(fingerprints1.size, fingerprints2.size);
    
    return {
      score: totalFingerprints > 0 ? matchCount / totalFingerprints : 0,
      matches: []
    };
  }

  private generateFingerprints(files: any[]): Set<string> {
    const fingerprints = new Set<string>();
    const k = 5; // k-gram size
    const w = 4; // window size
    
    for (const file of files) {
      const text = this.normalizeCode(file.content);
      const kgrams = this.generateKgrams(text, k);
      const hashes = kgrams.map(kg => this.hash(kg));
      
      // Select fingerprints using winnowing
      for (let i = 0; i <= hashes.length - w; i++) {
        const window = hashes.slice(i, i + w);
        const minHash = Math.min(...window);
        fingerprints.add(minHash.toString());
      }
    }
    
    return fingerprints;
  }

  private normalizeCode(code: string): string {
    return code
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  private generateKgrams(text: string, k: number): string[] {
    const kgrams: string[] = [];
    for (let i = 0; i <= text.length - k; i++) {
      kgrams.push(text.substr(i, k));
    }
    return kgrams;
  }

  private hash(text: string): number {
    return crypto.createHash('md5').update(text).digest().readUInt32BE(0);
  }

  private countMatchingFingerprints(set1: Set<string>, set2: Set<string>): number {
    let count = 0;
    for (const fp of set1) {
      if (set2.has(fp)) count++;
    }
    return count;
  }

  private getConfidenceLevel(
    score: number,
    matchCount: number
  ): 'high' | 'medium' | 'low' {
    if (score >= 0.9 && matchCount >= 5) return 'high';
    if (score >= 0.7 && matchCount >= 3) return 'medium';
    return 'low';
  }

  async generatePlagiarismReport(
    assignmentId: number
  ): Promise<{
    suspicious: any[];
    statistics: any;
  }> {
    // Get all submissions for assignment
    const allSubmissions = await db.select()
      .from(submissions)
      .where(eq(submissions.assignmentId, assignmentId));

    const suspicious: any[] = [];
    const checkedPairs = new Set<string>();

    // Check all pairs
    for (let i = 0; i < allSubmissions.length; i++) {
      for (let j = i + 1; j < allSubmissions.length; j++) {
        const pairKey = `${allSubmissions[i].id}-${allSubmissions[j].id}`;
        if (checkedPairs.has(pairKey)) continue;
        
        checkedPairs.add(pairKey);
        
        const similarity = await this.compareSubmissions(
          allSubmissions[i],
          allSubmissions[j]
        );
        
        if (similarity.similarityScore >= this.SIMILARITY_THRESHOLD) {
          suspicious.push({
            submission1: allSubmissions[i],
            submission2: allSubmissions[j],
            similarity
          });
        }
      }
    }

    return {
      suspicious: suspicious.sort((a, b) => 
        b.similarity.similarityScore - a.similarity.similarityScore
      ),
      statistics: {
        totalSubmissions: allSubmissions.length,
        suspiciousPairs: suspicious.length,
        averageSimilarity: suspicious.reduce((sum, s) => 
          sum + s.similarity.similarityScore, 0
        ) / (suspicious.length || 1)
      }
    };
  }
}

// Export singleton
export const plagiarismDetector = new PlagiarismDetector();