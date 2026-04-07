import { useMediaQuery } from '@/hooks/use-media-query';
import { ReplitMobileShell } from './ReplitMobileShell';
import { ReplitDesktopShell } from './ReplitDesktopShell';
import { useState } from 'react';

interface ResponsiveShellProps {
  projectId: number;
  onClose?: () => void;
  onBack?: () => void;
}

export function ResponsiveShell({ projectId, onClose, onBack }: ResponsiveShellProps) {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [isFullscreen, setIsFullscreen] = useState(false);

  if (isMobile) {
    return (
      <ReplitMobileShell 
        projectId={projectId} 
        onClose={onClose}
        onBack={onBack}
      />
    );
  }

  return (
    <ReplitDesktopShell 
      projectId={projectId}
      isFullscreen={isFullscreen}
      onFullscreenChange={setIsFullscreen}
    />
  );
}

export default ResponsiveShell;
