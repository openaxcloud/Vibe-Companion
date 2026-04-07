import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { 
  RefreshCw, 
  ExternalLink, 
  Smartphone, 
  Tablet, 
  Monitor,
  X,
  Maximize2,
  Minimize2,
  Home
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface WebPreviewProps {
  projectId: number;
  isRunning?: boolean;
  className?: string;
}

const devicePresets = {
  desktop: { width: '100%', height: '100%', label: 'Desktop' },
  tablet: { width: '768px', height: '1024px', label: 'Tablet' },
  mobile: { width: '375px', height: '667px', label: 'Mobile' }
};

export function WebPreview({ projectId, isRunning = false, className = '' }: WebPreviewProps) {
  const [url, setUrl] = useState('');
  const [device, setDevice] = useState<keyof typeof devicePresets>('desktop');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  // Get preview URL for the project
  const { data: previewData } = useQuery<{ previewUrl: string }>({
    queryKey: [`/api/projects/${projectId}/preview-url`],
    enabled: !!projectId
  });
  
  useEffect(() => {
    if (previewData?.previewUrl) {
      setUrl(previewData.previewUrl);
    }
  }, [previewData]);
  
  const handleRefresh = () => {
    setIframeKey(prev => prev + 1);
  };
  
  const handleOpenInNewTab = () => {
    if (url) {
      window.open(url, '_blank');
    }
  };
  
  const handleNavigate = (newUrl: string) => {
    setUrl(newUrl);
  };
  
  const handleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };
  
  if (!previewData?.previewUrl) {
    return (
      <Card className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center space-y-4 p-8">
          <Monitor className="w-16 h-16 mx-auto text-muted-foreground" />
          <h3 className="text-lg font-semibold">Preview Unavailable</h3>
          <p className="text-sm text-muted-foreground">
            Add an HTML file to your project to see the preview.
          </p>
        </div>
      </Card>
    );
  }
  
  return (
    <div className={`flex flex-col h-full ${className} ${isFullscreen ? 'fixed inset-0 z-50 bg-background' : ''}`}>
      {/* Preview Toolbar */}
      <div className="flex items-center gap-2 p-2 border-b bg-muted/50">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleRefresh}
          title="Refresh"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => handleNavigate(previewData?.previewUrl || '')}
          title="Home"
        >
          <Home className="h-4 w-4" />
        </Button>
        
        <div className="flex-1 flex items-center gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleRefresh();
              }
            }}
            placeholder="Preview URL"
            className="h-8"
          />
        </div>
        
        <Select value={device} onValueChange={(value) => setDevice(value as keyof typeof devicePresets)}>
          <SelectTrigger className="w-32 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desktop">
              <div className="flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                Desktop
              </div>
            </SelectItem>
            <SelectItem value="tablet">
              <div className="flex items-center gap-2">
                <Tablet className="h-4 w-4" />
                Tablet
              </div>
            </SelectItem>
            <SelectItem value="mobile">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4" />
                Mobile
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={handleOpenInNewTab}
          title="Open in new tab"
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={handleFullscreen}
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
        
        {isFullscreen && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsFullscreen(false)}
            title="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      {/* Preview Container */}
      <div className="flex-1 flex items-center justify-center bg-muted/20 overflow-hidden">
        <div 
          className={`bg-white transition-all duration-300 ${
            device === 'desktop' ? 'w-full h-full' : 'shadow-lg rounded-lg overflow-hidden'
          }`}
          style={{
            width: device === 'desktop' ? '100%' : devicePresets[device].width,
            height: device === 'desktop' ? '100%' : devicePresets[device].height,
            maxWidth: '100%',
            maxHeight: '100%'
          }}
        >
          {url ? (
            <iframe
              key={iframeKey}
              ref={iframeRef}
              src={url}
              className="w-full h-full border-0"
              title="Web Preview"
              sandbox="allow-scripts allow-forms allow-same-origin allow-modals allow-popups allow-downloads"
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-muted">
              <p className="text-muted-foreground">No preview URL available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}