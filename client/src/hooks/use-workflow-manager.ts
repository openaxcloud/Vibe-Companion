import { useState, useCallback } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

type WorkflowPhase = 
  | 'generating_features'
  | 'selecting_build_option'
  | 'building_design'
  | 'design_preview'
  | 'building_full'
  | 'mvp_complete'
  | 'extended_build'
  | 'complete';

interface WorkflowState {
  phase: WorkflowPhase;
  projectId: string | null;
  prompt: string;
  featureList: string[];
  taskList: string[];
  designPreviewUrl: string;
  buildChoice: 'full' | 'design' | null;
  buildProgress: number;
  isProcessing: boolean;
}

interface WorkflowManager {
  state: WorkflowState;
  generateFeatures: (projectId: string, prompt: string) => Promise<string[]>;
  selectBuildOption: (choice: 'full' | 'design') => Promise<void>;
  continueBuildFromDesign: () => Promise<void>;
  startExtendedBuild: () => Promise<void>;
  dismissMVP: () => void;
  reset: () => void;
}

const initialState: WorkflowState = {
  phase: 'generating_features',
  projectId: null,
  prompt: '',
  featureList: [],
  taskList: [],
  designPreviewUrl: '',
  buildChoice: null,
  buildProgress: 0,
  isProcessing: false
};

export function useWorkflowManager(): WorkflowManager {
  const [state, setState] = useState<WorkflowState>(initialState);
  const { toast } = useToast();

  const generateFeatures = useCallback(async (projectId: string, prompt: string): Promise<string[]> => {
    setState(prev => ({ ...prev, phase: 'generating_features', projectId, prompt, isProcessing: true }));

    try {
      const response = await apiRequest('POST', '/api/agent/features/generate', {
        projectId,
        prompt
      }) as { features: string[] };

      const features = response.features || [
        'User authentication and authorization',
        'Responsive design for mobile and desktop',
        'Database integration for data persistence',
        'RESTful API endpoints',
        'Interactive user interface',
      ];

      setState(prev => ({ 
        ...prev, 
        featureList: features,
        phase: 'selecting_build_option',
        isProcessing: false
      }));

      return features;
    } catch (error) {
      console.error('Feature generation error:', error);
      // Fallback features
      const fallbackFeatures = [
        'User authentication and authorization',
        'Responsive design for mobile and desktop',
        'Database integration for data persistence',
        'RESTful API endpoints',
        'Interactive user interface',
      ];

      setState(prev => ({ 
        ...prev, 
        featureList: fallbackFeatures,
        phase: 'selecting_build_option',
        isProcessing: false
      }));

      return fallbackFeatures;
    }
  }, []);

  const selectBuildOption = useCallback(async (choice: 'full' | 'design') => {
    setState(prev => ({ ...prev, buildChoice: choice, isProcessing: true }));

    try {
      if (choice === 'design') {
        setState(prev => ({ ...prev, phase: 'building_design' }));
        
        // Simulate design build
        setTimeout(() => {
          setState(prev => ({
            ...prev,
            designPreviewUrl: `/project/${prev.projectId}/preview`,
            phase: 'design_preview',
            isProcessing: false
          }));
        }, 2000);
      } else {
        setState(prev => ({ ...prev, phase: 'building_full' }));
        
        // Call backend to start full build
        const response = await apiRequest('POST', '/api/agent/build/full', {
          projectId: state.projectId,
          features: state.featureList,
          prompt: state.prompt
        }) as { taskList: string[] };

        const tasks = response.taskList || [
          'Set up authentication system',
          'Create database schema',
          'Build API endpoints',
          'Design user interface',
          'Implement core functionality',
          'Add error handling',
          'Write tests',
          'Optimize performance'
        ];

        setState(prev => ({
          ...prev,
          taskList: tasks,
          phase: 'mvp_complete',
          isProcessing: false
        }));
      }
    } catch (error) {
      console.error('Build selection error:', error);
      toast({
        title: "Build Error",
        description: error instanceof Error ? error.message : "Failed to start build",
        variant: "destructive"
      });
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  }, [state.projectId, state.featureList, state.prompt, toast]);

  const continueBuildFromDesign = useCallback(async () => {
    setState(prev => ({ ...prev, phase: 'building_full', isProcessing: true }));

    try {
      const response = await apiRequest('POST', '/api/agent/build/from-design', {
        projectId: state.projectId,
        designUrl: state.designPreviewUrl,
        features: state.featureList
      }) as { taskList: string[] };

      const tasks = response.taskList || [
        'Convert design to functional components',
        'Add state management',
        'Implement API integration',
        'Set up database connections',
        'Add authentication',
        'Implement business logic'
      ];

      setState(prev => ({
        ...prev,
        taskList: tasks,
        phase: 'mvp_complete',
        isProcessing: false
      }));
    } catch (error) {
      console.error('Build from design error:', error);
      toast({
        title: "Build Error",
        description: "Failed to build functionality from design",
        variant: "destructive"
      });
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  }, [state.projectId, state.designPreviewUrl, state.featureList, toast]);

  const startExtendedBuild = useCallback(async () => {
    setState(prev => ({ ...prev, phase: 'extended_build', isProcessing: true }));

    try {
      await apiRequest('POST', '/api/agent/build/extended', {
        projectId: state.projectId,
        taskList: state.taskList
      });

      toast({
        title: "Extended Build Started",
        description: "Agent will continue building for up to 200 minutes",
      });

      // Simulate progress
      const interval = setInterval(() => {
        setState(prev => {
          if (prev.buildProgress >= 100) {
            clearInterval(interval);
            return { ...prev, phase: 'complete', isProcessing: false, buildProgress: 100 };
          }
          return { ...prev, buildProgress: prev.buildProgress + 5 };
        });
      }, 3000);
    } catch (error) {
      console.error('Extended build error:', error);
      toast({
        title: "Build Error",
        description: "Failed to start extended build",
        variant: "destructive"
      });
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  }, [state.projectId, state.taskList, toast]);

  const dismissMVP = useCallback(() => {
    setState(prev => ({ ...prev, phase: 'complete' }));
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return {
    state,
    generateFeatures,
    selectBuildOption,
    continueBuildFromDesign,
    startExtendedBuild,
    dismissMVP,
    reset
  };
}
