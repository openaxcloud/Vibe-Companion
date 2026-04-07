import { useState, useEffect } from 'react';
import { File } from '@shared/schema';
import { RefreshCw, ExternalLink, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PreviewProps {
  openFiles: File[];
  projectId?: number;
}

const Preview = ({ openFiles, projectId }: PreviewProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Process HTML file content to create a proper preview
  const getPreviewContent = (): string => {
    // Find an HTML file to display
    const htmlFile = openFiles.find(file => file.name.endsWith('.html'));
    
    if (!htmlFile) {
      return `
        <html>
          <body style="font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background-color: #f9fafb; color: #374151;">
            <div style="text-align: center; padding: 2rem;">
              <h2 style="font-size: 1.5rem; margin-bottom: 1rem;">No HTML file found</h2>
              <p style="color: #6b7280;">Create an HTML file to see a preview.</p>
            </div>
          </body>
        </html>
      `;
    }
    
    // Parse other referenced files
    let content = htmlFile.content || '';
    
    // Inject CSS files
    const cssFiles = openFiles.filter(file => file.name.endsWith('.css'));
    if (cssFiles.length > 0) {
      let cssStyles = '';
      cssFiles.forEach(cssFile => {
        cssStyles += `<style>${cssFile.content || ''}</style>`;
      });
      
      // Insert styles in head
      content = content.replace('</head>', `${cssStyles}</head>`);
    }
    
    // Inject JavaScript files
    const jsFiles = openFiles.filter(file => file.name.endsWith('.js'));
    if (jsFiles.length > 0) {
      let jsScripts = '';
      jsFiles.forEach(jsFile => {
        jsScripts += `<script>${jsFile.content || ''}</script>`;
      });
      
      // Insert scripts before body end
      content = content.replace('</body>', `${jsScripts}</body>`);
    }
    
    return content;
  };
  
  // Refresh the preview
  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
    }, 300);
  };
  
  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };
  
  // Open in new window
  const openInNewWindow = () => {
    const content = getPreviewContent();
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(content);
      newWindow.document.close();
    }
  };
  
  // Get iframe content
  useEffect(() => {
    handleRefresh();
  }, [openFiles]);
  
  return (
    <div className={`flex flex-col h-full ${isFullscreen ? 'fixed inset-0 z-50 bg-background' : ''}`}>
      {/* Preview header */}
      <div className="flex items-center justify-between p-2 border-b">
        <h3 className="text-sm font-semibold">Preview</h3>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={handleRefresh}
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={openInNewWindow}
            title="Open in new window"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost" 
            size="icon" 
            className="h-8 w-8"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      
      {/* Preview iframe */}
      <div className="flex-1 bg-white">
        <iframe
          key={isLoading ? 'loading' : 'loaded'}
          className="w-full h-full border-none"
          sandbox="allow-scripts allow-same-origin"
          srcDoc={getPreviewContent()}
          title="Preview"
        />
      </div>
    </div>
  );
};

export default Preview;