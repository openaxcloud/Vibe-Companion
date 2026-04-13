/**
 * Auto-Grading Service
 * Provides automated assignment grading and test execution for education
 */

import { db } from '../db';
import { assignments, submissions, projects } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { DockerExecutor } from '../execution/docker-executor';
import * as path from 'path';
import * as fs from 'fs';

interface FileItem {
  name: string;
  content?: string;
}

interface TestCase {
  name: string;
  input?: string;
  expectedOutput?: string;
  testCode?: string;
  points: number;
  timeout?: number;
}

interface GradingResult {
  submissionId: number;
  totalScore: number;
  maxScore: number;
  testResults: TestResult[];
  feedback: string;
  executionTime: number;
}

interface TestResult {
  testName: string;
  passed: boolean;
  score: number;
  maxScore: number;
  output?: string;
  error?: string;
  executionTime?: number;
}

export class AutoGradingService {
  private executor: DockerExecutor;

  constructor() {
    this.executor = new DockerExecutor();
  }

  async createAssignment(
    courseId: number,
    title: string,
    description: string,
    testCases: TestCase[],
    createdBy: number,
    options: {
      dueDate?: Date;
      totalPoints?: number;
      projectTemplateId?: number;
      rubric?: any;
    } = {}
  ): Promise<any> {
    const [assignment] = await db.insert(assignments).values({
      title,
      description,
      courseId,
      dueDate: options.dueDate,
      points: options.totalPoints || 100,
      rubric: options.rubric,
      createdBy,
    }).returning();

    return assignment;
  }

  async submitAssignment(
    assignmentId: number,
    studentId: number,
    projectId: number
  ): Promise<any> {
    // Check if assignment exists and is still open
    const [assignment] = await db.select()
      .from(assignments)
      .where(eq(assignments.id, assignmentId));

    if (!assignment) {
      throw new Error('Assignment not found');
    }

    if (assignment.dueDate && new Date() > assignment.dueDate) {
      throw new Error('Assignment is past due date');
    }

    // Create submission
    const [submission] = await db.insert(submissions).values({
      assignmentId,
      studentId,
      projectId,
      status: 'pending',
    }).returning();

    // Start auto-grading in background
    this.gradeSubmission(submission.id).catch(error => {
      console.error('Auto-grading error:', error);
    });

    return submission;
  }

  async gradeSubmission(submissionId: number): Promise<GradingResult> {
    const startTime = Date.now();

    // Get submission details
    const [submission] = await db.select()
      .from(submissions)
      .where(eq(submissions.id, submissionId));

    if (!submission) {
      throw new Error('Submission not found');
    }

    // Update status to grading
    await db.update(submissions)
      .set({ status: 'grading' })
      .where(eq(submissions.id, submissionId));

    // Get assignment details
    const [assignment] = await db.select()
      .from(assignments)
      .where(eq(assignments.id, submission.assignmentId));

    // Get project files
    const [project] = await db.select()
      .from(projects)
      .where(eq(projects.id, submission.projectId!));

    // Run test cases
    const testResults: TestResult[] = [];
    let totalScore = 0;

    const testCases = (assignment.rubric as { testCases?: TestCase[] })?.testCases || [];
    
    for (const testCase of testCases) {
      const result = await this.runTestCase(
        project,
        testCase,
        assignment
      );
      
      testResults.push(result);
      totalScore += result.score;
    }

    // Apply rubric if available
    if (assignment.rubric) {
      const rubricScore = await this.applyRubric(
        project,
        assignment.rubric
      );
      totalScore = Math.min(totalScore + rubricScore, assignment.points || 100);
    }

    // Generate feedback
    const feedback = this.generateFeedback(testResults, assignment);

    const executionTime = Date.now() - startTime;

    // Update submission with results
    await db.update(submissions)
      .set({
        status: 'graded',
        autoGradeScore: Math.round(totalScore),
        feedback,
        gradedAt: new Date(),
      })
      .where(eq(submissions.id, submissionId));

    return {
      submissionId,
      totalScore,
      maxScore: assignment.points || 100,
      testResults,
      feedback,
      executionTime,
    };
  }

  private async runTestCase(
    project: any,
    testCase: TestCase,
    assignment: any
  ): Promise<TestResult> {
    const startTime = Date.now();

    try {
      // Determine language from project
      const language = this.detectLanguage(project);
      
      let result: any;

      if (testCase.testCode) {
        // Run custom test code
        result = await this.runCustomTest(
          project,
          testCase.testCode,
          language
        );
      } else if (testCase.input !== undefined && testCase.expectedOutput) {
        // Run input/output test
        result = await this.runIOTest(
          project,
          testCase.input,
          testCase.expectedOutput,
          language
        );
      } else {
        throw new Error('Invalid test case configuration');
      }

      const executionTime = Date.now() - startTime;
      const passed = result.success && result.passed;

      return {
        testName: testCase.name,
        passed,
        score: passed ? testCase.points : 0,
        maxScore: testCase.points,
        output: result.output,
        error: result.error,
        executionTime,
      };
    } catch (error) {
      return {
        testName: testCase.name,
        passed: false,
        score: 0,
        maxScore: testCase.points,
        error: error.message,
        executionTime: Date.now() - startTime,
      };
    }
  }

  private async runCustomTest(
    project: any,
    testCode: string,
    language: string
  ): Promise<any> {
    // Create test file
    const testFileName = `test_${Date.now()}.${this.getFileExtension(language)}`;
    const projectPath = path.join(process.cwd(), 'project-workspaces', String(project.id).replace(/[^a-zA-Z0-9_-]/g, '_'));
    const testFilePath = path.join(projectPath, testFileName);

    // Ensure project directory exists
    if (!fs.existsSync(projectPath)) {
      fs.mkdirSync(projectPath, { recursive: true });
    }

    // Write test code
    fs.writeFileSync(testFilePath, testCode);

    // Execute test
    const command = this.getTestCommand(language, testFileName);
    const result = await this.executor.executeCode(
      language,
      testCode,
      '',
      projectPath
    );

    // Clean up
    fs.unlinkSync(testFilePath);

    // Parse test results
    const passed = result.output.includes('PASS') || 
                  result.output.includes('OK') ||
                  result.output.includes('Success');

    return {
      success: true,
      passed,
      output: result.output,
      error: result.error,
    };
  }

  private async runIOTest(
    project: any,
    input: string,
    expectedOutput: string,
    language: string
  ): Promise<any> {
    // Get main file
    const mainFile = this.getMainFile(project, language);
    if (!mainFile) {
      throw new Error('Main file not found');
    }

    // Execute with input
    const result = await this.executor.executeCode(
      language,
      mainFile.content || '',
      input
    );

    // Compare output
    const actualOutput = result.output.trim();
    const expected = expectedOutput.trim();
    const passed = actualOutput === expected;

    return {
      success: true,
      passed,
      output: actualOutput,
      expectedOutput: expected,
      error: result.error,
    };
  }

  private detectLanguage(project: any): string {
    // Detect language from project files
    const files: FileItem[] = project.files || [];
    
    if (files.some((f: FileItem) => f.name.endsWith('.py'))) return 'python';
    if (files.some((f: FileItem) => f.name.endsWith('.js'))) return 'javascript';
    if (files.some((f: FileItem) => f.name.endsWith('.java'))) return 'java';
    if (files.some((f: FileItem) => f.name.endsWith('.cpp'))) return 'cpp';
    if (files.some((f: FileItem) => f.name.endsWith('.c'))) return 'c';
    if (files.some((f: FileItem) => f.name.endsWith('.rb'))) return 'ruby';
    if (files.some((f: FileItem) => f.name.endsWith('.go'))) return 'go';
    
    return 'python'; // Default
  }

  private getFileExtension(language: string): string {
    const extensions: Record<string, string> = {
      python: 'py',
      javascript: 'js',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      ruby: 'rb',
      go: 'go',
    };
    
    return extensions[language] || 'txt';
  }

  private getMainFile(project: any, language: string): FileItem | undefined {
    const mainFileNames: Record<string, string[]> = {
      python: ['main.py', 'app.py', 'solution.py'],
      javascript: ['index.js', 'main.js', 'app.js', 'solution.js'],
      java: ['Main.java', 'Solution.java'],
      cpp: ['main.cpp', 'solution.cpp'],
      c: ['main.c', 'solution.c'],
      ruby: ['main.rb', 'solution.rb'],
      go: ['main.go', 'solution.go'],
    };

    const possibleNames = mainFileNames[language] || [];
    const files: FileItem[] = project.files || [];

    for (const name of possibleNames) {
      const file = files.find((f: FileItem) => f.name === name);
      if (file) return file;
    }

    // Return first file of the language
    return files.find((f: FileItem) => f.name.endsWith(`.${this.getFileExtension(language)}`));
  }

  private getTestCommand(language: string, testFile: string): string {
    const commands: Record<string, string> = {
      python: `python -m pytest ${testFile}`,
      javascript: `node ${testFile}`,
      java: `javac ${testFile} && java ${testFile.replace('.java', '')}`,
      cpp: `g++ ${testFile} -o test && ./test`,
      c: `gcc ${testFile} -o test && ./test`,
      ruby: `ruby ${testFile}`,
      go: `go test ${testFile}`,
    };

    return commands[language] || `echo "Unknown language"`;
  }

  private async applyRubric(project: any, rubric: any): Promise<number> {
    let score = 0;

    // Code quality checks
    if (rubric.codeQuality) {
      const qualityScore = await this.assessCodeQuality(project);
      score += qualityScore * (rubric.codeQuality.weight || 0.2);
    }

    // Documentation checks
    if (rubric.documentation) {
      const docScore = this.assessDocumentation(project);
      score += docScore * (rubric.documentation.weight || 0.1);
    }

    // Style checks
    if (rubric.codeStyle) {
      const styleScore = await this.assessCodeStyle(project);
      score += styleScore * (rubric.codeStyle.weight || 0.1);
    }

    return score;
  }

  private async assessCodeQuality(project: any): Promise<number> {
    // Basic code quality metrics
    let score = 100;
    const files = project.files || [];

    for (const file of files) {
      const content = file.content || '';
      
      // Check for common bad practices
      if (content.includes('eval(') || content.includes('exec(')) {
        score -= 10; // Unsafe code execution
      }
      
      if (content.split('\n').some((line: string) => line.length > 120)) {
        score -= 5; // Long lines
      }
      
      if (!content.includes('def ') && !content.includes('function ')) {
        score -= 10; // No functions defined
      }
    }

    return Math.max(0, score);
  }

  private assessDocumentation(project: any): number {
    let score = 0;
    const files = project.files || [];

    // Check for README
    if (files.some((f: FileItem) => f.name.toLowerCase() === 'readme.md')) {
      score += 50;
    }

    // Check for inline comments
    for (const file of files) {
      const content = file.content || '';
      const lines = content.split('\n');
      const commentLines = lines.filter((line: string) => 
        line.trim().startsWith('#') || 
        line.trim().startsWith('//') ||
        line.includes('"""') ||
        line.includes('/*')
      );
      
      if (commentLines.length > lines.length * 0.1) {
        score += 50;
        break;
      }
    }

    return score;
  }

  private async assessCodeStyle(project: any): Promise<number> {
    // Basic style checks
    let score = 100;
    const files = project.files || [];

    for (const file of files) {
      const content = file.content || '';
      
      // Check indentation consistency
      const lines = content.split('\n');
      const indentations = lines
        .filter((line: string) => line.match(/^\s+/))
        .map((line: string) => (line.match(/^\s+/) as RegExpMatchArray)[0]);
      
      const usesSpaces = indentations.some((i: string) => i.includes(' '));
      const usesTabs = indentations.some((i: string) => i.includes('\t'));
      
      if (usesSpaces && usesTabs) {
        score -= 20; // Mixed indentation
      }
    }

    return Math.max(0, score);
  }

  private generateFeedback(
    testResults: TestResult[],
    assignment: any
  ): string {
    const passed = testResults.filter(r => r.passed).length;
    const total = testResults.length;
    const percentage = Math.round((passed / total) * 100);

    let feedback = `## Auto-Grading Results\n\n`;
    feedback += `You passed ${passed} out of ${total} tests (${percentage}%)\n\n`;

    feedback += `### Test Results:\n`;
    for (const result of testResults) {
      const status = result.passed ? '✅' : '❌';
      feedback += `- ${status} ${result.testName}: ${result.score}/${result.maxScore} points\n`;
      
      if (!result.passed && result.error) {
        feedback += `  Error: ${result.error}\n`;
      }
    }

    feedback += `\n### Summary:\n`;
    feedback += `Total Score: ${testResults.reduce((sum, r) => sum + r.score, 0)} / ${assignment.points || 100}\n`;

    if (percentage < 50) {
      feedback += `\n💡 **Tip:** Review the failed tests and try again. Make sure your code handles all edge cases.`;
    } else if (percentage < 100) {
      feedback += `\n👍 **Good job!** You're almost there. Check the failed tests to improve your score.`;
    } else {
      feedback += `\n🎉 **Excellent work!** You passed all tests!`;
    }

    return feedback;
  }

  async getAssignmentSubmissions(
    assignmentId: number,
    filters?: {
      studentId?: number;
      status?: string;
    }
  ) {
    let query = db.select()
      .from(submissions)
      .where(eq(submissions.assignmentId, assignmentId));

    // Apply filters if needed

    return await query.orderBy(submissions.submittedAt);
  }

  async regrade(submissionId: number): Promise<GradingResult> {
    // Reset submission status
    await db.update(submissions)
      .set({ 
        status: 'pending',
        autoGradeScore: null,
      })
      .where(eq(submissions.id, submissionId));

    // Re-run grading
    return await this.gradeSubmission(submissionId);
  }

  async updateManualGrade(
    submissionId: number,
    manualScore: number,
    feedback: string,
    gradedBy: number
  ): Promise<void> {
    const [submission] = await db.select()
      .from(submissions)
      .where(eq(submissions.id, submissionId));

    if (!submission) {
      throw new Error('Submission not found');
    }

    const finalScore = submission.autoGradeScore 
      ? Math.round((submission.autoGradeScore + manualScore) / 2)
      : manualScore;

    await db.update(submissions)
      .set({
        manualGradeScore: manualScore,
        grade: finalScore,
        feedback: (submission.feedback || '') + '\n\n## Manual Grading Feedback\n' + feedback,
        gradedBy,
        gradedAt: new Date(),
        status: 'graded',
      })
      .where(eq(submissions.id, submissionId));
  }
}