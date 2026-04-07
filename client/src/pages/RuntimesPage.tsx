/**
 * Runtimes Page
 * Provides UI for viewing and managing language runtimes
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LanguageEnvironments, Language, languageConfigs } from '@/components/LanguageEnvironments';
import { RuntimePanel } from '@/components/RuntimePanel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { InfoIcon, AlertCircle } from 'lucide-react';

export default function RuntimesPage() {
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('nodejs');
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  
  const { data: dependencies, isLoading: isLoadingDependencies } = useQuery({
    queryKey: ['/api/runtime/dependencies'],
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });

  const { data: projects, isLoading: isLoadingProjects } = useQuery({
    queryKey: ['/api/projects'],
    refetchInterval: false,
  });

  // Add interfaces to fix type issues
  interface RuntimeDependencies {
    docker: boolean;
    nix: boolean;
    languages?: Record<string, boolean>;
  }

  // Cast dependencies to the correct type with defaults
  const deps = (dependencies || {}) as RuntimeDependencies;
  const dockerAvailable = deps.docker || false;
  const nixAvailable = deps.nix || false;

  // If neither Docker nor Nix is available, show a warning
  const showDependencyWarning = !isLoadingDependencies && !dockerAvailable && !nixAvailable;

  return (
    <div className="container py-6">
      <h1 className="text-3xl font-bold mb-6">Language Runtimes</h1>
      
      {showDependencyWarning && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Runtime Dependencies Not Available</AlertTitle>
          <AlertDescription>
            Docker and Nix are not available on this system. Language runtimes require either Docker or Nix to be installed.
          </AlertDescription>
        </Alert>
      )}

      {!dockerAvailable && nixAvailable && (
        <Alert className="mb-6">
          <InfoIcon className="h-4 w-4" />
          <AlertTitle>Using Nix for Language Runtimes</AlertTitle>
          <AlertDescription>
            Docker is not available. Using Nix for language runtime environments.
          </AlertDescription>
        </Alert>
      )}

      {dockerAvailable && !nixAvailable && (
        <Alert className="mb-6">
          <InfoIcon className="h-4 w-4" />
          <AlertTitle>Using Docker for Language Runtimes</AlertTitle>
          <AlertDescription>
            Nix is not available. Using Docker for language runtime environments.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2">
          <LanguageEnvironments 
            onSelectLanguage={setSelectedLanguage}
            selectedLanguage={selectedLanguage}
          />
        </div>
        
        <div className="lg:col-span-3">
          <Tabs defaultValue="info" className="h-full">
            <TabsList>
              <TabsTrigger value="info">Language Info</TabsTrigger>
              <TabsTrigger value="runtime">Runtime</TabsTrigger>
            </TabsList>
            
            <TabsContent value="info" className="h-[calc(100%-2rem)]">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>{selectedLanguage ? `${selectedLanguage} Environment` : 'Language Environment'}</CardTitle>
                  <CardDescription>
                    Setup and configuration details
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedLanguage && (
                    <div className="space-y-4">
                      <div>
                        <h3 className="text-sm font-medium">Runtime Setup</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {dockerAvailable ? 
                            `Using Docker with official ${selectedLanguage} images` : 
                            nixAvailable ? 
                              `Using Nix with ${selectedLanguage} packages` : 
                              'No runtime environment available'
                          }
                        </p>
                      </div>
                      
                      <div>
                        <h3 className="text-sm font-medium">Environment Info</h3>
                        <table className="w-full text-sm mt-1">
                          <tbody>
                            <tr>
                              <td className="py-1 font-medium">Default File</td>
                              <td className="py-1 text-muted-foreground">
                                {languageConfigs[selectedLanguage]?.defaultFile || 'index.js'}
                              </td>
                            </tr>
                            <tr>
                              <td className="py-1 font-medium">Run Command</td>
                              <td className="py-1 text-muted-foreground font-mono text-xs">
                                {languageConfigs[selectedLanguage]?.runCommand || 'node index.js'}
                              </td>
                            </tr>
                            <tr>
                              <td className="py-1 font-medium">File Extensions</td>
                              <td className="py-1 text-muted-foreground">
                                {languageConfigs[selectedLanguage]?.fileExtensions.join(', ') || '.js'}
                              </td>
                            </tr>
                            {languageConfigs[selectedLanguage]?.installCommand && (
                              <tr>
                                <td className="py-1 font-medium">Install Command</td>
                                <td className="py-1 text-muted-foreground font-mono text-xs">
                                  {languageConfigs[selectedLanguage]?.installCommand}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      
                      <div>
                        <h3 className="text-sm font-medium">Packages & Dependencies</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {selectedLanguage === 'nodejs' || selectedLanguage === 'typescript' ? 
                            'Manages dependencies via package.json and npm' : 
                            selectedLanguage === 'python' ? 
                              'Manages dependencies via requirements.txt and pip' : 
                              'Dependency management varies by project'
                          }
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="runtime" className="h-[calc(100%-2rem)]">
              {selectedProjectId ? (
                <RuntimePanel projectId={selectedProjectId} />
              ) : (
                <Card className="h-full">
                  <CardHeader>
                    <CardTitle>Runtime Environment</CardTitle>
                    <CardDescription>
                      Select a project to manage its runtime
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                      No project selected
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}