/**
 * Polyglot AI Proxy - Routes AI/ML operations to Python service
 * This replaces TypeScript AI operations with Python-based ML processing
 */

import axios from 'axios';
import { createLogger } from '../utils/logger';

const logger = createLogger('polyglot-ai');

const PYTHON_SERVICE_URL = process.env.PYTHON_ML_URL || 'http://localhost:8081';

export interface CodeAnalysisRequest {
  code: string;
  language?: string;
  analysisType?: string;
}

export interface MLTrainingRequest {
  data: any[];
  targetColumn: string;
  modelType?: string;
  testSize?: number;
}

export interface AIInferenceRequest {
  modelType: string;
  input: any;
  parameters?: any;
}

class PolyglotAIProxy {
  /**
   * Generate code using Python ML service with advanced models
   */
  async generateCode(prompt: string, context?: any): Promise<string> {
    try {
      logger.info(`[POLYGLOT] Generating code via Python ML service`);
      
      const response = await axios.post(`${PYTHON_SERVICE_URL}/api/ai/inference`, {
        model_type: 'code_generation',
        input_data: {
          prompt,
          context,
          temperature: 0.1,
          max_tokens: 2000
        },
        parameters: {
          language: context?.language || 'typescript',
          framework: context?.framework
        }
      });

      return response.data.result || '';
    } catch (error: any) {
      logger.error(`[POLYGLOT] Code generation failed: ${error.message}`);
      // Fallback to TypeScript implementation if Python service fails
      throw new Error(`Failed to generate code: ${error.message}`);
    }
  }

  /**
   * Analyze code using Python ML service
   */
  async analyzeCode(request: CodeAnalysisRequest): Promise<any> {
    try {
      logger.info(`[POLYGLOT] Analyzing code via Python ML service`);
      
      const response = await axios.post(`${PYTHON_SERVICE_URL}/api/code/analyze`, {
        code: request.code,
        language: request.language || 'python',
        analysis_type: request.analysisType || 'full'
      });

      return response.data;
    } catch (error: any) {
      logger.error(`[POLYGLOT] Code analysis failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Train ML model using Python service
   */
  async trainModel(request: MLTrainingRequest): Promise<any> {
    try {
      logger.info(`[POLYGLOT] Training ML model via Python service`);
      
      const response = await axios.post(`${PYTHON_SERVICE_URL}/api/ml/train`, {
        data: request.data,
        target_column: request.targetColumn,
        model_type: request.modelType || 'auto',
        test_size: request.testSize || 0.2
      });

      return response.data;
    } catch (error: any) {
      logger.error(`[POLYGLOT] Model training failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get training job status
   */
  async getTrainingStatus(jobId: string): Promise<any> {
    try {
      const response = await axios.get(`${PYTHON_SERVICE_URL}/api/ml/training/${jobId}`);
      return response.data;
    } catch (error: any) {
      logger.error(`[POLYGLOT] Failed to get training status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Analyze text using Python NLP capabilities
   */
  async analyzeText(text: string, analysisType: string = 'sentiment'): Promise<any> {
    try {
      logger.info(`[POLYGLOT] Analyzing text via Python ML service`);
      
      const response = await axios.post(`${PYTHON_SERVICE_URL}/api/text/analyze`, {
        text,
        analysis_type: analysisType
      });

      return response.data;
    } catch (error: any) {
      logger.error(`[POLYGLOT] Text analysis failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Process data using Python's NumPy, Pandas capabilities
   */
  async processData(data: any[], operations: string[]): Promise<any> {
    try {
      logger.info(`[POLYGLOT] Processing data via Python ML service`);
      
      const response = await axios.post(`${PYTHON_SERVICE_URL}/api/data/process`, {
        data,
        operations
      });

      return response.data;
    } catch (error: any) {
      logger.error(`[POLYGLOT] Data processing failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Run AI inference using Python models
   */
  async runInference(request: AIInferenceRequest): Promise<any> {
    try {
      logger.info(`[POLYGLOT] Running AI inference via Python ML service`);
      
      const response = await axios.post(`${PYTHON_SERVICE_URL}/api/ai/inference`, {
        model_type: request.modelType,
        input_data: request.input,
        parameters: request.parameters || {}
      });

      return response.data;
    } catch (error: any) {
      logger.error(`[POLYGLOT] AI inference failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Fine-tune model for code completion
   */
  async fineTuneModel(dataset: any[], modelType: string = 'code_completion'): Promise<any> {
    try {
      logger.info(`[POLYGLOT] Fine-tuning model via Python ML service`);
      
      const response = await axios.post(`${PYTHON_SERVICE_URL}/api/ml/finetune`, {
        dataset,
        model_type: modelType,
        epochs: 10,
        batch_size: 32
      });

      return response.data;
    } catch (error: any) {
      logger.error(`[POLYGLOT] Model fine-tuning failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Optimize code using Python's advanced algorithms
   */
  async optimizeCode(code: string, language: string): Promise<any> {
    try {
      logger.info(`[POLYGLOT] Optimizing code via Python ML service`);
      
      const response = await axios.post(`${PYTHON_SERVICE_URL}/api/code/optimize`, {
        code,
        language,
        optimization_level: 'aggressive'
      });

      return response.data;
    } catch (error: any) {
      logger.error(`[POLYGLOT] Code optimization failed: ${error.message}`);
      throw error;
    }
  }
}

// Lazy initialize to prevent blocking server startup
let _aiProxy: PolyglotAIProxy | null = null;

function getAIProxy(): PolyglotAIProxy {
  if (!_aiProxy) {
    _aiProxy = new PolyglotAIProxy();
  }
  return _aiProxy;
}

// Export getter function instead of instance
export const aiProxy = getAIProxy;

// Export functions for backward compatibility
export const generateCode = (prompt: string, context?: any) => getAIProxy().generateCode(prompt, context);
export const analyzeCode = (request: CodeAnalysisRequest) => getAIProxy().analyzeCode(request);
export const trainModel = (request: MLTrainingRequest) => getAIProxy().trainModel(request);
export const analyzeText = (text: string, type?: string) => getAIProxy().analyzeText(text, type);
export const processData = (data: any[], ops: string[]) => getAIProxy().processData(data, ops);
export const runInference = (request: AIInferenceRequest) => getAIProxy().runInference(request);
export const optimizeCode = (code: string, lang: string) => getAIProxy().optimizeCode(code, lang);