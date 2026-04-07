import { ReactNode } from "react";
import { ReplitHeader } from "./ReplitHeader";
import { ReplitSidebar } from "./ReplitSidebar";

export function ReplitLayoutLoading() {
  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

interface ReplitLayoutProps {
  children: ReactNode;
  showSidebar?: boolean;
  projectId?: number;
  className?: string;
}

export function ReplitLayout({ 
  children, 
  showSidebar = true, 
  projectId,
  className = ""
}: ReplitLayoutProps) {
  return (
    <div className="h-screen flex flex-col replit-layout-main overflow-hidden">
      <ReplitHeader />
      
      <div className="flex flex-1 overflow-hidden">
        {showSidebar && (
          <ReplitSidebar projectId={projectId} />
        )}
        
        <main className={`flex-1 flex flex-col overflow-hidden ${className}`}>
          {children}
        </main>
      </div>
      

    </div>
  );
}