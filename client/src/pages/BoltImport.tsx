// @ts-nocheck
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Zap, ArrowRight, CheckCircle, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useParams, useLocation } from 'wouter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function BoltImport() {
  const { id: projectId } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [boltUrl, setBoltUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle');
  const [importDetails, setImportDetails] = useState<any>(null);
  const [projectData, setProjectData] = useState<any>(null);

  const handleImport = async () => {
    if (!boltUrl && !projectData) {
      toast({
        title: 'Error',
        description: 'Please enter a Bolt URL or upload project data',
        variant: 'destructive'
      });
      return;
    }

    setIsImporting(true);
    setImportStatus('processing');

    try {
      const response = await apiRequest('POST', '/api/import/bolt', {
        projectId: parseInt(projectId!),
        boltUrl,
        boltProjectData: projectData
      });

      if (response.json.success) {
        setImportStatus('completed');
        setImportDetails(response.json.import);
        toast({
          title: 'Import Successful',
          description: 'Your Bolt project has been imported successfully!'
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
        description: error.message || 'Failed to import Bolt project',
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
          setProjectData(data);
          toast({
            title: 'File Loaded',
            description: 'Project data loaded successfully'
          });
        } catch (error) {
          toast({
            title: 'Invalid File',
            description: 'Please upload a valid Bolt project export file',
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
        <h1 className="text-3xl font-bold mb-2">Import from Bolt</h1>
        <p className="text-muted-foreground">
          Bring your Bolt projects to life with enhanced features and deployment options
        </p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Import Options
            </CardTitle>
            <CardDescription>
              Choose how you want to import your Bolt project
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
                    <Label htmlFor="bolt-url">Bolt Project URL</Label>
                    <Input
                      id="bolt-url"
                      type="url"
                      placeholder="https://bolt.new/project/..."
                      value={boltUrl}
                      onChange={(e) => setBoltUrl(e.target.value)}
                      disabled={isImporting}
                    />
                  </div>
                  <Alert>
                    <AlertDescription>
                      Enter the URL of your public Bolt project. We'll import all files,
                      dependencies, and configurations.
                    </AlertDescription>
                  </Alert>
                </div>
              </TabsContent>
              
              <TabsContent value="upload">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="bolt-file">Project Export File</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="bolt-file"
                        type="file"
                        accept=".json"
                        onChange={handleFileUpload}
                        disabled={isImporting}
                        className="flex-1"
                      />
                      <Upload className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                  {projectData && (
                    <Alert>
                      <AlertDescription>
                        Project data loaded: {projectData.name || 'Unnamed Project'}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <Button 
              onClick={handleImport} 
              disabled={isImporting || (!boltUrl && !projectData)}
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
              <CardTitle>Import Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {importStatus === 'processing' && (
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                    <div>
                      <p className="font-medium">Processing your project...</p>
                      <p className="text-sm text-muted-foreground">
                        Importing files and setting up dependencies
                      </p>
                    </div>
                  </div>
                )}

                {importStatus === 'completed' && importDetails && (
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="font-medium">Import completed!</p>
                      <p className="text-sm text-muted-foreground">
                        Imported {importDetails.metadata?.filesImported || 0} files
                      </p>
                    </div>
                  </div>
                )}

                {importStatus === 'failed' && (
                  <div className="flex items-center gap-3">
                    <div className="h-5 w-5 rounded-full bg-red-500" />
                    <div>
                      <p className="font-medium">Import failed</p>
                      <p className="text-sm text-muted-foreground">
                        Please check your input and try again
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
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                <span>All project files and folder structure</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                <span>Package dependencies and configurations</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                <span>Environment variables and settings</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                <span>Build and deployment configurations</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}