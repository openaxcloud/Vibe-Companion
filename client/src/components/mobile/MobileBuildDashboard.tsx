import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Smartphone, Apple, Download, RefreshCw, AlertCircle, CheckCircle2, Clock, Loader2, XCircle, ExternalLink } from 'lucide-react';
import { SiAndroid } from 'react-icons/si';

const buildRequestSchema = z.object({
  platform: z.enum(['ios', 'android']),
  bundleId: z.string().min(1, 'Bundle ID is required').regex(/^[a-zA-Z][a-zA-Z0-9._-]*(\.[a-zA-Z][a-zA-Z0-9._-]*)+$/, 'Invalid bundle ID format (e.g., com.example.app)'),
  version: z.string().min(1, 'Version is required').regex(/^\d+\.\d+(\.\d+)?$/, 'Version must be X.Y or X.Y.Z'),
  buildNumber: z.string().optional(),
});

type BuildRequest = z.infer<typeof buildRequestSchema>;

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

interface BuildsResponse {
  builds: MobileBuild[];
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

interface ConfigResponse {
  configured: boolean;
  supportedPlatforms: string[];
  maxConcurrentBuilds: number;
  documentationUrl: string;
}

interface ArtifactResponse {
  downloadUrl: string;
  filename: string;
  size: number;
  expiresAt: string;
  platform: string;
}

const statusConfig = {
  queued: { icon: Clock, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200', label: 'Queued' },
  building: { icon: Loader2, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', label: 'Building' },
  completed: { icon: CheckCircle2, color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', label: 'Completed' },
  failed: { icon: XCircle, color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', label: 'Failed' },
  cancelled: { icon: XCircle, color: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200', label: 'Cancelled' },
};

export function MobileBuildDashboard() {
  const [downloadingBuildId, setDownloadingBuildId] = useState<number | null>(null);

  const { data: config, isLoading: configLoading } = useQuery<ConfigResponse>({
    queryKey: ['/api/mobile/config'],
    staleTime: 60 * 1000,
  });

  const { data: buildsData, isLoading: buildsLoading, refetch: refetchBuilds } = useQuery<BuildsResponse>({
    queryKey: ['/api/mobile/builds'],
    refetchInterval: (_data, _query) => {
      const data = _data as BuildsResponse | undefined;
      const hasActiveBuilds = data?.builds?.some(b => b.status === 'queued' || b.status === 'building');
      return hasActiveBuilds ? 5000 : false;
    },
  });

  const form = useForm<BuildRequest>({
    resolver: zodResolver(buildRequestSchema),
    defaultValues: {
      platform: 'android',
      bundleId: '',
      version: '1.0.0',
      buildNumber: '1',
    },
  });

  const submitBuildMutation = useMutation({
    mutationFn: async (data: BuildRequest) => {
      return apiRequest<MobileBuild>('POST', '/api/mobile/builds', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/mobile/builds'] });
      form.reset();
    },
  });

  const handleDownload = async (buildId: number) => {
    setDownloadingBuildId(buildId);
    try {
      const artifact = await apiRequest<ArtifactResponse>('GET', `/api/mobile/builds/${buildId}/artifact`);
      window.open(artifact.downloadUrl, '_blank');
    } catch (error) {
      console.error('Failed to download artifact:', error);
    } finally {
      setDownloadingBuildId(null);
    }
  };

  const onSubmit = (data: BuildRequest) => {
    submitBuildMutation.mutate(data);
  };

  if (configLoading) {
    return (
      <div className="p-6 space-y-6" data-testid="dashboard-loading">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-[300px]" />
          <Skeleton className="h-[300px]" />
        </div>
      </div>
    );
  }

  if (!config?.configured) {
    return (
      <div className="p-6" data-testid="dashboard-not-configured">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Mobile Build Service Not Configured</AlertTitle>
          <AlertDescription className="mt-2 space-y-2">
            <p>
              EAS Build token is not configured. To enable mobile app builds, you need to set up an Expo account and configure the EAS_BUILD_TOKEN environment variable.
            </p>
            <p className="text-[13px]">
              1. Create an Expo account at{' '}
              <a href="https://expo.dev" target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-1">
                expo.dev <ExternalLink className="h-3 w-3" />
              </a>
            </p>
            <p className="text-[13px]">2. Generate an access token from your Expo account settings</p>
            <p className="text-[13px]">3. Set <code className="bg-red-100 dark:bg-red-900 px-1 rounded">EAS_BUILD_TOKEN</code> in your environment variables</p>
            <Button variant="outline" size="sm" className="mt-4" asChild>
              <a href={config?.documentationUrl || 'https://docs.expo.dev/build/setup/'} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-2" />
                View Documentation
              </a>
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

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
        <Button variant="outline" size="sm" onClick={() => refetchBuilds()} data-testid="button-refresh-builds">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card data-testid="card-new-build">
          <CardHeader>
            <CardTitle>New Build</CardTitle>
            <CardDescription>Submit a new mobile app build request</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="platform"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Platform</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-platform">
                            <SelectValue placeholder="Select platform" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="android" data-testid="select-option-android">
                            <div className="flex items-center gap-2">
                              <SiAndroid className="h-4 w-4" />
                              Android (APK)
                            </div>
                          </SelectItem>
                          <SelectItem value="ios" data-testid="select-option-ios">
                            <div className="flex items-center gap-2">
                              <Apple className="h-4 w-4" />
                              iOS (IPA)
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="bundleId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bundle ID</FormLabel>
                      <FormControl>
                        <Input placeholder="com.example.myapp" {...field} data-testid="input-bundle-id" />
                      </FormControl>
                      <FormDescription>Unique identifier for your app (e.g., com.company.appname)</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="version"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Version</FormLabel>
                        <FormControl>
                          <Input placeholder="1.0.0" {...field} data-testid="input-version" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="buildNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Build Number</FormLabel>
                        <FormControl>
                          <Input placeholder="1" {...field} data-testid="input-build-number" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {submitBuildMutation.isError && (
                  <Alert variant="destructive" data-testid="alert-submit-error">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {(submitBuildMutation.error as any)?.message || 'Failed to submit build'}
                    </AlertDescription>
                  </Alert>
                )}

                <Button type="submit" className="w-full" disabled={submitBuildMutation.isPending} data-testid="button-submit-build">
                  {submitBuildMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Smartphone className="h-4 w-4 mr-2" />
                      Start Build
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card data-testid="card-build-history">
          <CardHeader>
            <CardTitle>Build History</CardTitle>
            <CardDescription>Your recent mobile app builds</CardDescription>
          </CardHeader>
          <CardContent>
            {buildsLoading ? (
              <div className="space-y-3" data-testid="builds-loading">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            ) : !buildsData?.builds?.length ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="builds-empty">
                <Smartphone className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No builds yet</p>
                <p className="text-[13px]">Submit your first build to get started</p>
              </div>
            ) : (
              <ScrollArea className="h-[350px]">
                <div className="space-y-3">
                  {buildsData.builds.map((build) => {
                    const StatusIcon = statusConfig[build.status].icon;
                    const isDownloading = downloadingBuildId === build.id;

                    return (
                      <div
                        key={build.id}
                        className="p-4 border rounded-lg space-y-2"
                        data-testid={`build-item-${build.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {build.platform === 'ios' ? (
                              <Apple className="h-4 w-4" />
                            ) : (
                              <SiAndroid className="h-4 w-4" />
                            )}
                            <span className="font-medium text-[13px]">{build.bundleId}</span>
                          </div>
                          <Badge className={statusConfig[build.status].color} data-testid={`status-badge-${build.id}`}>
                            <StatusIcon className={`h-3 w-3 mr-1 ${build.status === 'building' ? 'animate-spin' : ''}`} />
                            {statusConfig[build.status].label}
                          </Badge>
                        </div>

                        <div className="flex items-center justify-between text-[13px] text-muted-foreground">
                          <span>v{build.version} ({build.buildNumber || '1'})</span>
                          <span>{new Date(build.createdAt).toLocaleDateString()}</span>
                        </div>

                        {build.errorMessage && (
                          <p className="text-[13px] text-red-600 dark:text-red-400" data-testid={`error-message-${build.id}`}>
                            {build.errorMessage}
                          </p>
                        )}

                        {build.status === 'completed' && build.hasArtifact && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full mt-2"
                            onClick={() => handleDownload(build.id)}
                            disabled={isDownloading}
                            data-testid={`button-download-${build.id}`}
                          >
                            {isDownloading ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4 mr-2" />
                            )}
                            Download {build.platform === 'ios' ? 'IPA' : 'APK'}
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default MobileBuildDashboard;
