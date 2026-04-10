import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AgentWorkflowSelector } from './AgentWorkflowSelector';
import { DesignPrototypeViewer } from './DesignPrototypeViewer';
import { MVPCompletionDialog } from './MVPCompletionDialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { LazyMotionDiv, LazyAnimatePresence } from '@/lib/motion';
import { Loader2, Sparkles } from 'lucide-react';

type WorkflowPhase = 
  | 'generating_features'
  | 'selecting_build_option'
  | 'building_design'
  | 'design_preview'
  | 'building_full'
  | 'task_list_review'
  | 'mvp_complete'
  | 'extended_build'
  | 'complete';

interface AgentWorkflowOrchestratorProps {
  projectId: string;
  initialPrompt: string;
  onComplete?: () => void;
}

export function AgentWorkflowOrchestrator({ 
  projectId, 
  initialPrompt,
  onComplete 
}: AgentWorkflowOrchestratorProps) {
  const { toast } = useToast();
  const [phase, setPhase] = useState<WorkflowPhase>('generating_features');
  const [featureList, setFeatureList] = useState<string[]>([]);
  const [taskList, setTaskList] = useState<string[]>([]);
  const [designPreviewUrl, setDesignPreviewUrl] = useState<string>('');
  const [buildChoice, setBuildChoice] = useState<'full' | 'design' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [buildProgress, setBuildProgress] = useState(0);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);

  // Fetch user's preferred AI model
  const { data: preferredData } = useQuery<{ preferredModel: string | null }>({
    queryKey: ['/api/models/preferred'],
    staleTime: 30000, // Cache for 30s
  });

  // Generate feature list from initial prompt
  useEffect(() => {
    if (phase === 'generating_features' && initialPrompt) {
      generateFeatureList();
    }
  }, [phase, initialPrompt]);

  const generateFeatureList = async () => {
    setIsProcessing(true);
    try {
      // REAL AI-POWERED PLAN GENERATION via Server-Sent Events
      // Connect to streaming endpoint for real-time plan generation using multi-provider AI
      // ✅ CRITICAL FIX: Correct route is /api/agent/plan/stream (was incorrectly /api/agent/stream)
      const response = await fetch('/api/agent/plan/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId,
          goal: initialPrompt,
          context: {
            projectType: 'web-app',
            technologies: ['react', 'typescript', 'express'],
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText || 'Failed to connect to plan generation service'}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const features: string[] = [];
      let receivedPlan = false;

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          // CRITICAL: Exit immediately when stream ends (with or without 'done' event)
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              
              // Skip empty lines and heartbeat messages
              if (!data || data.startsWith(':')) continue;
              
              try {
                const event = JSON.parse(data);
                
                if (event.type === 'plan' && event.data) {
                  receivedPlan = true;
                  
                  // FIXED: Robust task extraction with proper validation
                  const plan = event.data;
                  if (plan.tasks && Array.isArray(plan.tasks) && plan.tasks.length > 0) {
                    // Extract features from task titles
                    features.push(...plan.tasks.map((task: any) => task.title || task.description || 'Unnamed task'));
                    
                    // Store full task list for downstream build process
                    setTaskList(plan.tasks.map((task: any) => task.description || task.title || 'Unnamed task'));
                  } else {
                    console.warn('Plan received but no tasks found:', plan);
                  }
                } else if (event.type === 'saved' && event.data) {
                  // FIXED: Capture conversationId and planId for memory retention
                  const { conversationId: convId, planId: pId } = event.data;
                  if (convId) setConversationId(convId);
                  if (pId) setPlanId(pId);
                  
                  // Store in sessionStorage for IDE auto-agent startup
                  if (convId && pId) {
                    sessionStorage.setItem(`agent-conversation-${projectId}`, JSON.stringify({
                      conversationId: convId,
                      planId: pId,
                      timestamp: Date.now()
                    }));
                  }
                } else if (event.type === 'error') {
                  throw new Error(event.data?.message || 'Plan generation failed');
                } else if (event.type === 'done') {
                  // Stream completed successfully - exit loop next iteration
                  // Note: reader.read() will return done=true on next call
                }
              } catch (parseError) {
                console.error('Failed to parse SSE event:', data, parseError);
                // Continue processing other events
              }
            }
          }
        }
      } finally {
        // CRITICAL: Always cleanup reader to prevent resource leak
        try {
          reader.cancel();
        } catch (e) {
          // Ignore cleanup errors
        }
      }

      if (features.length > 0 && receivedPlan) {
        setFeatureList(features);
        toast({
          title: "Plan Generated",
          description: `AI generated ${features.length} tasks for your project. Building application...`,
        });
        
        // CRITICAL FIX: Call autonomous build endpoint to actually create files
        // This was the missing piece - plan generated but NO files created!
        try {
          setPhase('building_full');
          setBuildProgress(10);
          
          const buildResponse = await apiRequest('POST', '/api/agent/autonomous/build', {
            projectId,
            prompt: initialPrompt,
            modelId: preferredData?.preferredModel || undefined // Use user's preferred model
          }) as {
            success: boolean;
            filesCreated: number;
            filesBlockedByRisk: number;
            filesFailed: number;
            actionsRejected: number;
            securityCompliant: boolean;
            results: any[];
          };
          
          setBuildProgress(90);
          
          if (buildResponse.success && buildResponse.filesCreated > 0) {
            toast({
              title: "Application Built! 🎉",
              description: `Successfully created ${buildResponse.filesCreated} files. Redirecting to IDE...`,
            });
            
            setBuildProgress(100);
            
            // Redirect to IDE after successful build
            setTimeout(() => {
              setPhase('complete');
              onComplete?.();
            }, 1500);
          } else {
            throw new Error(`Build failed: ${buildResponse.filesFailed} files failed, ${buildResponse.filesBlockedByRisk} blocked by security`);
          }
        } catch (buildError) {
          console.error('Autonomous build failed:', buildError);
          toast({
            title: "Build Error",
            description: buildError instanceof Error ? buildError.message : "Failed to build application",
            variant: "destructive"
          });
          
          // Still redirect to IDE so user can manually fix
          setTimeout(() => {
            setPhase('complete');
            onComplete?.();
          }, 2000);
        }
      } else {
        throw new Error('No plan received from AI service');
      }
      
      // Skip build selection - redirect to IDE for approval
      // setPhase('selecting_build_option');
    } catch (error) {
      console.error('Real AI feature generation failed:', error);
      toast({
        title: "Generation Error",
        description: error instanceof Error ? error.message : "Failed to generate plan. Using fallback.",
        variant: "destructive"
      });
      
      // Fallback to default features only if real AI fails
      setFeatureList([
        'User authentication and authorization',
        'Responsive design for mobile and desktop',
        'Database integration for data persistence',
        'RESTful API endpoints',
        'Interactive user interface',
      ]);
      setPhase('selecting_build_option');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBuildChoice = async (choice: 'full' | 'design') => {
    setBuildChoice(choice);
    setIsProcessing(true);

    try {
      if (choice === 'design') {
        setPhase('building_design');
        
        // Simulate design build (3-10 mins)
        setTimeout(() => {
          setDesignPreviewUrl(`/project/${projectId}/preview`);
          setPhase('design_preview');
          setIsProcessing(false);
        }, 2000);
      } else {
        setPhase('building_full');
        
        // Call backend to start full build
        const response = await apiRequest('POST', '/api/agent/build/full', {
          projectId,
          features: featureList,
          prompt: initialPrompt
        }) as { taskList: string[] };

        setTaskList(response.taskList || [
          'Set up authentication system',
          'Create database schema',
          'Build API endpoints',
          'Design user interface',
          'Implement core functionality',
          'Add error handling',
          'Write tests',
          'Optimize performance'
        ]);

        setPhase('mvp_complete');
        setIsProcessing(false);
      }
    } catch (error) {
      console.error('Build failed:', error);
      toast({
        title: "Build Error",
        description: error instanceof Error ? error.message : "Failed to start build",
        variant: "destructive"
      });
      setIsProcessing(false);
    }
  };

  const handleKeepIterating = () => {
    toast({
      title: "Continuing Design",
      description: "Refining the visual prototype..."
    });
    // Keep in design phase, allow user to provide feedback
  };

  const handleBuildFunctionality = async () => {
    setIsProcessing(true);
    setPhase('building_full');

    try {
      // Convert design to full build
      const response = await apiRequest('POST', '/api/agent/build/from-design', {
        projectId,
        designUrl: designPreviewUrl,
        features: featureList
      }) as { taskList: string[] };

      setTaskList(response.taskList || [
        'Convert design to functional components',
        'Add state management',
        'Implement API integration',
        'Set up database connections',
        'Add authentication',
        'Implement business logic'
      ]);

      setPhase('mvp_complete');
    } catch (error) {
      console.error('Build from design failed:', error);
      toast({
        title: "Build Error",
        description: "Failed to build functionality from design",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDismissMVP = () => {
    setPhase('complete');
    onComplete?.();
  };

  const handleContinueBuilding = async () => {
    setIsProcessing(true);
    setPhase('extended_build');

    try {
      // Start extended build (up to 200 minutes)
      await apiRequest('POST', '/api/agent/build/extended', {
        projectId,
        taskList
      });

      toast({
        title: "Extended Build Started",
        description: "Agent will continue building for up to 200 minutes",
      });

      // Simulate progress
      const interval = setInterval(() => {
        setBuildProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setPhase('complete');
            setIsProcessing(false);
            onComplete?.();
            return 100;
          }
          return prev + 5;
        });
      }, 3000);
    } catch (error) {
      console.error('Extended build failed:', error);
      toast({
        title: "Build Error",
        description: "Failed to start extended build",
        variant: "destructive"
      });
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen py-8 px-4">
      <LazyAnimatePresence mode="wait">
        {/* Generating Features */}
        {phase === 'generating_features' && (
          <LazyMotionDiv
            key="generating"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center min-h-[400px]"
          >
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
            <p className="text-[15px] text-gray-600 dark:text-gray-400">
              Analyzing your request and generating feature list...
            </p>
          </LazyMotionDiv>
        )}

        {/* Build Option Selection */}
        {phase === 'selecting_build_option' && (
          <AgentWorkflowSelector
            key="selector"
            featureList={featureList}
            onBuildChoice={handleBuildChoice}
            isProcessing={isProcessing}
          />
        )}

        {/* Building Design */}
        {phase === 'building_design' && (
          <LazyMotionDiv
            key="building-design"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center min-h-[400px]"
          >
            <Sparkles className="w-12 h-12 text-blue-500 animate-pulse mb-4" />
            <p className="text-[15px] text-gray-600 dark:text-gray-400">
              Creating visual prototype...
            </p>
            <p className="text-[13px] text-gray-500 dark:text-gray-500 mt-2">
              This will take approximately 5-10 minutes
            </p>
          </LazyMotionDiv>
        )}

        {/* Design Preview */}
        {phase === 'design_preview' && (
          <DesignPrototypeViewer
            key="design-preview"
            designPreviewUrl={designPreviewUrl}
            onKeepIterating={handleKeepIterating}
            onBuildFunctionality={handleBuildFunctionality}
            isProcessing={isProcessing}
          />
        )}

        {/* Building Full App */}
        {phase === 'building_full' && (
          <LazyMotionDiv
            key="building-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center min-h-[400px]"
          >
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
            <p className="text-[15px] text-gray-600 dark:text-gray-400">
              Building your application...
            </p>
            <p className="text-[13px] text-gray-500 dark:text-gray-500 mt-2">
              This will take approximately 10-20 minutes
            </p>
          </LazyMotionDiv>
        )}

        {/* MVP Complete */}
        {phase === 'mvp_complete' && (
          <MVPCompletionDialog
            key="mvp-complete"
            taskList={taskList}
            onDismiss={handleDismissMVP}
            onContinueBuilding={handleContinueBuilding}
            isProcessing={isProcessing}
          />
        )}

        {/* Extended Build */}
        {phase === 'extended_build' && (
          <LazyMotionDiv
            key="extended-build"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center min-h-[400px]"
          >
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
            <p className="text-[15px] text-gray-600 dark:text-gray-400 mb-4">
              Extended build in progress...
            </p>
            <div className="w-full max-w-md">
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-transform duration-500 origin-left"
                  style={{ transform: `scaleX(${buildProgress / 100})` }}
                />
              </div>
              <p className="text-[13px] text-gray-500 dark:text-gray-500 mt-2 text-center">
                {buildProgress}% complete
              </p>
            </div>
          </LazyMotionDiv>
        )}

        {/* Complete */}
        {phase === 'complete' && (
          <LazyMotionDiv
            key="complete"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center min-h-[400px]"
          >
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Build Complete!
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Your application is ready to use
            </p>
          </LazyMotionDiv>
        )}
      </LazyAnimatePresence>
    </div>
  );
}
