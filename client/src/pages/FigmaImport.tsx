import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Figma, ArrowRight, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useParams, useLocation } from 'wouter';

export default function FigmaImport() {
  const { id: projectId } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [figmaUrl, setFigmaUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle');
  const [importDetails, setImportDetails] = useState<any>(null);

  const handleImport = async () => {
    if (!figmaUrl) {
      toast({
        title: 'Error',
        description: 'Please enter a Figma URL',
        variant: 'destructive'
      });
      return;
    }

    setIsImporting(true);
    setImportStatus('processing');

    try {
      const response = await apiRequest('POST', '/api/import/figma', {
        projectId: parseInt(projectId!),
        figmaUrl
      });

      const result = await response.json();
      if (result.success) {
        setImportStatus('completed');
        setImportDetails(result.import);
        toast({
          title: 'Import Successful',
          description: 'Your Figma design has been imported successfully!'
        });
        
        // Navigate to project after 2 seconds
        setTimeout(() => {
          navigate(`/projects/${projectId}`);
        }, 2000);
      }
    } catch (error: any) {
      setImportStatus('failed');
      toast({
        title: 'Import Failed',
        description: error.message || 'Failed to import Figma design',
        variant: 'destructive'
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Import from Figma</h1>
        <p className="text-muted-foreground">
          Transform your Figma designs into React components with a single click
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Figma className="h-5 w-5" />
              Figma Project URL
            </CardTitle>
            <CardDescription>
              Enter the URL of your Figma file or project
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label htmlFor="figma-url">Figma URL</Label>
                <Input
                  id="figma-url"
                  type="url"
                  placeholder="https://www.figma.com/file/..."
                  value={figmaUrl}
                  onChange={(e) => setFigmaUrl(e.target.value)}
                  disabled={isImporting}
                />
              </div>

              <Alert>
                <AlertDescription>
                  Make sure you have viewer access to the Figma file. We'll convert your designs
                  into reusable React components with proper styling.
                </AlertDescription>
              </Alert>

              <Button 
                onClick={handleImport} 
                disabled={isImporting || !figmaUrl}
                className="w-full"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing Design...
                  </>
                ) : (
                  <>
                    Import Design
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {importStatus !== 'idle' && (
          <Card>
            <CardHeader>
              <CardTitle>Import Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {importStatus === 'processing' && (
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                    <div>
                      <p className="font-medium">Processing your design...</p>
                      <p className="text-[13px] text-muted-foreground">
                        Extracting components and design tokens
                      </p>
                    </div>
                  </div>
                )}

                {importStatus === 'completed' && importDetails && (
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium">Import completed!</p>
                      <p className="text-[13px] text-muted-foreground">
                        Created {importDetails.metadata?.componentsCreated || 0} components
                      </p>
                    </div>
                  </div>
                )}

                {importStatus === 'failed' && (
                  <div className="flex items-center gap-3">
                    <div className="h-5 w-5 rounded-full bg-red-500" />
                    <div>
                      <p className="font-medium">Import failed</p>
                      <p className="text-[13px] text-muted-foreground">
                        Please check your URL and try again
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>What gets imported?</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-[13px]">
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                <span>React components for each Figma component</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                <span>Design tokens (colors, typography, spacing)</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                <span>Responsive layouts and styling</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                <span>Automatic theme generation</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}