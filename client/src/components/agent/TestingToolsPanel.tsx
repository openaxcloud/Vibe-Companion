import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TestRunner } from './TestRunner';
import { ElementSelector } from './ElementSelector';
import { SessionRecording } from './SessionRecording';
import { BeakerIcon, MousePointer2, Video } from 'lucide-react';

interface TestingToolsPanelProps {
  sessionId: string;
  projectId: string;
}

export function TestingToolsPanel({ sessionId, projectId }: TestingToolsPanelProps) {
  return (
    <div className="flex flex-col h-full w-full">
      <Tabs defaultValue="test-runner" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger 
            value="test-runner" 
            className="flex items-center gap-2"
            data-testid="tab-test-runner"
          >
            <BeakerIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Test Runner</span>
            <span className="sm:hidden">Tests</span>
          </TabsTrigger>
          <TabsTrigger 
            value="element-selector" 
            className="flex items-center gap-2"
            data-testid="tab-element-selector"
          >
            <MousePointer2 className="h-4 w-4" />
            <span className="hidden sm:inline">Selectors</span>
            <span className="sm:hidden">Select</span>
          </TabsTrigger>
          <TabsTrigger 
            value="session-recording" 
            className="flex items-center gap-2"
            data-testid="tab-session-recording"
          >
            <Video className="h-4 w-4" />
            <span className="hidden sm:inline">Recording</span>
            <span className="sm:hidden">Record</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="test-runner" className="flex-1 mt-0">
          <TestRunner sessionId={sessionId} projectId={projectId} />
        </TabsContent>

        <TabsContent value="element-selector" className="flex-1 mt-0">
          <ElementSelector sessionId={sessionId} projectId={projectId} />
        </TabsContent>

        <TabsContent value="session-recording" className="flex-1 mt-0">
          <SessionRecording sessionId={sessionId} projectId={projectId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
