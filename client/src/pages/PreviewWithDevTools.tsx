import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { PreviewDevTools } from '@/components/PreviewDevTools';
import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { 
  Globe, 
  Smartphone, 
  Tablet, 
  Monitor,
  Code,
  Terminal,
  RefreshCw,
  ExternalLink,
  Share2
} from 'lucide-react';

interface DevicePreset {
  name: string;
  width: number;
  height: number;
  icon: React.ReactNode;
}

const devicePresets: DevicePreset[] = [
  { name: 'Desktop', width: 1920, height: 1080, icon: <Monitor className="h-4 w-4" /> },
  { name: 'Laptop', width: 1366, height: 768, icon: <Monitor className="h-4 w-4" /> },
  { name: 'Tablet', width: 768, height: 1024, icon: <Tablet className="h-4 w-4" /> },
  { name: 'Mobile', width: 375, height: 667, icon: <Smartphone className="h-4 w-4" /> },
];

export default function PreviewWithDevTools() {
  const params = useParams();
  const projectId = parseInt(params.id as string);
  const [showDevTools, setShowDevTools] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState('Desktop');
  const [customWidth, setCustomWidth] = useState(1920);
  const [customHeight, setCustomHeight] = useState(1080);
  const [previewUrl, setPreviewUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Get project details
  const { data: project } = useQuery({
    queryKey: [`/api/projects/${projectId}`],
    enabled: !!projectId,
  });

  useEffect(() => {
    if (projectId) {
      // Set preview URL - in production this would be the actual preview server URL
      setPreviewUrl(`/preview/${projectId}`);
      setIsLoading(false);
    }
  }, [projectId]);

  const handleDeviceChange = (device: string) => {
    setSelectedDevice(device);
    const preset = devicePresets.find(d => d.name === device);
    if (preset) {
      setCustomWidth(preset.width);
      setCustomHeight(preset.height);
    }
  };

  const refreshPreview = () => {
    // Force iframe reload
    const iframe = document.getElementById('preview-iframe') as HTMLIFrameElement;
    if (iframe) {
      iframe.src = iframe.src;
    }
  };

  const openInNewTab = () => {
    window.open(previewUrl, '_blank');
  };

  return (
    <div className="flex flex-col h-full">
        {/* Header */}
        <Card className="rounded-none border-x-0 border-t-0">
          <CardHeader className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <CardTitle className="text-[15px] flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  Preview: {(project as any)?.name || 'Loading...'}
                </CardTitle>
                <Badge variant="outline" className="gap-1">
                  <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
                  Live
                </Badge>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Device selector */}
                <Select value={selectedDevice} onValueChange={handleDeviceChange}>
                  <SelectTrigger className="w-full sm:w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {devicePresets.map((device) => (
                      <SelectItem key={device.name} value={device.name}>
                        <div className="flex items-center gap-2">
                          {device.icon}
                          <span>{device.name}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {device.width}x{device.height}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Separator orientation="vertical" className="h-6" />

                {/* Actions */}
                <Button size="sm" variant="ghost" onClick={refreshPreview}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={openInNewTab}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="ghost">
                  <Share2 className="h-4 w-4" />
                </Button>

                <Separator orientation="vertical" className="h-6" />

                {/* Dev Tools Toggle */}
                <Button
                  size="sm"
                  variant={showDevTools ? "default" : "outline"}
                  onClick={() => setShowDevTools(!showDevTools)}
                >
                  <Terminal className="h-4 w-4 mr-2" />
                  DevTools
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Preview Container */}
        <div className="flex-1 relative bg-gray-100 dark:bg-gray-900">
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div
              className="bg-white dark:bg-gray-800 shadow-2xl rounded-lg overflow-hidden transition-all duration-300"
              style={{
                width: `${customWidth}px`,
                maxWidth: '100%',
                height: `${customHeight}px`,
                maxHeight: showDevTools ? 'calc(100% - 400px)' : '100%',
              }}
            >
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading preview...</p>
                  </div>
                </div>
              ) : (
                <iframe
                  id="preview-iframe"
                  src={previewUrl}
                  className="w-full h-full border-0"
                  title="Project Preview"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                />
              )}
            </div>
          </div>

          {/* Device frame indicators */}
          <div className="absolute bottom-4 left-4 text-[11px] text-muted-foreground bg-background/80 px-2 py-1 rounded">
            {customWidth} × {customHeight}
          </div>
        </div>

        {/* Dev Tools */}
        {showDevTools && (
          <PreviewDevTools
            previewUrl={previewUrl}
            projectId={projectId}
            onClose={() => setShowDevTools(false)}
          />
        )}
      </div>
  );
}