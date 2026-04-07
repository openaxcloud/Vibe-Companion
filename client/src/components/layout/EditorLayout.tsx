import { ReactNode, useState } from "react";
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from "@/components/ui/resizable";

interface EditorLayoutProps {
  editor: ReactNode;
  fileExplorer: ReactNode;
  preview?: ReactNode;
  bottomPanel?: ReactNode;
}

export default function EditorLayout({
  editor,
  fileExplorer,
  preview,
  bottomPanel,
}: EditorLayoutProps) {
  const [showPreview, setShowPreview] = useState(true);
  const [showBottomPanel, setShowBottomPanel] = useState(true);

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 flex overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          {/* File Explorer */}
          <ResizablePanel 
            defaultSize={20} 
            minSize={15} 
            maxSize={30}
            className="bg-background border-r"
          >
            {fileExplorer}
          </ResizablePanel>
          
          <ResizableHandle withHandle />
          
          <ResizablePanelGroup direction="vertical" className="flex-1">
            {/* Editor */}
            <ResizablePanel 
              defaultSize={70} 
              minSize={40}
              className="flex-1 overflow-hidden bg-background"
            >
              {showPreview ? (
                <ResizablePanelGroup direction="horizontal">
                  <ResizablePanel defaultSize={60} minSize={30} className="overflow-hidden">
                    {editor}
                  </ResizablePanel>
                  
                  <ResizableHandle withHandle />
                  
                  <ResizablePanel defaultSize={40} minSize={30} className="overflow-hidden">
                    {preview}
                  </ResizablePanel>
                </ResizablePanelGroup>
              ) : (
                editor
              )}
            </ResizablePanel>
            
            {showBottomPanel && (
              <>
                <ResizableHandle withHandle />
                
                <ResizablePanel 
                  defaultSize={30} 
                  minSize={20} 
                  maxSize={50}
                  className="bg-background border-t"
                >
                  {bottomPanel}
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}