import { ReactNode } from "react";
import { ReplitHeader } from "./ReplitHeader";
import { ReplitSidebar } from "./ReplitSidebar";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Home, Code, Users, User } from "lucide-react";

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
          <div className="hidden md:block">
            <ReplitSidebar projectId={projectId} />
          </div>
        )}
        
        <main className={`flex-1 flex flex-col overflow-auto ${className}`}>
          {children}
        </main>
      </div>
      
      {/* Mobile bottom navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50 safe-area-inset-bottom">
        <nav className="flex items-center justify-around h-14">
          <Button variant="ghost" size="sm" className="flex-1 h-full px-2" asChild>
            <Link href="/dashboard">
              <div className="flex flex-col items-center gap-1">
                <Home className="h-4 w-4" />
                <span className="text-xs">Home</span>
              </div>
            </Link>
          </Button>
          <Button variant="ghost" size="sm" className="flex-1 h-full px-2" asChild>
            <Link href="/projects">
              <div className="flex flex-col items-center gap-1">
                <Code className="h-4 w-4" />
                <span className="text-xs">Projects</span>
              </div>
            </Link>
          </Button>
          <Button variant="ghost" size="sm" className="flex-1 h-full px-2" asChild>
            <Link href="/community">
              <div className="flex flex-col items-center gap-1">
                <Users className="h-4 w-4" />
                <span className="text-xs">Community</span>
              </div>
            </Link>
          </Button>
          <Button variant="ghost" size="sm" className="flex-1 h-full px-2" asChild>
            <Link href="/account">
              <div className="flex flex-col items-center gap-1">
                <User className="h-4 w-4" />
                <span className="text-xs">Account</span>
              </div>
            </Link>
          </Button>
        </nav>
      </div>
    </div>
  );
}