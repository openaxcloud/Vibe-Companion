import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LazyMotionDiv } from '@/lib/motion';
import { CheckCircle, Eye } from 'lucide-react';

interface DesignPrototypeViewerProps {
  designPreviewUrl?: string;
  onKeepIterating: () => void;
  onBuildFunctionality: () => void;
  isProcessing?: boolean;
}

export function DesignPrototypeViewer({ 
  designPreviewUrl,
  onKeepIterating,
  onBuildFunctionality,
  isProcessing = false 
}: DesignPrototypeViewerProps) {
  return (
    <LazyMotionDiv
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-4xl mx-auto space-y-4"
    >
      {/* Design Preview Card */}
      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
        <CardContent className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <Eye className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-1" />
            <div className="flex-1">
              <p className="text-gray-800 dark:text-gray-200">
                I've created a visual preview of your app. If everything looks good to you, I can start building the functionality of your app.
              </p>
            </div>
          </div>

          {/* Design Preview (if available) */}
          {designPreviewUrl && (
            <div className="mb-4 rounded-lg overflow-hidden border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              <iframe
                src={designPreviewUrl}
                className="w-full h-96"
                title="Design Preview"
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={onKeepIterating}
              disabled={isProcessing}
              variant="outline"
              className="flex-1 bg-white dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
              data-testid="button-keep-iterating"
            >
              Keep iterating on design
            </Button>
            <Button
              onClick={onBuildFunctionality}
              disabled={isProcessing}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
              data-testid="button-build-functionality"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Build functionality
            </Button>
          </div>
        </CardContent>
      </Card>
    </LazyMotionDiv>
  );
}
