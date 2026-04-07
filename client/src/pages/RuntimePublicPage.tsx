/**
 * Runtime Public Page
 * A public route to test and demonstrate runtime functionality without authentication requirements
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LanguageEnvironments, Language, languageConfigs } from '@/components/LanguageEnvironments';
import { TestAuth } from '@/components/TestAuth';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { 
  Alert, 
  AlertTitle, 
  AlertDescription 
} from '@/components/ui/alert';
import { 
  InfoIcon, 
  AlertCircle, 
  Server, 
  Terminal, 
  Code, 
  Monitor 
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function RuntimePublicPage() {
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('nodejs');
  
  const { data: dependencies, isLoading: isLoadingDependencies, error } = useQuery({
    queryKey: ['/api/runtime/dependencies'],
    refetchInterval: false,
    refetchOnWindowFocus: false,
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

  // For viewing raw data
  const rawDependenciesData = JSON.stringify(dependencies, null, 2);

  return (
    <div className="container py-6">
      <h1 className="text-3xl font-bold mb-4">Language Runtime Support</h1>
      <p className="text-lg text-muted-foreground mb-6">
        Test and explore available runtime environments and configurations
      </p>
      
      <TestAuth />
      
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error Loading Runtime Data</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : 'Failed to load runtime data'}
          </AlertDescription>
        </Alert>
      )}
      
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
              <TabsTrigger value="runtime">Runtime Details</TabsTrigger>
              <TabsTrigger value="data">Raw Data</TabsTrigger>
            </TabsList>
            
            <TabsContent value="info" className="h-[calc(100%-2rem)]">
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Code className="h-5 w-5" />
                    <CardTitle>{selectedLanguage ? `${languageConfigs[selectedLanguage]?.displayName} Environment` : 'Language Environment'}</CardTitle>
                  </div>
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
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Terminal className="h-5 w-5" />
                    <CardTitle>Runtime Environment</CardTitle>
                  </div>
                  <CardDescription>
                    Runtime execution details for {selectedLanguage}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="flex flex-col space-y-2">
                      <span className="text-sm font-medium">Docker Status</span>
                      <div className="flex items-center gap-2">
                        <span className={`h-3 w-3 rounded-full ${dockerAvailable ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        <span className="text-sm text-muted-foreground">{dockerAvailable ? 'Available' : 'Not Available'}</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col space-y-2">
                      <span className="text-sm font-medium">Nix Status</span>
                      <div className="flex items-center gap-2">
                        <span className={`h-3 w-3 rounded-full ${nixAvailable ? 'bg-green-500' : 'bg-red-500'}`}></span>
                        <span className="text-sm text-muted-foreground">{nixAvailable ? 'Available' : 'Not Available'}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <span className="text-sm font-medium">Runtime Support</span>
                    <div className="rounded-md border p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Monitor className="h-5 w-5 text-muted-foreground" />
                          <span>{languageConfigs[selectedLanguage]?.displayName} Runtime</span>
                        </div>
                        <div>
                          {deps.languages && deps.languages[selectedLanguage] ? (
                            <div className="flex items-center gap-2">
                              <span className="h-3 w-3 rounded-full bg-green-500"></span>
                              <span className="text-sm text-green-600">Ready</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="h-3 w-3 rounded-full bg-amber-500"></span>
                              <span className="text-sm text-amber-600">Not Initialized</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <span className="text-sm font-medium">Actions</span>
                    <div className="flex gap-2">
                      <Button disabled={!dockerAvailable && !nixAvailable} size="sm">
                        <Server className="h-4 w-4 mr-2" />
                        Start Runtime
                      </Button>
                      <Button variant="outline" size="sm">
                        <Terminal className="h-4 w-4 mr-2" />
                        Open Terminal
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="data" className="h-[calc(100%-2rem)]">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Raw Runtime Data</CardTitle>
                  <CardDescription>
                    Debug information for runtime dependencies
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md bg-muted p-4">
                    <pre className="text-xs overflow-auto max-h-[60vh]">
                      {isLoadingDependencies ? 'Loading...' : rawDependenciesData || 'No data available'}
                    </pre>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}