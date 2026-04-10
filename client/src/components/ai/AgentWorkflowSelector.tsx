import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LazyMotionDiv } from '@/lib/motion';
import { LayoutGrid, Image, CheckCircle, ArrowUp } from 'lucide-react';

interface AgentWorkflowSelectorProps {
  featureList: string[];
  onBuildChoice: (choice: 'full' | 'design') => void;
  isProcessing?: boolean;
}

export function AgentWorkflowSelector({ 
  featureList, 
  onBuildChoice,
  isProcessing = false 
}: AgentWorkflowSelectorProps) {
  // ✅ FIX (Nov 30, 2025): Add null safety for bootstrap session loading
  const safeFeatureList = featureList || [];
  const [selectedOption, setSelectedOption] = useState<'full' | 'design' | null>(null);

  return (
    <LazyMotionDiv
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-3xl mx-auto space-y-4"
    >
      {/* Feature List Display */}
      <Card className="bg-white/80 dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800">
        <CardContent className="p-6">
          <p className="text-gray-800 dark:text-gray-200 mb-4">
            I've created a feature list based on your request. If everything looks good, we can start creating.
          </p>
          
          {/* Feature List */}
          <div className="space-y-2 mb-6">
            {safeFeatureList.map((feature, index) => (
              <div 
                key={index}
                className="flex items-start gap-2 text-[13px] text-gray-700 dark:text-gray-300"
              >
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                <span>{feature}</span>
              </div>
            ))}
          </div>

          {/* "How do you want to continue?" */}
          <p className="text-gray-800 dark:text-gray-200 font-medium mb-4">
            How do you want to continue?
          </p>

          {/* Two Build Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Build the entire app */}
            <button
              onClick={() => setSelectedOption('full')}
              disabled={isProcessing}
              className={`
                relative p-4 rounded-lg border-2 transition-all text-left
                hover:border-blue-400 dark:hover:border-blue-500
                ${selectedOption === 'full' 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' 
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                }
                ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
              data-testid="button-build-full"
            >
              <div className="absolute top-4 right-4">
                <div className={`
                  w-5 h-5 rounded-full border-2 transition-all
                  ${selectedOption === 'full'
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-gray-300 dark:border-gray-600'
                  }
                `}>
                  {selectedOption === 'full' && (
                    <CheckCircle className="w-full h-full text-white" />
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                  <LayoutGrid className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="flex-1 pr-8">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                    Build the entire app
                  </h3>
                  <p className="text-[13px] text-gray-600 dark:text-gray-400 mb-2">
                    20+ mins
                  </p>
                  <p className="text-[13px] text-gray-600 dark:text-gray-400">
                    Best if you want Agent to build out the full functionality of your app
                  </p>
                </div>
              </div>
            </button>

            {/* Start with a design */}
            <button
              onClick={() => setSelectedOption('design')}
              disabled={isProcessing}
              className={`
                relative p-4 rounded-lg border-2 transition-all text-left
                hover:border-blue-400 dark:hover:border-blue-500
                ${selectedOption === 'design' 
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20' 
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                }
                ${isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
              data-testid="button-build-design"
            >
              <div className="absolute top-4 right-4">
                <div className={`
                  w-5 h-5 rounded-full border-2 transition-all
                  ${selectedOption === 'design'
                    ? 'border-blue-500 bg-blue-500'
                    : 'border-gray-300 dark:border-gray-600'
                  }
                `}>
                  {selectedOption === 'design' && (
                    <CheckCircle className="w-full h-full text-white" />
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Image className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 pr-8">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                    Start with a design
                  </h3>
                  <p className="text-[13px] text-gray-600 dark:text-gray-400 mb-2">
                    5-10 mins
                  </p>
                  <p className="text-[13px] text-gray-600 dark:text-gray-400">
                    Best if you want to see a design prototype first, then iterate on visuals or features
                  </p>
                </div>
              </div>
            </button>
          </div>

          {/* Start Building Button */}
          <Button
            onClick={() => selectedOption && onBuildChoice(selectedOption)}
            disabled={!selectedOption || isProcessing}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white"
            size="lg"
            data-testid="button-start-building"
          >
            {isProcessing ? (
              <>Processing...</>
            ) : (
              <>
                Start building <ArrowUp className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </LazyMotionDiv>
  );
}
