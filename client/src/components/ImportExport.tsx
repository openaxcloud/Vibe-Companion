import React, { useState } from 'react';
import { 
  Download, Upload, Archive, FileJson, FileCode, 
  Loader2, Check, AlertCircle, Info, File,
  FolderOpen, Package, Database, GitBranch
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';

interface ImportExportProps {
  projectId: number;
  className?: string;
}

type ExportFormat = 'zip' | 'tar' | 'git-bundle';
type ImportSource = 'file' | 'url' | 'github';

interface ExportOptions {
  includeNodeModules: boolean;
  includeGitHistory: boolean;
  includeEnvironmentVariables: boolean;
  includeDatabaseData: boolean;
}

export function ImportExport({ projectId, className }: ImportExportProps) {
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('zip');
  const [importSource, setImportSource] = useState<ImportSource>('file');
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    includeNodeModules: false,
    includeGitHistory: true,
    includeEnvironmentVariables: true,
    includeDatabaseData: false
  });
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [importProgress, setImportProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [githubUrl, setGithubUrl] = useState('');
  const { toast } = useToast();

  const handleExport = async () => {
    setIsExporting(true);
    setExportProgress(0);
    
    try {
      const response = await fetch(`/api/projects/${projectId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          format: exportFormat,
          options: exportOptions
        })
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Simulate progress
      const progressInterval = setInterval(() => {
        setExportProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // Get the blob
      const blob = await response.blob();
      clearInterval(progressInterval);
      setExportProgress(100);

      // Download the file
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project-export.${exportFormat === 'git-bundle' ? 'bundle' : exportFormat}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "Export Successful",
        description: "Your project has been exported successfully",
      });
      
      setShowExportDialog(false);
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export project",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const handleImport = async () => {
    if (importSource === 'file' && !selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please select a file to import",
        variant: "destructive"
      });
      return;
    }

    if (importSource === 'github' && !githubUrl.trim()) {
      toast({
        title: "No URL Provided",
        description: "Please enter a GitHub repository URL",
        variant: "destructive"
      });
      return;
    }

    setIsImporting(true);
    setImportProgress(0);

    try {
      let response;
      
      if (importSource === 'file' && selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        
        response = await fetch(`/api/projects/${projectId}/import`, {
          method: 'POST',
          credentials: 'include',
          body: formData
        });
      } else if (importSource === 'github') {
        response = await fetch(`/api/projects/${projectId}/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            source: 'github',
            url: githubUrl
          })
        });
      }

      if (!response?.ok) {
        throw new Error('Import failed');
      }

      // Simulate progress
      const progressInterval = setInterval(() => {
        setImportProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 300);

      await response.json();
      clearInterval(progressInterval);
      setImportProgress(100);

      toast({
        title: "Import Successful",
        description: "Your project has been imported successfully",
      });

      setShowImportDialog(false);
      
      // Refresh the page to show imported content
      window.location.reload();
    } catch (error) {
      toast({
        title: "Import Failed",
        description: "Failed to import project",
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
      setImportProgress(0);
      setSelectedFile(null);
      setGithubUrl('');
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  return (
    <>
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center">
            <Archive className="h-4 w-4 mr-2" />
            Import & Export
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center">
              <Download className="h-3.5 w-3.5 mr-1" />
              Export Project
            </h4>
            <p className="text-xs text-muted-foreground mb-3">
              Download your project with all files and configurations
            </p>
            <Button 
              size="sm" 
              className="w-full"
              onClick={() => setShowExportDialog(true)}
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              Export Project
            </Button>
          </div>

          <Separator />

          <div>
            <h4 className="text-sm font-medium mb-2 flex items-center">
              <Upload className="h-3.5 w-3.5 mr-1" />
              Import Project
            </h4>
            <p className="text-xs text-muted-foreground mb-3">
              Import files from a ZIP archive or GitHub repository
            </p>
            <Button 
              size="sm" 
              variant="outline" 
              className="w-full"
              onClick={() => setShowImportDialog(true)}
            >
              <Upload className="h-3.5 w-3.5 mr-1" />
              Import Files
            </Button>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Imports will merge with existing files. Export your project first to create a backup.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Project</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label className="text-sm mb-2">Export Format</Label>
              <RadioGroup value={exportFormat} onValueChange={(v) => setExportFormat(v as ExportFormat)}>
                <div className="flex items-center space-x-2 mb-2">
                  <RadioGroupItem value="zip" id="zip" />
                  <Label htmlFor="zip" className="text-sm font-normal cursor-pointer">
                    ZIP Archive (.zip)
                  </Label>
                </div>
                <div className="flex items-center space-x-2 mb-2">
                  <RadioGroupItem value="tar" id="tar" />
                  <Label htmlFor="tar" className="text-sm font-normal cursor-pointer">
                    TAR Archive (.tar.gz)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="git-bundle" id="git-bundle" />
                  <Label htmlFor="git-bundle" className="text-sm font-normal cursor-pointer">
                    Git Bundle (.bundle)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Separator />

            <div>
              <Label className="text-sm mb-2">Include in Export</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="node-modules"
                    checked={exportOptions.includeNodeModules}
                    onCheckedChange={(checked) => 
                      setExportOptions(prev => ({ ...prev, includeNodeModules: checked as boolean }))
                    }
                  />
                  <Label htmlFor="node-modules" className="text-sm font-normal cursor-pointer">
                    <span className="flex items-center">
                      <Package className="h-3.5 w-3.5 mr-1" />
                      Node modules (may be large)
                    </span>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="git-history"
                    checked={exportOptions.includeGitHistory}
                    onCheckedChange={(checked) => 
                      setExportOptions(prev => ({ ...prev, includeGitHistory: checked as boolean }))
                    }
                  />
                  <Label htmlFor="git-history" className="text-sm font-normal cursor-pointer">
                    <span className="flex items-center">
                      <GitBranch className="h-3.5 w-3.5 mr-1" />
                      Git history
                    </span>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="env-vars"
                    checked={exportOptions.includeEnvironmentVariables}
                    onCheckedChange={(checked) => 
                      setExportOptions(prev => ({ ...prev, includeEnvironmentVariables: checked as boolean }))
                    }
                  />
                  <Label htmlFor="env-vars" className="text-sm font-normal cursor-pointer">
                    <span className="flex items-center">
                      <FileCode className="h-3.5 w-3.5 mr-1" />
                      Environment variables
                    </span>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="db-data"
                    checked={exportOptions.includeDatabaseData}
                    onCheckedChange={(checked) => 
                      setExportOptions(prev => ({ ...prev, includeDatabaseData: checked as boolean }))
                    }
                  />
                  <Label htmlFor="db-data" className="text-sm font-normal cursor-pointer">
                    <span className="flex items-center">
                      <Database className="h-3.5 w-3.5 mr-1" />
                      Database data
                    </span>
                  </Label>
                </div>
              </div>
            </div>

            {isExporting && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Exporting...</span>
                  <span>{exportProgress}%</span>
                </div>
                <Progress value={exportProgress} />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleExport} disabled={isExporting}>
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Project Files</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label className="text-sm mb-2">Import Source</Label>
              <RadioGroup value={importSource} onValueChange={(v) => setImportSource(v as ImportSource)}>
                <div className="flex items-center space-x-2 mb-2">
                  <RadioGroupItem value="file" id="file" />
                  <Label htmlFor="file" className="text-sm font-normal cursor-pointer">
                    Upload ZIP/TAR file
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="github" id="github" />
                  <Label htmlFor="github" className="text-sm font-normal cursor-pointer">
                    Import from GitHub
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Separator />

            {importSource === 'file' && (
              <div>
                <Label htmlFor="file-upload" className="text-sm mb-2">Select File</Label>
                <div className="mt-1">
                  <input
                    id="file-upload"
                    type="file"
                    accept=".zip,.tar,.tar.gz,.bundle"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Label
                    htmlFor="file-upload"
                    className="flex items-center justify-center w-full px-4 py-2 border-2 border-dashed rounded-md cursor-pointer hover:border-primary"
                  >
                    {selectedFile ? (
                      <span className="flex items-center text-sm">
                        <File className="h-4 w-4 mr-2" />
                        {selectedFile.name}
                      </span>
                    ) : (
                      <span className="flex items-center text-sm text-muted-foreground">
                        <FolderOpen className="h-4 w-4 mr-2" />
                        Click to select file
                      </span>
                    )}
                  </Label>
                </div>
              </div>
            )}

            {importSource === 'github' && (
              <div>
                <Label htmlFor="github-url" className="text-sm mb-2">GitHub Repository URL</Label>
                <input
                  id="github-url"
                  type="url"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/username/repository"
                  className="w-full px-3 py-2 border rounded-md text-sm"
                />
              </div>
            )}

            {isImporting && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Importing...</span>
                  <span>{importProgress}%</span>
                </div>
                <Progress value={importProgress} />
              </div>
            )}

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Importing will merge files with your existing project. Conflicts will be overwritten.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={isImporting}>
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Import
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}