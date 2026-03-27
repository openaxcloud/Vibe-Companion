// @ts-nocheck
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Smartphone, AlertCircle, CheckCircle2, Lightbulb, ExternalLink } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface MobileBuild {
  id: number;
  platform: 'ios' | 'android';
  status: 'queued' | 'building' | 'completed' | 'failed' | 'cancelled';
  bundleId: string;
  version: string;
  buildNumber?: string;
  errorMessage?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  hasArtifact: boolean;
}

const statusConfig = {
  completed: { icon: CheckCircle2, color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', label: 'Completed' },
  failed: { icon: AlertCircle, color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', label: 'Failed' },
};

export function MobileBuildDashboard() {
  // Demo build history (read-only)
  const demoBuild: MobileBuild = {
    id: 1,
    platform: 'android',
    status: 'completed',
    bundleId: 'com.example.myapp',
    version: '1.0.0',
    buildNumber: '1',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60000).toISOString(),
    startedAt: new Date(Date.now() - 2 * 24 * 60 * 60000 + 60000).toISOString(),
    completedAt: new Date(Date.now() - 2 * 24 * 60 * 60000 + 300000).toISOString(),
    hasArtifact: true,
  };

  return (
    <div className="p-6 space-y-6" data-testid="mobile-build-dashboard">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="dashboard-title">
            <Smartphone className="h-6 w-6" />
            Mobile Builds
          </h1>
          <p className="text-muted-foreground">Build and distribute iOS and Android apps</p>
        </div>
      </div>

      <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800">
        <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertTitle className="text-amber-900 dark:text-amber-100">Coming Soon</AlertTitle>
        <AlertDescription className="text-amber-800 dark:text-amber-200 text-[13px] mt-1">
          Mobile build functionality requires backend API implementation. Currently showing demo data only.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card data-testid="card-new-build" className="opacity-50 pointer-events-none">
          <CardHeader>
            <CardTitle className="text-muted-foreground">New Build</CardTitle>
            <CardDescription>Submit a new mobile app build request</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4 opacity-60">
              <div className="space-y-2">
                <div className="h-4 w-20 bg-muted rounded" />
                <div className="h-10 bg-muted rounded" />
              </div>
              <div className="space-y-2">
                <div className="h-4 w-24 bg-muted rounded" />
                <div className="h-10 bg-muted rounded" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="h-4 w-16 bg-muted rounded" />
                  <div className="h-10 bg-muted rounded" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 w-20 bg-muted rounded" />
                  <div className="h-10 bg-muted rounded" />
                </div>
              </div>
              <div className="h-10 bg-primary/50 rounded" />
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-build-history">
          <CardHeader>
            <CardTitle>Build History (Demo)</CardTitle>
            <CardDescription>Example mobile app build</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[350px]">
              <div className="space-y-3">
                <div className="p-4 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">📦</span>
                      <span className="font-medium text-[13px]">{demoBuild.bundleId}</span>
                    </div>
                    <Badge className={statusConfig[demoBuild.status].color} data-testid={`status-badge-${demoBuild.id}`}>
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      {statusConfig[demoBuild.status].label}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between text-[13px] text-muted-foreground">
                    <span>v{demoBuild.version} ({demoBuild.buildNumber || '1'})</span>
                    <span>{new Date(demoBuild.createdAt).toLocaleDateString()}</span>
                  </div>

                  <Button variant="outline" size="sm" className="w-full mt-2" disabled>
                    Download APK
                  </Button>
                </div>

                <Alert variant="outline">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle className="text-sm">Backend Required</AlertTitle>
                  <AlertDescription className="text-[12px]">
                    To enable mobile builds, implement the backend APIs for:
                    <ul className="list-disc list-inside mt-1 text-[11px] space-y-1">
                      <li>POST /api/mobile/builds</li>
                      <li>GET /api/mobile/builds</li>
                      <li>GET /api/mobile/builds/{'{buildId}'}/artifact</li>
                      <li>GET /api/mobile/config</li>
                    </ul>
                  </AlertDescription>
                </Alert>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default MobileBuildDashboard;
