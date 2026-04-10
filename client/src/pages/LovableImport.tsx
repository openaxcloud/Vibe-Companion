import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Heart, ArrowRight, CheckCircle, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useParams, useLocation } from 'wouter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function LovableImport() {
  const { id: projectId } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [lovableUrl, setLovableUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle');
  const [importDetails, setImportDetails] = useState<any>(null);
  const [exportData, setExportData] = useState<any>(null);

  const handleImport = async () => {
    if (!lovableUrl && !exportData) {
      toast({
        title: 'Error',
        description: 'Please enter a Lovable URL or upload export data',
        variant: 'destructive'
      });
      return;
    }

    setIsImporting(true);
    setImportStatus('processing');

    try {
      const response = await apiRequest('POST', '/api/import/lovable', {
        projectId: parseInt(projectId!),
        lovableUrl,
        lovableExportData: exportData
      });

      if (response.json.success) {
        setImportStatus('completed');
        setImportDetails(response.json.import);
        toast({
          title: 'Import Successful',
          description: 'Your Lovable project has been imported successfully!'
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
        description: error.message || 'Failed to import Lovable project',
        variant: 'destructive'
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          setExportData(data);
          toast({
            title: 'File Loaded',
            description: 'Lovable export data loaded successfully'
          });
        } catch (error) {
          toast({
            title: 'Invalid File',
            description: 'Please upload a valid Lovable export file',
            variant: 'destructive'
          });
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Import from Lovable</h1>
        <p className="text-muted-foreground">
          Transform your Lovable projects into fully-featured applications
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5" />
              Import Options
            </CardTitle>
            <CardDescription>
              Choose how you want to import your Lovable project
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="url" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="url">Project URL</TabsTrigger>
                <TabsTrigger value="upload">Upload Export</TabsTrigger>
              </TabsList>
              
              <TabsContent value="url">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="lovable-url">Lovable Project URL</Label>
                    <Input
                      id="lovable-url"
                      type="url"
                      placeholder="https://lovable.dev/project/..."
                      value={lovableUrl}
                      onChange={(e) => setLovableUrl(e.target.value)}
                      disabled={isImporting}
                    />
                  </div>
                  <Alert>
                    <AlertDescription>
                      Enter the URL of your Lovable project. We'll import your entire
                      application structure including pages, components, and API endpoints.
                    </AlertDescription>
                  </Alert>
                </div>
              </TabsContent>
              
              <TabsContent value="upload">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="lovable-file">Lovable Export File</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="lovable-file"
                        type="file"
                        accept=".json,.lovable"
                        onChange={handleFileUpload}
                        disabled={isImporting}
                        className="flex-1"
                      />
                      <Upload className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  {exportData && (
                    <Alert>
                      <AlertDescription>
                        Export loaded: {exportData.name || 'Unnamed Project'}
                        <br />
                        Stack: {exportData.stack?.frontend || 'Unknown'} + {exportData.stack?.backend || 'Unknown'}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <Button 
              onClick={handleImport} 
              disabled={isImporting || (!lovableUrl && !exportData)}
              className="w-full mt-4"
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing Project...
                </>
              ) : (
                <>
                  Import Project
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {importStatus !== 'idle' && (
          <Card>
            <CardHeader>
              <CardTitle>Import Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {importStatus === 'processing' && (
                  <>
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                      <div>
                        <p className="font-medium">Analyzing project structure...</p>
                        <p className="text-[13px] text-muted-foreground">
                          Detecting pages and components
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                      <div>
                        <p className="font-medium">Generating code...</p>
                        <p className="text-[13px] text-muted-foreground">
                          Creating React components and API routes
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {importStatus === 'completed' && importDetails && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="font-medium">Import completed successfully!</p>
                      </div>
                    </div>
                    {importDetails.metadata && (
                      <div className="pl-8 space-y-1 text-[13px] text-muted-foreground">
                        <p>• {importDetails.metadata.pagesCreated} pages created</p>
                        <p>• {importDetails.metadata.componentsCreated} components generated</p>
                        <p>• {importDetails.metadata.apiEndpoints} API endpoints configured</p>
                      </div>
                    )}
                  </div>
                )}

                {importStatus === 'failed' && (
                  <div className="flex items-center gap-3">
                    <div className="h-5 w-5 rounded-full bg-red-500" />
                    <div>
                      <p className="font-medium">Import failed</p>
                      <p className="text-[13px] text-muted-foreground">
                        Please check your input and try again
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>What gets imported?</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-[13px]">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                  <span>All pages with routing</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                  <span>React components with props</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                  <span>API endpoints and handlers</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                  <span>Database schema and models</span>
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Enhanced Features</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-[13px]">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5" />
                  <span>Full TypeScript support</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5" />
                  <span>Modern build tooling</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5" />
                  <span>One-click deployment</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-blue-500 mt-0.5" />
                  <span>Real-time collaboration</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}