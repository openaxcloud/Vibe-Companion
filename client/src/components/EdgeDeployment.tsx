import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Globe, MapPin, Zap, Shield, BarChart } from 'lucide-react';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface EdgeLocation {
  id: string;
  name: string;
  region: string;
  coordinates: { latitude: number; longitude: number };
  status: 'active' | 'inactive' | 'maintenance';
  load: { cpu: number; memory: number; requests: number };
}

interface EdgeDeploymentConfig {
  edgeEnabled: boolean;
  edgeLocations: string[];
  routing: 'geo-nearest' | 'round-robin' | 'least-loaded' | 'custom';
  cacheStrategy: 'aggressive' | 'moderate' | 'minimal';
  replication: 'full' | 'partial' | 'on-demand';
}

interface EdgeDeploymentInfo {
  id: string;
  locations: string[];
  routing: string;
  status: 'active' | 'pending' | 'failed';
  createdAt: string;
}

export function EdgeDeployment({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const [config, setConfig] = useState<EdgeDeploymentConfig>({
    edgeEnabled: false,
    edgeLocations: [],
    routing: 'geo-nearest',
    cacheStrategy: 'moderate',
    replication: 'full'
  });

  // Fetch available edge locations
  const { data: locations = [] } = useQuery<EdgeLocation[]>({
    queryKey: ['/api/edge/locations']
  });

  // Fetch existing edge deployments
  const { data: deployments = [] } = useQuery<EdgeDeploymentInfo[]>({
    queryKey: [`/api/projects/${projectId}/edge-deployments`]
  });

  // Deploy to edge mutation
  const deployMutation = useMutation({
    mutationFn: async (configData: EdgeDeploymentConfig) => {
      const response = await apiRequest('POST', `/api/edge-deployment/${projectId}/deploy`, configData);
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || 'Failed to deploy to edge');
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/edge-deployment/${projectId}/status`] });
      toast({
        title: 'Edge Deployment Started',
        description: `Deploying to ${config.edgeLocations.length} global locations`
      });
    },
    onError: (error) => {
      toast({
        title: 'Deployment Failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const activeLocations = locations.filter(loc => loc.status === 'active');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Global Edge Deployment
          </CardTitle>
          <CardDescription>
            Deploy your application to multiple edge locations worldwide for faster performance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable Edge Deployment */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="edge-enabled">Enable Edge Deployment</Label>
              <p className="text-[13px] text-muted-foreground">
                Deploy to global CDN with automatic failover
              </p>
            </div>
            <Switch
              id="edge-enabled"
              checked={config.edgeEnabled}
              onCheckedChange={(checked) => setConfig({ ...config, edgeEnabled: checked })}
            />
          </div>

          {config.edgeEnabled && (
            <>
              {/* Location Selection */}
              <div className="space-y-3">
                <Label>Edge Locations</Label>
                <div className="grid grid-cols-2 gap-3">
                  {activeLocations.map(location => (
                    <label
                      key={location.id}
                      className={`flex items-center space-x-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                        config.edgeLocations.includes(location.id)
                          ? 'border-primary bg-primary/5'
                          : 'border-input hover:bg-surface-hover-solid'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="rounded border-input"
                        checked={config.edgeLocations.includes(location.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setConfig({
                              ...config,
                              edgeLocations: [...config.edgeLocations, location.id]
                            });
                          } else {
                            setConfig({
                              ...config,
                              edgeLocations: config.edgeLocations.filter(id => id !== location.id)
                            });
                          }
                        }}
                      />
                      <div className="flex-1">
                        <p className="text-[13px] font-medium">{location.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          Load: {location.load.cpu.toFixed(0)}% CPU
                        </p>
                      </div>
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                    </label>
                  ))}
                </div>
              </div>

              {/* Routing Strategy */}
              <div className="space-y-2">
                <Label htmlFor="routing">Routing Strategy</Label>
                <Select value={config.routing} onValueChange={(value: any) => setConfig({ ...config, routing: value })}>
                  <SelectTrigger id="routing">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="geo-nearest">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Geo-nearest (Lowest latency)
                      </div>
                    </SelectItem>
                    <SelectItem value="round-robin">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        Round-robin (Even distribution)
                      </div>
                    </SelectItem>
                    <SelectItem value="least-loaded">
                      <div className="flex items-center gap-2">
                        <BarChart className="h-4 w-4" />
                        Least-loaded (Performance optimized)
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Cache Strategy */}
              <div className="space-y-2">
                <Label htmlFor="cache">Cache Strategy</Label>
                <Select value={config.cacheStrategy} onValueChange={(value: any) => setConfig({ ...config, cacheStrategy: value })}>
                  <SelectTrigger id="cache">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aggressive">Aggressive (Best performance)</SelectItem>
                    <SelectItem value="moderate">Moderate (Balanced)</SelectItem>
                    <SelectItem value="minimal">Minimal (Fresh content)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Replication */}
              <div className="space-y-2">
                <Label htmlFor="replication">Replication Mode</Label>
                <Select value={config.replication} onValueChange={(value: any) => setConfig({ ...config, replication: value })}>
                  <SelectTrigger id="replication">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Full (All locations)</SelectItem>
                    <SelectItem value="partial">Partial (Primary locations)</SelectItem>
                    <SelectItem value="on-demand">On-demand (As needed)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <Button
            onClick={() => deployMutation.mutate(config)}
            disabled={deployMutation.isPending || (config.edgeEnabled && config.edgeLocations.length === 0)}
            className="w-full"
          >
            {deployMutation.isPending ? 'Deploying...' : 'Deploy to Edge'}
          </Button>
        </CardContent>
      </Card>

      {/* Existing Deployments */}
      {deployments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active Edge Deployments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {deployments.map((deployment: any) => (
                <div key={deployment.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
                    <p className="text-[13px] font-medium">Deployment {deployment.id}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {deployment.locations.length} locations • {deployment.routing} routing
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-green-500" />
                    <span className="text-[13px] text-green-500">Active</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}