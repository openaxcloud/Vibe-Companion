import { ReactNode, useState, useEffect, useCallback } from "react";
import { ReplitHeader } from "./ReplitHeader";
import { ReplitSidebar } from "./ReplitSidebar";
import { MobileNavigation } from "@/components/mobile/MobileNavigation";
import { MobileFileExplorer } from "@/components/mobile/MobileFileExplorer";
import { MobileToolsPanel } from "@/components/mobile/MobileToolsPanel";
import { MobileCreateModal } from "@/components/mobile/MobileCreateModal";
import { PullToRefresh } from "@/components/ui/mobile-gestures";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useIsMobile, useDeviceInfo } from "@/hooks/use-mobile";
import { ECodeLoading } from "@/components/ECodeLoading";

interface ReplitLayoutProps {
  children: ReactNode;
  showSidebar?: boolean;
  projectId?: number;
  className?: string;
  onRefresh?: () => Promise<void>;
}

export function ReplitLayout({
  children,
  showSidebar = true,
  projectId,
  className = "",
  onRefresh
}: ReplitLayoutProps) {
  const [location, navigate] = useLocation();
  // Use improved mobile detection that considers both width AND height
  // This correctly identifies phone landscape vs tablet portrait
  const isMobile = useIsMobile();
  const deviceInfo = useDeviceInfo();
  const isTablet = deviceInfo.isTablet;
  const isLandscape = deviceInfo.isLandscape;
  const isMobileLandscape = deviceInfo.isMobileLandscape;
  const [showFileExplorer, setShowFileExplorer] = useState(false);
  const [showToolsPanel, setShowToolsPanel] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchStartY, setTouchStartY] = useState(0);
  const [orientation, setOrientation] = useState(window.orientation || 0);

  // Viewport meta tag management for mobile scaling
  useEffect(() => {
    if (!isMobile) return;
    
    let viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.setAttribute('name', 'viewport');
      document.head.appendChild(viewport);
    }
    
    viewport.setAttribute('content', 
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
    );
    
    // Add mobile-specific body classes
    document.body.classList.add('mobile-device');
    if (isTablet) document.body.classList.add('tablet-device');
    if (isLandscape) document.body.classList.add('landscape-mode');
    
    return () => {
      document.body.classList.remove('mobile-device', 'tablet-device', 'landscape-mode');
    };
  }, [isMobile, isTablet, isLandscape]);

  // Orientation change detection
  useEffect(() => {
    const handleOrientationChange = () => {
      setOrientation(window.orientation || 0);
      // Force re-render to adjust layout
      window.dispatchEvent(new Event('resize'));
    };
    
    window.addEventListener('orientationchange', handleOrientationChange);
    return () => window.removeEventListener('orientationchange', handleOrientationChange);
  }, []);

  // Enhanced gesture detection with velocity tracking
  useEffect(() => {
    if (!isMobile) return;

    let touchStartTime = 0;
    let touchEndTime = 0;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      setTouchStartX(touch.clientX);
      setTouchStartY(touch.clientY);
      touchStartTime = Date.now();
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;
      touchEndTime = Date.now();
      
      const velocity = Math.abs(deltaX) / (touchEndTime - touchStartTime);
      const edgeThreshold = 30; // pixels from edge
      const swipeThreshold = 80; // minimum swipe distance
      const velocityThreshold = 0.3; // minimum velocity for quick swipe

      // Check if swipe is more horizontal than vertical
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Swipe right from left edge - open file explorer
        if (touchStartX < edgeThreshold && 
            (deltaX > swipeThreshold || velocity > velocityThreshold)) {
          setShowFileExplorer(true);
          // Haptic feedback if available
          if ('vibrate' in navigator) navigator.vibrate(10);
        }
        
        // Swipe left from right edge - open tools panel
        if (touchStartX > window.innerWidth - edgeThreshold && 
            (Math.abs(deltaX) > swipeThreshold || velocity > velocityThreshold)) {
          setShowToolsPanel(true);
          // Haptic feedback if available
          if ('vibrate' in navigator) navigator.vibrate(10);
        }
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [touchStartX, touchStartY, isMobile]);

  const handleCreateClick = () => {
    setShowCreateModal(true);
  };

  const handleFileSelect = (file: any) => {
    // Handle file selection
  };

  const handleCreateProject = (template: any) => {
    navigate('/ide/new');
  };

  const handleRefresh = async () => {
    if (onRefresh) {
      await onRefresh();
    } else {
      // Default refresh behavior
      window.location.reload();
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[var(--ecode-background)] overflow-hidden">
      <ReplitHeader />
      
      <div className="flex flex-1 overflow-hidden">
        {showSidebar && !isMobile && (
          <div className="hidden md:block">
            <ReplitSidebar projectId={projectId} />
          </div>
        )}
        
        <main className={cn(
          "flex-1 flex flex-col overflow-auto",
          isMobile && "pb-14", // Add padding for mobile navigation
          className
        )}>
          {isMobile && onRefresh ? (
            <PullToRefresh onRefresh={handleRefresh}>
              {children}
            </PullToRefresh>
          ) : (
            children
          )}
        </main>
      </div>
      
      {/* Mobile Navigation */}
      {isMobile && (
        <MobileNavigation onCreateClick={handleCreateClick} />
      )}
      
      {/* Mobile File Explorer */}
      {projectId && (
        <MobileFileExplorer
          isOpen={showFileExplorer}
          onClose={() => setShowFileExplorer(false)}
          onFileSelect={handleFileSelect}
          projectId={projectId}
          currentFileId={projectId}
        />
      )}
      
      {/* Mobile Tools Panel */}
      <MobileToolsPanel
        isOpen={showToolsPanel}
        onClose={() => setShowToolsPanel(false)}
      />
      
      {/* Mobile Create Modal */}
      <MobileCreateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateProject}
      />
    </div>
  );
}

interface ReplitLayoutLoadingProps {
  text?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSidebar?: boolean;
  projectId?: number;
}

export function ReplitLayoutLoading({ 
  text = "Loading...", 
  size = "lg",
  showSidebar = true,
  projectId 
}: ReplitLayoutLoadingProps) {
  const isMobile = useMediaQuery("(max-width: 768px)");
  
  return (
    <div className="h-screen flex flex-col bg-[var(--ecode-background)] overflow-hidden">
      <ReplitHeader />
      
      <div className="flex flex-1 overflow-hidden">
        {showSidebar && !isMobile && (
          <div className="hidden md:block">
            <ReplitSidebar projectId={projectId} />
          </div>
        )}
        
        <main className={cn(
          "flex-1 flex flex-col overflow-auto",
          isMobile && "pb-14"
        )}>
          <div className="relative h-full min-h-[calc(100vh-64px)]">
            <div className="absolute inset-0 flex items-center justify-center">
              <ECodeLoading size={size} text={text} />
            </div>
          </div>
        </main>
      </div>
      
      {isMobile && <MobileNavigation onCreateClick={() => {}} />}
    </div>
  );
}