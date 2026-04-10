import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LazyMotionDiv } from '@/lib/motion';
import { CheckCircle, ListChecks } from 'lucide-react';

interface MVPCompletionDialogProps {
  taskList: string[];
  onDismiss: () => void;
  onContinueBuilding: () => void;
  isProcessing?: boolean;
}

export function MVPCompletionDialog({ 
  taskList,
  onDismiss,
  onContinueBuilding,
  isProcessing = false 
}: MVPCompletionDialogProps) {
  // ✅ FIX (Nov 30, 2025): Add null safety for bootstrap session loading
  const safeTaskList = taskList || [];
  
  return (
    <LazyMotionDiv
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-3xl mx-auto space-y-4"
    >
      {/* MVP Completion Card */}
      <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800">
        <CardContent className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400 mt-1 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-gray-800 dark:text-gray-200">
                I've created an MVP and identified a task list to work on. If everything looks good, continue building to make these updates to your app.
              </p>
            </div>
          </div>

          {/* Task List Preview */}
          {safeTaskList.length > 0 && (
            <div className="mb-4 p-4 rounded-lg bg-white/50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-3">
                <ListChecks className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                  Task List ({safeTaskList.length} items)
                </h4>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {safeTaskList.slice(0, 5).map((task, index) => (
                  <div 
                    key={index}
                    className="flex items-start gap-2 text-[13px] text-gray-700 dark:text-gray-300"
                  >
                    <span className="text-gray-400 dark:text-gray-600 font-mono text-[11px] mt-0.5">
                      {index + 1}.
                    </span>
                    <span>{task}</span>
                  </div>
                ))}
                {safeTaskList.length > 5 && (
                  <p className="text-[11px] text-gray-500 dark:text-gray-500 italic pl-4">
                    +{safeTaskList.length - 5} more tasks...
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={onDismiss}
              disabled={isProcessing}
              variant="outline"
              className="flex-1 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
              data-testid="button-dismiss-mvp"
            >
              Dismiss
            </Button>
            <Button
              onClick={onContinueBuilding}
              disabled={isProcessing}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
              data-testid="button-continue-building"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Continue building
            </Button>
          </div>
        </CardContent>
      </Card>
    </LazyMotionDiv>
  );
}
