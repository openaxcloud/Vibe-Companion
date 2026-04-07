import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Zap, ArrowRight, Upload, Clock, Sparkles } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const isBoltImportEnabled = false;

export default function BoltImport() {
  const [boltUrl, setBoltUrl] = useState('');

  return (
    <div className="container max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-3xl font-bold">Import from Bolt</h1>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Coming Soon
          </Badge>
        </div>
        <p className="text-muted-foreground">
          We're working on integrating Bolt projects. Stay tuned for updates!
        </p>
      </div>

      <Alert className="mb-6 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
        <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertDescription className="text-blue-800 dark:text-blue-200">
          <strong>Bolt Import - Coming Soon!</strong> We're actively developing this feature to help you 
          seamlessly migrate your Bolt projects. Check back soon for updates.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6">
        <Card className="opacity-60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Import Options
              <Badge variant="outline" className="ml-2 text-[11px]">Preview</Badge>
            </CardTitle>
            <CardDescription>
              Choose how you want to import your Bolt project (available soon)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="url" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="url" disabled={!isBoltImportEnabled}>Project URL</TabsTrigger>
                <TabsTrigger value="upload" disabled={!isBoltImportEnabled}>Upload Export</TabsTrigger>
              </TabsList>
              
              <TabsContent value="url">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="bolt-url" className="text-muted-foreground">Bolt Project URL</Label>
                    <Input
                      id="bolt-url"
                      data-testid="input-bolt-url"
                      type="url"
                      placeholder="https://bolt.new/project/..."
                      value={boltUrl}
                      onChange={(e) => setBoltUrl(e.target.value)}
                      disabled={true}
                      className="cursor-not-allowed"
                    />
                  </div>
                  <Alert>
                    <AlertDescription className="text-muted-foreground">
                      When available, you'll be able to enter your Bolt project URL to import all files,
                      dependencies, and configurations.
                    </AlertDescription>
                  </Alert>
                </div>
              </TabsContent>
              
              <TabsContent value="upload">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="bolt-file" className="text-muted-foreground">Project Export File</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="bolt-file"
                        data-testid="input-bolt-file"
                        type="file"
                        accept=".json"
                        disabled={true}
                        className="flex-1 cursor-not-allowed"
                      />
                      <Upload className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="w-full mt-4">
                    <Button 
                      data-testid="button-import-bolt"
                      disabled={true}
                      className="w-full cursor-not-allowed"
                    >
                      Import Project
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Bolt import is coming soon. We're working on this feature!</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-blue-500" />
              What's Coming
            </CardTitle>
            <CardDescription>
              Here's what you'll be able to do when Bolt import launches
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-[13px] text-muted-foreground">
              <li className="flex items-start gap-2">
                <Clock className="h-4 w-4 mt-0.5 text-blue-500" />
                <span>Import all project files and folder structure</span>
              </li>
              <li className="flex items-start gap-2">
                <Clock className="h-4 w-4 mt-0.5 text-blue-500" />
                <span>Migrate package dependencies and configurations</span>
              </li>
              <li className="flex items-start gap-2">
                <Clock className="h-4 w-4 mt-0.5 text-blue-500" />
                <span>Transfer environment variables and settings</span>
              </li>
              <li className="flex items-start gap-2">
                <Clock className="h-4 w-4 mt-0.5 text-blue-500" />
                <span>Preserve build and deployment configurations</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
