// @ts-nocheck
import { createLogger } from '../utils/logger';
import { aiProviderManager } from '../ai/ai-provider-manager';
import { checkpointService } from './checkpoint-service';

const logger = createLogger('PromptRefinementService');

interface RefinementSuggestion {
  type: 'clarity' | 'specificity' | 'context' | 'structure' | 'technical';
  original: string;
  suggested: string;
  explanation: string;
  confidence: number;
}

interface PromptAnalysis {
  clarity: number;
  specificity: number;
  completeness: number;
  technicalAccuracy: number;
  overallScore: number;
  issues: string[];
  strengths: string[];
}

export class PromptRefinementService {
  private refinementHistory: Map<string, Array<{
    original: string;
    refined: string;
    timestamp: Date;
    improvements: string[];
  }>> = new Map();

  async analyzePrompt(prompt: string, context?: {
    projectType?: string;
    previousPrompts?: string[];
    currentCode?: string;
  }): Promise<PromptAnalysis> {
    try {
      logger.info('Analyzing prompt quality');

      // Basic analysis first
      const basicAnalysis = this.performBasicAnalysis(prompt);

      // Enhanced AI-powered analysis if available
      const aiAnalysis = await this.performAIAnalysis(prompt, context);

      // Combine analyses
      const combinedAnalysis: PromptAnalysis = {
        clarity: (basicAnalysis.clarity + (aiAnalysis?.clarity || basicAnalysis.clarity)) / 2,
        specificity: (basicAnalysis.specificity + (aiAnalysis?.specificity || basicAnalysis.specificity)) / 2,
        completeness: (basicAnalysis.completeness + (aiAnalysis?.completeness || basicAnalysis.completeness)) / 2,
        technicalAccuracy: aiAnalysis?.technicalAccuracy || basicAnalysis.technicalAccuracy,
        overallScore: 0,
        issues: [...basicAnalysis.issues, ...(aiAnalysis?.issues || [])],
        strengths: [...basicAnalysis.strengths, ...(aiAnalysis?.strengths || [])]
      };

      // Calculate overall score
      combinedAnalysis.overallScore = (
        combinedAnalysis.clarity +
        combinedAnalysis.specificity +
        combinedAnalysis.completeness +
        combinedAnalysis.technicalAccuracy
      ) / 4;

      return combinedAnalysis;
    } catch (error) {
      logger.error('Failed to analyze prompt:', error);
      throw error;
    }
  }

  async refinePrompt(prompt: string, options?: {
    targetAudience?: 'developer' | 'designer' | 'business';
    outputFormat?: 'code' | 'explanation' | 'tutorial';
    complexity?: 'beginner' | 'intermediate' | 'expert';
    projectContext?: any;
  }): Promise<{
    original: string;
    refined: string;
    suggestions: RefinementSuggestion[];
    improvements: string[];
    confidence: number;
  }> {
    try {
      logger.info('Refining user prompt');

      const suggestions: RefinementSuggestion[] = [];
      let refinedPrompt = prompt;

      // Apply basic refinements
      const basicRefinements = this.applyBasicRefinements(prompt);
      suggestions.push(...basicRefinements.suggestions);
      refinedPrompt = basicRefinements.refined;

      // Apply context-aware refinements
      if (options?.projectContext) {
        const contextRefinements = this.applyContextRefinements(refinedPrompt, options.projectContext);
        suggestions.push(...contextRefinements.suggestions);
        refinedPrompt = contextRefinements.refined;
      }

      // Apply AI-powered refinements if available
      try {
        const aiRefinements = await this.applyAIRefinements(refinedPrompt, options);
        if (aiRefinements.refined !== refinedPrompt) {
          suggestions.push(...aiRefinements.suggestions);
          refinedPrompt = aiRefinements.refined;
        }
      } catch (error) {
        logger.warn('AI refinement failed, using basic refinements only:', error);
      }

      // Calculate improvements
      const improvements = this.identifyImprovements(prompt, refinedPrompt, suggestions);

      // Store in history
      this.addToHistory(prompt, refinedPrompt, improvements);

      // Calculate confidence
      const confidence = this.calculateConfidence(suggestions);

      return {
        original: prompt,
        refined: refinedPrompt,
        suggestions,
        improvements,
        confidence
      };
    } catch (error) {
      logger.error('Failed to refine prompt:', error);
      throw error;
    }
  }

  async generateAlternatives(prompt: string, count: number = 3): Promise<{
    alternatives: Array<{
      prompt: string;
      focus: string;
      strength: string;
    }>;
  }> {
    try {
      logger.info(`Generating ${count} alternative prompts`);

      const alternatives: Array<{
        prompt: string;
        focus: string;
        strength: string;
      }> = [];

      // Generate variations focusing on different aspects
      const focuses = ['clarity', 'specificity', 'action-oriented', 'goal-focused'];

      for (let i = 0; i < Math.min(count, focuses.length); i++) {
        const alternative = this.generateAlternativeWithFocus(prompt, focuses[i]);
        alternatives.push(alternative);
      }

      // Try AI-powered generation if available
      try {
        const aiAlternatives = await this.generateAIAlternatives(prompt, count - alternatives.length);
        alternatives.push(...aiAlternatives);
      } catch (error) {
        logger.warn('AI alternative generation failed:', error);
      }

      return { alternatives: alternatives.slice(0, count) };
    } catch (error) {
      logger.error('Failed to generate alternatives:', error);
      throw error;
    }
  }

  async learnFromFeedback(promptId: string, feedback: {
    wasHelpful: boolean;
    resultQuality: number; // 1-5
    suggestions?: string[];
  }): Promise<void> {
    try {
      logger.info(`Learning from feedback for prompt ${promptId}`);

      // Store feedback for future improvements
      // In a production system, this would update ML models or refinement rules

      // Track in checkpoint for billing
      await checkpointService.createAgentCheckpoint(
        0, // System-level learning
        0,
        'Prompt refinement feedback processed',
        { promptId, feedback }
      );
    } catch (error) {
      logger.error('Failed to process feedback:', error);
    }
  }

  private performBasicAnalysis(prompt: string): PromptAnalysis {
    const words = prompt.split(/\s+/);
    const sentences = prompt.split(/[.!?]+/).filter(s => s.trim());

    const analysis: PromptAnalysis = {
      clarity: 0,
      specificity: 0,
      completeness: 0,
      technicalAccuracy: 0,
      overallScore: 0,
      issues: [],
      strengths: []
    };

    // Clarity analysis
    if (words.length < 5) {
      analysis.clarity = 30;
      analysis.issues.push('Prompt is too short - add more detail');
    } else if (words.length > 200) {
      analysis.clarity = 60;
      analysis.issues.push('Prompt is very long - consider breaking into smaller requests');
    } else {
      analysis.clarity = 85;
      analysis.strengths.push('Good prompt length');
    }

    // Specificity analysis
    const specificKeywords = ['create', 'build', 'implement', 'add', 'fix', 'update', 'change'];
    const hasSpecificAction = specificKeywords.some(kw => prompt.toLowerCase().includes(kw));
    
    if (hasSpecificAction) {
      analysis.specificity = 80;
      analysis.strengths.push('Contains specific action words');
    } else {
      analysis.specificity = 40;
      analysis.issues.push('Add specific action words (create, build, implement, etc.)');
    }

    // Completeness analysis
    const hasWhat = /what|which|that/i.test(prompt);
    const hasHow = /how|using|with/i.test(prompt);
    const hasWhy = /because|for|to/i.test(prompt);

    analysis.completeness = 40;
    if (hasWhat) analysis.completeness += 20;
    if (hasHow) analysis.completeness += 20;
    if (hasWhy) analysis.completeness += 20;

    if (analysis.completeness < 60) {
      analysis.issues.push('Consider adding more context about what, how, or why');
    } else {
      analysis.strengths.push('Good contextual information');
    }

    // Technical accuracy (basic check)
    analysis.technicalAccuracy = 70; // Default moderate score

    // Calculate overall
    analysis.overallScore = (
      analysis.clarity +
      analysis.specificity +
      analysis.completeness +
      analysis.technicalAccuracy
    ) / 4;

    return analysis;
  }

  private async performAIAnalysis(prompt: string, context?: any): Promise<PromptAnalysis | null> {
    try {
      const systemPrompt = `Analyze the following user prompt for an AI coding assistant and provide scores (0-100) for:
1. Clarity: How clear and unambiguous is the prompt?
2. Specificity: How specific are the requirements?
3. Completeness: Does it have all necessary information?
4. Technical Accuracy: Are technical terms used correctly?

Also list specific issues and strengths. Return as JSON.`;

      const response = await aiProviderManager.generateCompletion({
        model: 'claude-sonnet-4-20250514',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        maxTokens: 500
      });

      const analysis = JSON.parse(response.content);
      return analysis;
    } catch (error) {
      logger.warn('AI analysis failed:', error);
      return null;
    }
  }

  private applyBasicRefinements(prompt: string): {
    refined: string;
    suggestions: RefinementSuggestion[];
  } {
    let refined = prompt;
    const suggestions: RefinementSuggestion[] = [];

    // Fix common issues
    if (!refined.endsWith('.') && !refined.endsWith('?') && !refined.endsWith('!')) {
      refined += '.';
      suggestions.push({
        type: 'structure',
        original: prompt,
        suggested: refined,
        explanation: 'Added punctuation for clarity',
        confidence: 0.9
      });
    }

    // Add context if missing
    if (refined.length < 20 && !refined.includes('please') && !refined.includes('can you')) {
      const politePrefix = 'Please ';
      refined = politePrefix + refined.charAt(0).toLowerCase() + refined.slice(1);
      suggestions.push({
        type: 'clarity',
        original: prompt,
        suggested: refined,
        explanation: 'Added polite prefix for better interaction',
        confidence: 0.7
      });
    }

    return { refined, suggestions };
  }

  private applyContextRefinements(prompt: string, context: any): {
    refined: string;
    suggestions: RefinementSuggestion[];
  } {
    let refined = prompt;
    const suggestions: RefinementSuggestion[] = [];

    // Add project type context if not mentioned
    if (context.projectType && !prompt.toLowerCase().includes(context.projectType.toLowerCase())) {
      refined = `In this ${context.projectType} project, ${refined.charAt(0).toLowerCase() + refined.slice(1)}`;
      suggestions.push({
        type: 'context',
        original: prompt,
        suggested: refined,
        explanation: `Added project type context (${context.projectType})`,
        confidence: 0.8
      });
    }

    return { refined, suggestions };
  }

  private async applyAIRefinements(prompt: string, options?: any): Promise<{
    refined: string;
    suggestions: RefinementSuggestion[];
  }> {
    try {
      const systemPrompt = `Refine the following prompt to make it clearer and more effective for an AI coding assistant. 
Maintain the original intent but improve clarity, specificity, and structure. 
Return a JSON object with: { refined: "improved prompt", suggestions: [{type, original, suggested, explanation, confidence}] }`;

      const response = await aiProviderManager.generateCompletion({
        model: 'claude-sonnet-4-20250514',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.4,
        maxTokens: 500
      });

      const result = JSON.parse(response.content);
      return result;
    } catch (error) {
      logger.warn('AI refinement failed:', error);
      return { refined: prompt, suggestions: [] };
    }
  }

  private generateAlternativeWithFocus(prompt: string, focus: string): {
    prompt: string;
    focus: string;
    strength: string;
  } {
    let alternative = prompt;
    let strength = '';

    switch (focus) {
      case 'clarity':
        // Make it clearer by breaking down complex requests
        if (prompt.includes(' and ')) {
          alternative = prompt.split(' and ')[0] + '. Then, ' + prompt.split(' and ').slice(1).join(' and ');
          strength = 'Breaks down complex requests into steps';
        }
        break;

      case 'specificity':
        // Add specific implementation details
        if (!prompt.includes('using') && !prompt.includes('with')) {
          alternative = prompt.replace(/create|build|implement/, '$& using modern best practices');
          strength = 'Adds implementation guidance';
        }
        break;

      case 'action-oriented':
        // Start with strong action verbs
        const actionVerbs = ['Create', 'Build', 'Implement', 'Design', 'Develop'];
        const firstWord = prompt.split(' ')[0];
        if (!actionVerbs.includes(firstWord)) {
          alternative = 'Create ' + prompt.charAt(0).toLowerCase() + prompt.slice(1);
          strength = 'Starts with clear action verb';
        }
        break;

      case 'goal-focused':
        // Add purpose/goal if missing
        if (!prompt.includes('to ') && !prompt.includes('for ')) {
          alternative = prompt + ' to improve user experience';
          strength = 'Adds clear goal/purpose';
        }
        break;
    }

    return {
      prompt: alternative || prompt,
      focus,
      strength: strength || 'Maintains original clarity'
    };
  }

  private async generateAIAlternatives(prompt: string, count: number): Promise<Array<{
    prompt: string;
    focus: string;
    strength: string;
  }>> {
    // AI-powered alternative generation
    // Implementation would use AI to generate creative alternatives
    return [];
  }

  private identifyImprovements(original: string, refined: string, suggestions: RefinementSuggestion[]): string[] {
    const improvements: string[] = [];

    if (refined.length > original.length) {
      improvements.push('Added context and clarity');
    }

    suggestions.forEach(suggestion => {
      switch (suggestion.type) {
        case 'clarity':
          improvements.push('Improved clarity');
          break;
        case 'specificity':
          improvements.push('Made more specific');
          break;
        case 'context':
          improvements.push('Added relevant context');
          break;
        case 'structure':
          improvements.push('Improved structure');
          break;
        case 'technical':
          improvements.push('Enhanced technical accuracy');
          break;
      }
    });

    return [...new Set(improvements)]; // Remove duplicates
  }

  private calculateConfidence(suggestions: RefinementSuggestion[]): number {
    if (suggestions.length === 0) return 1.0; // No changes needed = high confidence

    const avgConfidence = suggestions.reduce((sum, s) => sum + s.confidence, 0) / suggestions.length;
    return Math.round(avgConfidence * 100) / 100;
  }

  private addToHistory(original: string, refined: string, improvements: string[]): void {
    const key = original.substring(0, 50); // Use first 50 chars as key
    
    if (!this.refinementHistory.has(key)) {
      this.refinementHistory.set(key, []);
    }

    this.refinementHistory.get(key)!.push({
      original,
      refined,
      timestamp: new Date(),
      improvements
    });

    // Keep only last 100 entries per key
    if (this.refinementHistory.get(key)!.length > 100) {
      this.refinementHistory.get(key)!.shift();
    }
  }
}

export const promptRefinementService = new PromptRefinementService();